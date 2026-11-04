import { DEFAULT_VISIBLE, SYSTEM_IDS, isSystemId } from "@/atlas/systems";
import type { SystemId } from "@/atlas/types";
import type { CameraPose, ViewPreset } from "@/viewer/AnatomyViewer";

/** A concept groups one or more meshes; a part is a single mesh. */
export type Selection = { kind: "concept"; id: string } | { kind: "part"; id: string };

/**
 * Everything needed to reproduce what a person is looking at. It is serialised into the URL
 * hash, so a copied link reopens the same view.
 */
export interface ViewState {
  visible: readonly SystemId[];
  selection: Selection | null;
  isolate: boolean;
  /** 0–1 */
  explode: number;
  view: ViewPreset;
  /** Only set after the user moves the camera themselves. */
  camera: CameraPose | null;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  visible: DEFAULT_VISIBLE,
  selection: null,
  isolate: false,
  explode: 0,
  view: "three-quarter",
  camera: null,
};

const VIEWS: readonly ViewPreset[] = ["three-quarter", "front", "side", "back"];
const VIEW_CODES: Record<ViewPreset, string> = {
  "three-quarter": "34",
  front: "front",
  side: "side",
  back: "back",
};
// FMA concepts look like FMA9611; BodyParts3D meshes like FJ1252 or FJ1452M.
const ID_PATTERN = /^[A-Z]{2,4}\d{1,8}[A-Z]?$/;

function sameSystems(a: readonly SystemId[], b: readonly SystemId[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Keep the canonical display order so equal sets always encode the same way. */
export function orderSystems(ids: Iterable<SystemId>): SystemId[] {
  const set = new Set(ids);
  return SYSTEM_IDS.filter((id) => set.has(id));
}

export function encodeViewState(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.selection) {
    params.set(state.selection.kind === "concept" ? "c" : "p", state.selection.id);
  }
  if (state.isolate && state.selection) params.set("iso", "1");
  if (!sameSystems(state.visible, DEFAULT_VISIBLE)) {
    params.set("sys", state.visible.length ? orderSystems(state.visible).join(",") : "none");
  }
  const explode = Math.round(state.explode * 100);
  if (explode > 0) params.set("x", String(explode));
  if (state.view !== DEFAULT_VIEW_STATE.view) params.set("v", VIEW_CODES[state.view]);
  if (state.camera) {
    params.set("cam", [...state.camera.position, ...state.camera.target].join(","));
  }
  // Commas are safe in a fragment; keep links readable.
  return params.toString().replaceAll("%2C", ",");
}

function decodeCamera(value: string | null): CameraPose | null {
  if (!value) return null;
  const numbers = value.split(",").map(Number);
  if (numbers.length !== 6 || numbers.some((n) => !Number.isFinite(n) || Math.abs(n) > 50)) {
    return null;
  }
  const [px, py, pz, tx, ty, tz] = numbers as [number, number, number, number, number, number];
  if (Math.hypot(px - tx, py - ty, pz - tz) < 0.01) return null;
  return { position: [px, py, pz], target: [tx, ty, tz] };
}

/** Parse a URL hash. Anything malformed falls back to the default for that field. */
export function decodeViewState(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const concept = params.get("c");
  const part = params.get("p");
  const selection: Selection | null =
    concept && ID_PATTERN.test(concept)
      ? { kind: "concept", id: concept }
      : part && ID_PATTERN.test(part)
        ? { kind: "part", id: part }
        : null;

  const sys = params.get("sys");
  const visible =
    sys === null
      ? DEFAULT_VISIBLE
      : sys === "none"
        ? []
        : orderSystems(sys.split(",").filter(isSystemId));

  const explodeValue = Number(params.get("x") ?? 0);
  const explode = Number.isFinite(explodeValue)
    ? Math.min(100, Math.max(0, Math.round(explodeValue))) / 100
    : 0;

  const viewCode = params.get("v");
  const view = VIEWS.find((v) => VIEW_CODES[v] === viewCode) ?? DEFAULT_VIEW_STATE.view;

  return {
    visible,
    selection,
    isolate: params.get("iso") === "1" && selection !== null,
    explode,
    view,
    // A free camera only makes sense for the assembled, non-isolated body.
    camera: explode === 0 && params.get("iso") !== "1" ? decodeCamera(params.get("cam")) : null,
  };
}
