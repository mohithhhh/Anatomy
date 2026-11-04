import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { loadAtlas, type AtlasIndex } from "@/atlas/atlas-index";
import { ATLAS_URL, MODEL_BASE } from "@/atlas/model-source";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useUrlViewState } from "@/state/useUrlViewState";
import { DEFAULT_VIEW_STATE, orderSystems, type Selection } from "@/state/view-state";
import { ErrorStatus, LoadingStatus } from "@/ui/LoadingStatus";
import { Header } from "@/ui/Header";
import { SearchDialog } from "@/ui/SearchDialog";
import { SystemsPanel } from "@/ui/SystemsPanel";
import { ViewDock } from "@/ui/ViewDock";
import type {
  AnatomyViewer,
  CameraPose,
  Insets,
  SceneState,
  ViewPreset,
} from "@/viewer/AnatomyViewer";
import { ViewerCanvas } from "@/viewer/ViewerCanvas";
import type { Concept, SystemId } from "@/atlas/types";

const EMPTY: readonly string[] = [];

/** Part IDs for a selection, or an empty list when it does not exist in this atlas. */
function resolveSelection(index: AtlasIndex | null, selection: Selection | null) {
  if (!index || !selection) return EMPTY;
  if (selection.kind === "part") return index.parts.has(selection.id) ? [selection.id] : EMPTY;
  return index.concepts.get(selection.id)?.elements ?? EMPTY;
}

function sameInsets(a: Insets, b: Insets) {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

export default function App() {
  const desktop = useIsDesktop();
  const { state: view, update } = useUrlViewState();
  const [index, setIndex] = useState<AtlasIndex | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [initialCamera] = useState<CameraPose | null>(view.camera);
  const [insets, setInsets] = useState<Insets>({ top: 96, right: 16, bottom: 120, left: 16 });

  const viewerRef = useRef<AnatomyViewer | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const systemsRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    loadAtlas(ATLAS_URL, abort.signal)
      .then(setIndex)
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, []);

  const selectedParts = useMemo(
    () => resolveSelection(index, view.selection),
    [index, view.selection],
  );

  // A link may name a structure that does not exist (typo, older model). Drop it quietly.
  useEffect(() => {
    if (index && view.selection && selectedParts.length === 0) {
      update({ selection: null, isolate: false });
    }
  }, [index, view.selection, selectedParts, update]);

  const scene = useMemo<SceneState>(
    () => ({
      visible: view.visible,
      selected: selectedParts,
      isolate: view.isolate && selectedParts.length > 0,
      explode: view.explode,
      rotate,
      view: view.view,
    }),
    [view.visible, view.isolate, view.explode, view.view, selectedParts, rotate],
  );

  const visibleCount = useMemo(() => {
    if (!index) return 0;
    if (scene.isolate) return scene.selected.length;
    const shown = new Set(scene.visible);
    const selected = new Set(scene.selected);
    return index.atlas.parts.filter((p) => shown.has(p.system) || selected.has(p.id)).length;
  }, [index, scene]);

  // Tell the viewer which screen area is free of panels, so isolated parts frame in the clear.
  useLayoutEffect(() => {
    const measure = () => {
      const gap = 12;
      const h = window.innerHeight;
      const header = headerRef.current?.getBoundingClientRect();
      const dock = dockRef.current?.getBoundingClientRect();
      const systems = systemsRef.current?.getBoundingClientRect();
      const next: Insets = {
        top: Math.round((header?.bottom ?? 84) + gap),
        bottom: Math.round(h - (dock?.top ?? h - 110) + gap),
        left: desktop && systems?.width ? Math.round(systems.right + gap) : 16,
        right: 16,
      };
      setInsets((prev) => (sameInsets(prev, next) ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  const onPick = useCallback(
    (id: string) => {
      setRotate(false);
      update({ selection: { kind: "part", id }, isolate: false });
    },
    [update],
  );

  // "/" opens search from anywhere except text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chooseConcept = (concept: Concept) => {
    setSearchOpen(false);
    setSystemsOpen(false);
    setRotate(false);
    update((s) => ({
      ...s,
      selection: { kind: "concept", id: concept.id },
      isolate: false,
      explode: 0,
    }));
    viewerRef.current?.flyTo(concept.elements);
  };

  const onCameraChange = useCallback(
    (pose: CameraPose) => {
      update((s) => (s.explode === 0 && !s.isolate ? { ...s, camera: pose } : s));
    },
    [update],
  );

  const setVisible = (visible: SystemId[]) =>
    update({ visible: orderSystems(visible), selection: null, isolate: false });

  const setExplode = (explode: number) => {
    setRotate(false);
    update((s) => ({ ...s, explode, camera: null, view: explode > 0.8 ? "front" : s.view }));
  };

  const setViewPreset = (preset: ViewPreset) => {
    setRotate(false);
    update({ view: preset, camera: null });
    viewerRef.current?.refit();
  };

  const reset = () => {
    setRotate(false);
    setSystemsOpen(false);
    update(DEFAULT_VIEW_STATE);
    viewerRef.current?.refit();
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden select-none">
      {index && (
        <ViewerCanvas
          atlas={index.atlas}
          modelBase={MODEL_BASE}
          state={scene}
          insets={insets}
          initialCamera={initialCamera}
          viewerRef={viewerRef}
          onPick={onPick}
          onProgress={setProgress}
          onReady={() => setReady(true)}
          onError={setError}
          onCameraChange={onCameraChange}
        />
      )}

      <Header
        ref={headerRef}
        pieces={index?.atlas.parts.length ?? 2234}
        onSearch={() => setSearchOpen(true)}
        onAbout={() => {}}
      />

      {index && (
        <SystemsPanel
          ref={systemsRef}
          index={index}
          visible={view.visible}
          visibleCount={visibleCount}
          open={systemsOpen}
          onClose={() => setSystemsOpen(false)}
          onChange={setVisible}
        />
      )}

      <ViewDock
        ref={dockRef}
        explode={view.explode}
        view={view.view}
        rotate={rotate}
        onExplode={setExplode}
        onView={setViewPreset}
        onRotate={() => setRotate((r) => !r)}
        onReset={reset}
        onSystems={() => setSystemsOpen((o) => !o)}
      />

      <p className="pointer-events-none absolute bottom-6 left-4 z-10 hidden text-xs text-ink-faint xl:block">
        {view.explode > 0.8 ? "Drag to pan" : "Drag to orbit"} · Scroll to zoom · Click a structure
      </p>

      {searchOpen && index && (
        <SearchDialog index={index} onChoose={chooseConcept} onClose={() => setSearchOpen(false)} />
      )}

      {!ready && !error && <LoadingStatus progress={progress} />}
      {error && <ErrorStatus message={error} />}
    </main>
  );
}
