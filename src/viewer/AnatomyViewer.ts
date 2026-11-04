// Rendering approach adapted from human-atlas (MIT). See LICENSE.human-atlas.
//
// All 2,234 meshes are merged into one draw call per system. Per-structure state (explode offset,
// visibility, selection, highlight colour) lives in small GPU textures indexed by a `partIndex`
// vertex attribute, so changing what is shown never rebuilds geometry. Separate per-part meshes
// that share the same buffers are kept for accurate ray picking.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SYSTEMS, SYSTEM_BY_ID } from "@/atlas/systems";
import type { Atlas, SystemId } from "@/atlas/types";
import { createExplosionLayout } from "./explosion-layout";
import { decodeModelResponse } from "./model-download";
import { PointerTap } from "./pointer-tap";

export type ViewPreset = "three-quarter" | "front" | "side" | "back";

export interface SceneState {
  /** Systems shown. */
  visible: readonly SystemId[];
  /** Selected part IDs (meshes, not concepts). */
  selected: readonly string[];
  /** Show only the selection and frame it. */
  isolate: boolean;
  /** 0 = assembled, 1 = every piece laid out flat. */
  explode: number;
  rotate: boolean;
  view: ViewPreset;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/** Screen space (px) covered by UI, so framed structures stay in the clear area. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewerOptions {
  /** Folder that holds the chunk files named in atlas.json. */
  modelBase: string;
  initialState: SceneState;
  /** Restore this camera once the canvas has a size. */
  initialCamera?: CameraPose | null;
  onPick?: (partId: string) => void;
  onProgress?: (percent: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  /** Fired after the user finishes moving the camera. */
  onCameraChange?: (pose: CameraPose) => void;
}

interface PickTarget {
  index: number;
  x: number;
  y: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Tween {
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
  elapsed: number;
  duration: number;
}

const SELECTION_COLOR = "vec3(0.42, 0.85, 0.78)";
const STAGE_Y = 0.85;
const DEFAULT_INSETS: Insets = { top: 110, right: 20, bottom: 170, left: 20 };
const SYSTEM_ORDER = new Map(SYSTEMS.map((s, i) => [s.id, i]));

export class ViewerError extends Error {}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function stageRing(inner: number, outer: number, color: number, opacity: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 128),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  return mesh;
}

export class AnatomyViewer {
  readonly atlas: Atlas;
  private readonly host: HTMLElement;
  private readonly options: ViewerOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.005, 100);
  private readonly controls: OrbitControls;
  private readonly abort = new AbortController();
  private readonly observer: ResizeObserver;

  // Per-part state, uploaded to the GPU as 1-pixel-high textures.
  private readonly stateWidth: number;
  private readonly partData: Float32Array; // xyz offset, w visible
  private readonly partTexture: THREE.DataTexture;
  private readonly selectionData: Uint8Array; // r selected
  private readonly selectionTexture: THREE.DataTexture;
  private readonly highlightData: Uint8Array; // rgb colour, a strength
  private readonly highlightTexture: THREE.DataTexture;

  private readonly centers: THREE.Vector3[];
  private readonly bounds: THREE.Box3[];
  private readonly offsets: THREE.Vector3[];
  private readonly pickers: (THREE.Mesh | undefined)[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly stage: THREE.Object3D[] = [];
  private readonly environment: THREE.WebGLRenderTarget;

  private readonly markerPositions: Float32Array;
  private readonly markerGeometry = new THREE.BufferGeometry();
  private readonly markerMaterial: THREE.PointsMaterial;
  private readonly markers: THREE.Points;
  private readonly hover: HTMLDivElement;
  private targets: PickTarget[] = [];

  private readonly tap = new PointerTap();
  private readonly raycaster = new THREE.Raycaster();

  private state: SceneState;
  private insets: Insets = DEFAULT_INSETS;
  private disposed = false;
  private ready = false;
  private sized = false;
  private dirty = true;
  private frame = 0;
  private lastTime = performance.now();

  private amount = 0; // current (animated) explode amount
  private stateChanged = true;
  private viewChanged = true;
  private layoutKey = "";
  private isolateKey = "";
  private packingWidth = 1;
  private packingHeight = 1;

  private pendingCamera: CameraPose | null;
  private userCamera = false; // the user (or a restored link) placed the camera
  private interacting = false;
  private userDriven = false;
  private cameraTimer: ReturnType<typeof setTimeout> | undefined;
  private tween: Tween | null = null;

  constructor(host: HTMLElement, atlas: Atlas, options: ViewerOptions) {
    this.host = host;
    this.atlas = atlas;
    this.options = options;
    this.state = options.initialState;
    this.pendingCamera = options.initialCamera ?? null;

    if (typeof DecompressionStream === "undefined") {
      throw new ViewerError("This browser is too old to load the 3D model. Please update it.");
    }
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      throw new ViewerError(
        "This browser could not start the 3D viewer. Please try a browser with WebGL enabled.",
      );
    }

    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    renderer.setClearColor("#eef0f1");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.",
    );
    renderer.domElement.setAttribute("role", "img");
    host.appendChild(renderer.domElement);

    // Camera and controls.
    this.camera.position.set(1.4, 1.05, 3.6);
    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.target.set(0, STAGE_Y, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener("start", this.onControlsStart);
    controls.addEventListener("change", this.onControlsChange);
    controls.addEventListener("end", this.onControlsEnd);
    this.controls = controls;

    // Lighting and stage.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa7acb2, 1.05));
    const key = new THREE.DirectionalLight(0xfffaf4, 2.3);
    key.position.set(-2, 4, 3);
    const rim = new THREE.DirectionalLight(0xe9f0ff, 1.8);
    rim.position.set(2, 2, -3);
    this.scene.add(key, rim);
    this.buildStage();

    // Per-part state textures.
    const count = atlas.parts.length;
    this.stateWidth = THREE.MathUtils.ceilPowerOfTwo(count);
    this.partData = new Float32Array(this.stateWidth * 4);
    this.partTexture = new THREE.DataTexture(
      this.partData,
      this.stateWidth,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.partTexture.needsUpdate = true;
    this.selectionData = new Uint8Array(this.stateWidth * 4);
    this.selectionTexture = new THREE.DataTexture(this.selectionData, this.stateWidth, 1);
    this.selectionTexture.needsUpdate = true;
    this.highlightData = new Uint8Array(this.stateWidth * 4);
    this.highlightTexture = new THREE.DataTexture(this.highlightData, this.stateWidth, 1);
    this.highlightTexture.needsUpdate = true;

    this.centers = atlas.parts.map((p) =>
      new THREE.Vector3()
        .fromArray(p.bounds[0])
        .add(new THREE.Vector3().fromArray(p.bounds[1]))
        .multiplyScalar(0.5),
    );
    this.bounds = atlas.parts.map(
      (p) =>
        new THREE.Box3(
          new THREE.Vector3().fromArray(p.bounds[0]),
          new THREE.Vector3().fromArray(p.bounds[1]),
        ),
    );
    this.offsets = this.centers.map((c) => c.clone());

    // Dots that mark each piece in the exploded inventory, so tiny pieces stay findable.
    this.markerPositions = new Float32Array(count * 3);
    this.markerGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.markerPositions, 3),
    );
    this.markerMaterial = new THREE.PointsMaterial({
      color: 0x64748b,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
    });
    this.markerMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;",
      );
    };
    this.markers = new THREE.Points(this.markerGeometry, this.markerMaterial);
    this.markers.frustumCulled = false;
    this.markers.renderOrder = 10;
    this.markers.visible = false;
    this.scene.add(this.markers);

    this.hover = document.createElement("div");
    this.hover.className = "viewer-hover";
    this.hover.setAttribute("role", "tooltip");
    this.hover.hidden = true;
    host.appendChild(this.hover);

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("webglcontextlost", this.onContextLost);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);

    void this.loadModel();
    this.animate();
  }

  // ---------------------------------------------------------------------------------------------
  // Public API

  /** Replace the declarative scene state. Cheap: only GPU textures are updated. */
  setState(next: SceneState): void {
    const prev = this.state;
    if (next === prev) return;
    if (
      next.visible !== prev.visible ||
      next.selected !== prev.selected ||
      next.isolate !== prev.isolate
    ) {
      this.stateChanged = true;
    }
    if (next.view !== prev.view) this.viewChanged = true;
    this.state = next;
    this.dirty = true;
  }

  /** Re-frame the camera for the current view preset (used by "reset"). */
  refit(): void {
    this.viewChanged = true;
    this.isolateKey = "";
    this.dirty = true;
  }

  /** Space covered by UI panels, in CSS pixels. */
  setInsets(insets: Insets): void {
    const same =
      insets.top === this.insets.top &&
      insets.right === this.insets.right &&
      insets.bottom === this.insets.bottom &&
      insets.left === this.insets.left;
    if (same) return;
    this.insets = insets;
    this.dirty = true;
  }

  /** Tint parts, e.g. quiz feedback. Pass null to clear. Colours are CSS hex strings. */
  setHighlights(colors: ReadonlyMap<string, string> | null): void {
    this.highlightData.fill(0);
    if (colors) {
      const color = new THREE.Color();
      this.atlas.parts.forEach((part, i) => {
        const hex = colors.get(part.id);
        if (!hex) return;
        color.set(hex);
        this.highlightData.set(
          [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 210],
          i * 4,
        );
      });
    }
    this.highlightTexture.needsUpdate = true;
    this.dirty = true;
  }

  /** Smoothly frame the given parts without hiding anything. */
  flyTo(partIds: readonly string[]): void {
    if (this.state.isolate || this.amount > 0.05) return;
    const ids = new Set(partIds);
    const box = new THREE.Box3();
    this.atlas.parts.forEach((part, i) => {
      if (ids.has(part.id)) box.union(this.bounds[i]!);
    });
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const distance = THREE.MathUtils.clamp(size / this.fovTan() / 0.62, 0.25, 4.5);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.tween = {
      fromPosition: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPosition: center.clone().addScaledVector(direction, distance),
      toTarget: center,
      elapsed: 0,
      duration: 0.65,
    };
    this.dirty = true;
  }

  getCamera(): CameraPose {
    const p = this.camera.position;
    const t = this.controls.target;
    return {
      position: [round3(p.x), round3(p.y), round3(p.z)],
      target: [round3(t.x), round3(t.y), round3(t.z)],
    };
  }

  setCamera(pose: CameraPose): void {
    if (!this.sized) {
      this.pendingCamera = pose;
      return;
    }
    this.tween = null;
    this.controls.target.fromArray(pose.target);
    this.camera.position.fromArray(pose.position);
    this.controls.update();
    this.userCamera = true;
    this.dirty = true;
  }

  get isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    cancelAnimationFrame(this.frame);
    clearTimeout(this.cameraTimer);
    this.observer.disconnect();
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const object of this.stage) {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    }
    this.environment.dispose();
    this.partTexture.dispose();
    this.selectionTexture.dispose();
    this.highlightTexture.dispose();
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
    this.hover.remove();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---------------------------------------------------------------------------------------------
  // Scene setup and loading

  private buildStage(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 96),
      new THREE.MeshStandardMaterial({ color: 0xd5d9dc, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.019;
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.7, 0.028, 100),
      new THREE.MeshStandardMaterial({ color: 0xeeeeec, metalness: 0.12, roughness: 0.67 }),
    );
    platform.position.y = -0.016;
    this.stage.push(
      ground,
      platform,
      stageRing(0.63, 0.632, 0x8c969f, 0.4),
      stageRing(0.55, 0.551, 0xa4aeb8, 0.16),
    );
    this.scene.add(...this.stage);
  }

  private materialFor(system: SystemId): THREE.MeshStandardMaterial {
    const surface = system === "integumentary";
    const material = new THREE.MeshStandardMaterial({
      color: SYSTEM_BY_ID.get(system)?.color ?? "#aebbb8",
      metalness: 0.08,
      roughness: 0.53,
      side: THREE.DoubleSide,
      transparent: surface,
      opacity: surface ? 0.1 : 1,
      depthWrite: !surface,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.partState = { value: this.partTexture };
      shader.uniforms.selectionState = { value: this.selectionTexture };
      shader.uniforms.highlightState = { value: this.highlightTexture };
      shader.uniforms.stateWidth = { value: this.stateWidth };
      shader.vertexShader =
        [
          "attribute float partIndex;",
          "uniform sampler2D partState;",
          "uniform sampler2D selectionState;",
          "uniform sampler2D highlightState;",
          "uniform float stateWidth;",
          "varying float vPartVisible;",
          "varying float vPartSelected;",
          "varying vec4 vHighlight;",
        ].join("\n") +
        "\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          [
            "#include <begin_vertex>",
            "vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);",
            "vec4 partInfo = texture(partState, stateUv);",
            "transformed += partInfo.xyz;",
            "vPartVisible = partInfo.w;",
            "vPartSelected = texture(selectionState, stateUv).r;",
            "vHighlight = texture(highlightState, stateUv);",
          ].join("\n"),
        );
      shader.fragmentShader =
        "varying float vPartVisible;\nvarying float vPartSelected;\nvarying vec4 vHighlight;\n" +
        shader.fragmentShader
          .replace(
            "#include <clipping_planes_fragment>",
            "#include <clipping_planes_fragment>\nif (vPartVisible < 0.5) discard;",
          )
          .replace(
            "#include <color_fragment>",
            [
              "#include <color_fragment>",
              `diffuseColor.rgb = mix(diffuseColor.rgb, ${SELECTION_COLOR}, vPartSelected * 0.75);`,
              "diffuseColor.rgb = mix(diffuseColor.rgb, vHighlight.rgb, vHighlight.a);",
            ].join("\n"),
          );
    };
    this.materials.push(material);
    return material;
  }

  private async loadModel(): Promise<void> {
    const { atlas } = this;
    const materials = new Map(SYSTEMS.map((s) => [s.id, this.materialFor(s.id)]));
    let loaded = 0;

    const loadChunk = async (chunkIndex: number) => {
      const chunk = atlas.chunks[chunkIndex]!;
      const file = (chunk.gzip ?? chunk.url).split("/").pop()!;
      const response = await fetch(this.options.modelBase + file, { signal: this.abort.signal });
      const buffer = await decodeModelResponse(response, chunk.bytes);
      if (this.disposed) return;

      const groups = new Map<SystemId, THREE.BufferGeometry[]>();
      atlas.parts.forEach((part, i) => {
        if (part.chunk !== chunkIndex) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(
            new Float32Array(buffer, part.positions, part.vertexCount * 3),
            3,
          ),
        );
        // Normalised signed-short normals keep the whole atlas compact in GPU memory.
        geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(
            new Int16Array(buffer, part.normals, part.vertexCount * 3),
            3,
            true,
          ),
        );
        geometry.setIndex(
          new THREE.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1),
        );
        geometry.boundingBox = this.bounds[i]!.clone();
        geometry.computeBoundingSphere();
        const picker = new THREE.Mesh(geometry);
        picker.matrixAutoUpdate = false;
        this.pickers[i] = picker;
        this.geometries.push(geometry);
        geometry.setAttribute(
          "partIndex",
          new THREE.BufferAttribute(new Float32Array(part.vertexCount).fill(i), 1),
        );
        const list = groups.get(part.system) ?? [];
        list.push(geometry);
        groups.set(part.system, list);
      });

      for (const [system, list] of groups) {
        const merged = mergeGeometries(list, false);
        if (!merged) throw new Error("Could not assemble the anatomy geometry.");
        this.geometries.push(merged);
        const mesh = new THREE.Mesh(merged, materials.get(system));
        mesh.frustumCulled = false;
        this.scene.add(mesh);
      }
      this.stateChanged = true;
      loaded++;
      this.options.onProgress?.(Math.round((loaded / atlas.chunks.length) * 100));
      this.dirty = true;
    };

    try {
      let cursor = 0;
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          while (cursor < atlas.chunks.length) await loadChunk(cursor++);
        }),
      );
      if (this.disposed) return;
      this.ready = true;
      this.dirty = true;
      this.options.onReady?.();
    } catch (error) {
      if (this.disposed) return;
      this.options.onError?.(
        error instanceof Error ? error.message : "Could not load the anatomy model.",
      );
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Camera framing

  private fovTan(): number {
    return 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
  }

  /** Frame the whole body (extent 0) or the exploded inventory (extent 1). */
  private fit(view: ViewPreset, extent = 0): void {
    const el = this.host;
    const width = el.clientWidth;
    const height = el.clientHeight;
    const mobile = width < 768;
    const fovTan = this.fovTan();
    const reservedHeight = mobile ? 350 : 270;
    const usableHeight = Math.max(160, height - reservedHeight);
    const normalDistance = mobile
      ? Math.max(4.5, (1.8 * height) / Math.max(160, height - 350) / fovTan)
      : 4;
    const availableAspect = Math.max(0.35, (width - (mobile ? 40 : 340)) / usableHeight);
    const atlasDistance =
      (Math.max(this.packingHeight, this.packingWidth / availableAspect) / fovTan) *
      (height / usableHeight) *
      1.08;
    const distance = THREE.MathUtils.lerp(normalDistance, Math.max(0.2, atlasDistance), extent);
    if (extent > 0.8) view = "front";
    const direction =
      view === "front"
        ? new THREE.Vector3(0, 0.02, 1)
        : view === "back"
          ? new THREE.Vector3(0, 0.02, -1)
          : view === "side"
            ? new THREE.Vector3(1, 0.02, 0)
            : new THREE.Vector3(0.35, 0.06, 1).normalize();
    this.controls.target.set(
      extent > 0.1 && !mobile ? -this.packingWidth * 0.12 : 0,
      extent > 0.1 || mobile ? STAGE_Y : 0.68,
      0,
    );
    this.camera.position.copy(this.controls.target).addScaledVector(direction, distance);
    this.controls.update();
    this.userCamera = false;
    this.tween = null;
    this.dirty = true;
  }

  private frameIsolated(): void {
    const box = new THREE.Box3();
    const selected = new Set(this.state.selected);
    const offset = new THREE.Vector3();
    this.atlas.parts.forEach((part, i) => {
      if (!selected.has(part.id)) return;
      offset.set(this.partData[i * 4]!, this.partData[i * 4 + 1]!, this.partData[i * 4 + 2]!);
      box.union(this.bounds[i]!.clone().translate(offset));
    });
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const left = this.insets.left;
    const right = w - this.insets.right;
    const top = this.insets.top;
    const bottom = h - this.insets.bottom;
    const availableWidth = Math.max(150, right - left);
    const availableHeight = Math.max(40, bottom - top);
    // Shift the projection centre into the clear area between the panels.
    this.camera.setViewOffset(w, h, w / 2 - (left + right) / 2, h / 2 - (top + bottom) / 2, w, h);
    const distance = Math.max(
      0.07,
      (Math.max(
        (size.y * h) / availableHeight,
        (size.x * w) / availableWidth / this.camera.aspect,
        size.z,
      ) /
        this.fovTan()) *
        1.35,
    );
    this.controls.maxDistance = Math.max(40, distance * 2);
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(0.2, 0.1, 1).normalize().multiplyScalar(distance));
    this.controls.update();
    this.tween = null;
    this.dirty = true;
  }

  private resize(): void {
    const el = this.host;
    if (el.clientWidth === 0 || el.clientHeight === 0) return;
    this.layoutKey = "";
    this.stateChanged = true;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, el.clientWidth < 768 || el.clientHeight < 600 ? 1.5 : 2),
    );
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.sized = true;
    if (this.pendingCamera) {
      this.fit(this.state.view, this.amount);
      this.viewChanged = false;
      const pose = this.pendingCamera;
      this.pendingCamera = null;
      this.setCamera(pose);
    } else if (!(this.userCamera && this.amount < 0.05 && !this.state.isolate)) {
      this.fit(this.state.view, this.amount);
    }
    this.dirty = true;
  }

  // ---------------------------------------------------------------------------------------------
  // Frame loop

  private animate = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (!this.sized) return;
    const now = performance.now();
    const elapsed = (now - this.lastTime) / 1000;
    const dt = Math.min(elapsed, 0.05);
    this.lastTime = now;
    const s = this.state;

    const moving = Math.abs(this.amount - s.explode) > 0.0001;
    if (moving) {
      this.amount = THREE.MathUtils.damp(this.amount, s.explode, 8, dt);
      if (Math.abs(this.amount - s.explode) <= 0.0001) this.amount = s.explode;
      this.dirty = true;
    }
    if (this.stateChanged || moving) this.updateParts();

    if (this.viewChanged) {
      this.viewChanged = false;
      if (!s.isolate) this.fit(s.view, this.amount);
    }
    if (moving && !s.isolate) {
      this.fit(this.amount > 0.5 ? "front" : s.view, Math.max(0, (this.amount - 0.3) / 0.7));
    }

    const isolateKey = s.isolate
      ? `${s.selected.join(",")}:${Object.values(this.insets).join(",")}:${this.camera.aspect.toFixed(3)}`
      : "";
    if (isolateKey !== this.isolateKey || (s.isolate && moving)) {
      if (s.isolate) this.frameIsolated();
      else if (this.isolateKey) {
        this.camera.clearViewOffset();
        this.controls.maxDistance = 40;
        this.fit(s.view, this.amount);
      }
      this.isolateKey = isolateKey;
    }

    // Real elapsed time, so camera moves keep their duration on slow devices.
    if (this.tween) this.stepTween(elapsed);

    const flat = this.amount >= 0.8;
    this.controls.enableRotate = !flat;
    this.controls.mouseButtons.LEFT = flat ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = flat ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    const showStage = this.amount < 0.5 && !s.isolate;
    for (const object of this.stage) object.visible = showStage;
    this.markers.visible = this.amount > 0.75;
    this.controls.autoRotate = s.rotate && !s.isolate && this.amount < 0.4;
    this.controls.autoRotateSpeed = 0.65;
    this.controls.update();
    if (this.controls.autoRotate) this.dirty = true;

    if (this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.updatePickTargets();
      this.dirty = false;
    }
  };

  /** Recompute each part's offset, visibility and selection, and upload the textures. */
  private updateParts(): void {
    const s = this.state;
    const { parts } = this.atlas;
    const visible = new Set(s.visible);
    const selection = new Set(s.selected);
    const isShown = (id: string, system: SystemId) =>
      s.isolate ? selection.has(id) : visible.has(system) || selection.has(id);

    const shownParts = parts.filter((p) => isShown(p.id, p.system));
    const layoutKey = `${shownParts.map((p) => p.id).join(",")}:${this.camera.aspect.toFixed(3)}`;
    if (layoutKey !== this.layoutKey) {
      const layout = createExplosionLayout(shownParts, this.camera.aspect);
      this.packingWidth = layout.width;
      this.packingHeight = layout.height;
      parts.forEach((p, i) => {
        const cell = layout.cells.get(p.id);
        this.offsets[i] = cell
          ? new THREE.Vector3(cell.x, cell.y + STAGE_Y, 0)
          : this.centers[i]!.clone();
      });
      this.layoutKey = layoutKey;
      if (this.amount > 0.05 && !s.isolate) {
        this.fit(s.view, Math.max(0, (this.amount - 0.3) / 0.7));
      }
    }

    // Two stages: 0–0.45 pushes systems apart radially; 0.45–1 slides every piece into its cell.
    const amount = this.amount;
    const systemCount = SYSTEMS.length;
    parts.forEach((p, i) => {
      const c = this.centers[i]!;
      const destination = this.offsets[i]!;
      const angle = ((SYSTEM_ORDER.get(p.system) ?? 0) / systemCount) * Math.PI * 2;
      let dx: number;
      let dy: number;
      let dz: number;
      if (amount <= 0.45) {
        const t = amount / 0.45;
        dx = Math.sin(angle) * t * 0.48;
        dy = (c.y - STAGE_Y) * t * 0.28;
        dz = Math.cos(angle) * t * 0.48;
      } else {
        const t = (amount - 0.45) / 0.55;
        dx = THREE.MathUtils.lerp(Math.sin(angle) * 0.48, destination.x - c.x, t);
        dy = THREE.MathUtils.lerp((c.y - STAGE_Y) * 0.28, destination.y - c.y, t);
        dz = THREE.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
      }
      const selected = selection.has(p.id);
      const shown = isShown(p.id, p.system);
      this.partData.set([dx, dy, dz, shown ? 1 : 0], i * 4);
      this.selectionData[i * 4] = selected ? 255 : 0;
      this.markerPositions.set(shown ? [c.x + dx, c.y + dy, c.z + dz] : [1e4, 1e4, 1e4], i * 3);
      const picker = this.pickers[i];
      if (picker) {
        picker.position.set(dx, dy, dz);
        picker.updateMatrix();
        picker.updateMatrixWorld(true);
      }
    });
    this.partTexture.needsUpdate = true;
    this.selectionTexture.needsUpdate = true;
    this.markerGeometry.attributes.position!.needsUpdate = true;
    this.stateChanged = false;
    this.dirty = true;
  }

  private stepTween(dt: number): void {
    const tween = this.tween!;
    tween.elapsed += dt;
    const t = Math.min(1, tween.elapsed / tween.duration);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
    this.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
    this.dirty = true;
    if (t >= 1) {
      this.tween = null;
      this.userCamera = true;
      this.options.onCameraChange?.(this.getCamera());
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Picking

  private hasSolidVisible(): boolean {
    return this.atlas.parts.some(
      (p, i) => p.system !== "integumentary" && this.partData[i * 4 + 3]! > 0.5,
    );
  }

  /** Screen-space boxes of visible pieces, used for forgiving taps in the exploded view. */
  private updatePickTargets(): void {
    this.targets = [];
    if (this.amount <= 0.45) return;
    const el = this.host;
    const hasSolid = this.hasSolidVisible();
    const projected = new THREE.Vector3();
    this.atlas.parts.forEach((p, i) => {
      const d = this.partData;
      if (d[i * 4 + 3]! < 0.5 || (hasSolid && p.system === "integumentary")) return;
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (let corner = 0; corner < 8; corner++) {
        projected
          .set(
            p.bounds[corner & 1 ? 1 : 0][0]! + d[i * 4]!,
            p.bounds[corner & 2 ? 1 : 0][1]! + d[i * 4 + 1]!,
            p.bounds[corner & 4 ? 1 : 0][2]! + d[i * 4 + 2]!,
          )
          .project(this.camera);
        const x = ((projected.x + 1) * el.clientWidth) / 2;
        const y = ((1 - projected.y) * el.clientHeight) / 2;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
      projected
        .copy(this.centers[i]!)
        .add(new THREE.Vector3(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]))
        .project(this.camera);
      if (projected.z < -1 || projected.z > 1) return;
      this.targets.push({
        index: i,
        x: ((projected.x + 1) * el.clientWidth) / 2,
        y: ((1 - projected.y) * el.clientHeight) / 2,
        left,
        right,
        top,
        bottom,
      });
    });
  }

  private findTarget(x: number, y: number, radius: number): number {
    let best = -1;
    let score = Infinity;
    for (const t of this.targets) {
      const dx = Math.max(t.left - x, 0, x - t.right);
      const dy = Math.max(t.top - y, 0, y - t.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const candidate = distance + Math.hypot(t.x - x, t.y - y) * 0.025;
      if (candidate < score) {
        score = candidate;
        best = t.index;
      }
    }
    return best;
  }

  private pickAt(clientX: number, clientY: number, touch: boolean): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hasSolid = this.hasSolidVisible();
    const worldBox = new THREE.Box3();
    const hitPoint = new THREE.Vector3();
    let nearest = Infinity;
    let found = -1;
    this.pickers.forEach((mesh, i) => {
      if (!mesh || this.partData[i * 4 + 3]! < 0.5) return;
      if (hasSolid && this.atlas.parts[i]!.system === "integumentary") return;
      worldBox.copy(this.bounds[i]!).translate(mesh.position);
      if (!this.raycaster.ray.intersectBox(worldBox, hitPoint)) return;
      const hit = this.raycaster.intersectObject(mesh, false)[0];
      if (hit && hit.distance < nearest) {
        nearest = hit.distance;
        found = i;
      }
    });
    if (found < 0 && this.amount > 0.45) {
      found = this.findTarget(clientX - rect.left, clientY - rect.top, touch ? 24 : 16);
    }
    return found;
  }

  // ---------------------------------------------------------------------------------------------
  // Event handlers (arrow functions so they can be removed on dispose)

  private onControlsStart = (): void => {
    this.interacting = true;
    this.userDriven = true;
    this.tween = null;
  };

  private onControlsChange = (): void => {
    this.dirty = true;
    if (!this.userDriven) return;
    this.userCamera = true;
    clearTimeout(this.cameraTimer);
    // Wait for damping to settle before reporting the final pose.
    this.cameraTimer = setTimeout(() => {
      if (this.disposed) return;
      if (!this.interacting) this.userDriven = false;
      this.options.onCameraChange?.(this.getCamera());
    }, 300);
  };

  private onControlsEnd = (): void => {
    this.interacting = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.hover.hidden = true;
    this.tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === "touch" ? 12 : 5);
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.tap.move(e.pointerId, e.clientX, e.clientY);
    const canvas = this.renderer.domElement;
    if (e.buttons || this.amount < 0.5 || e.pointerType === "touch") {
      this.hover.hidden = true;
      return;
    }
    const rect = this.host.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const index = this.findTarget(x, y, 12);
    this.hover.hidden = index < 0;
    canvas.style.cursor = index < 0 ? "grab" : "pointer";
    if (index >= 0) {
      this.hover.textContent = this.atlas.parts[index]!.name;
      this.hover.style.left = `${Math.max(8, Math.min(x + 14, this.host.clientWidth - 260))}px`;
      this.hover.style.top = `${Math.max(8, Math.min(y + 18, this.host.clientHeight - 55))}px`;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const tapped = this.tap.up(e.pointerId, e.clientX, e.clientY);
    if (!tapped || !this.ready) return;
    const index = this.pickAt(e.clientX, e.clientY, e.pointerType === "touch");
    if (index >= 0) {
      this.hover.hidden = true;
      this.options.onPick?.(this.atlas.parts[index]!.id);
    }
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.tap.cancel(e.pointerId);
  };

  private onPointerLeave = (): void => {
    this.hover.hidden = true;
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.options.onError?.("The 3D view was paused by your device. Reload to continue.");
  };
}
