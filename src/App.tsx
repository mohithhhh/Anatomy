import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { registerAtlasTools } from "@/agent/web-mcp";
import { loadAtlas, type AtlasIndex } from "@/atlas/atlas-index";
import { ATLAS_URL, MODEL_BASE } from "@/atlas/model-source";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useUrlViewState } from "@/state/useUrlViewState";
import { DEFAULT_VIEW_STATE, orderSystems, type Selection } from "@/state/view-state";
import { ErrorStatus, LoadingStatus } from "@/ui/LoadingStatus";
import { Header } from "@/ui/Header";
import { AboutDialog } from "@/ui/AboutDialog";
import { DetailPanel } from "@/ui/DetailPanel";
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
  const { state: view, update, shareUrl } = useUrlViewState();
  const [index, setIndex] = useState<AtlasIndex | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [initialCamera] = useState<CameraPose | null>(view.camera);
  const [insets, setInsets] = useState<Insets>({ top: 96, right: 16, bottom: 120, left: 16 });

  const viewerRef = useRef<AnatomyViewer | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const systemsRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);

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
      const detail = detailRef.current?.getBoundingClientRect();
      const w = window.innerWidth;
      let bottom = h - (dock?.top ?? h - 110) + gap;
      if (!desktop && detail?.height) bottom = Math.max(bottom, h - detail.top + gap);
      const next: Insets = {
        top: Math.round((header?.bottom ?? 84) + gap),
        bottom: Math.round(bottom),
        left: desktop && systems?.width ? Math.round(systems.right + gap) : 16,
        right: desktop && detail?.width ? Math.round(w - detail.left + gap) : 16,
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

  // "/" opens search; Escape clears the selection. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const dialogOpen = document.querySelector('[aria-modal="true"]') !== null;
      if (typing || dialogOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        update((s) => (s.selection ? { ...s, selection: null, isolate: false } : s));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [update]);

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

  // Let WebMCP-capable AI agents search and open structures for the user.
  const chooseRef = useRef(chooseConcept);
  useLayoutEffect(() => {
    chooseRef.current = chooseConcept;
  });
  useEffect(() => {
    if (!index) return;
    return registerAtlasTools(index, (concept) => chooseRef.current(concept));
  }, [index]);

  const onCameraChange = useCallback(
    (pose: CameraPose) => {
      update((s) => (s.explode === 0 && !s.isolate ? { ...s, camera: pose } : s));
    },
    [update],
  );

  const setIsolate = (isolate: boolean) => {
    setRotate(false);
    update((s) => ({ ...s, isolate, explode: 0, camera: null }));
  };

  const copyLink = async () => {
    const url = shareUrl(view);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

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
        onAbout={() => setAboutOpen(true)}
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

      {index && view.selection && selectedParts.length > 0 && (
        <DetailPanel
          ref={detailRef}
          index={index}
          selection={view.selection}
          partIds={selectedParts}
          isolated={scene.isolate}
          onIsolate={setIsolate}
          onSelectPart={(id) => update({ selection: { kind: "part", id }, isolate: false })}
          onClose={() => update({ selection: null, isolate: false })}
          onCopyLink={copyLink}
        />
      )}

      {searchOpen && index && (
        <SearchDialog index={index} onChoose={chooseConcept} onClose={() => setSearchOpen(false)} />
      )}

      {aboutOpen && (
        <AboutDialog
          pieces={index?.atlas.parts.length ?? 2234}
          concepts={index?.atlas.concepts.length ?? 3432}
          onClose={() => setAboutOpen(false)}
        />
      )}

      {!ready && !error && <LoadingStatus progress={progress} />}
      {error && <ErrorStatus message={error} />}
    </main>
  );
}
