import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { registerAtlasTools } from "@/agent/web-mcp";
import { trackVisit } from "@/analytics";
import { loadAtlas, loadHybridFemale, type AtlasIndex } from "@/atlas/atlas-index";
import { BODIES } from "@/atlas/model-source";
import type { Concept, SystemId } from "@/atlas/types";
import { buildContent, type StudyItem } from "@/content/content";
import type { CuratedData } from "@/content/curated";
import { definitionFor, loadDefinitions, type Definitions } from "@/content/definitions";
import musclesData from "../data/content/muscles.json";
import nervesData from "../data/content/nerves.json";
import { useUrlViewState } from "@/state/useUrlViewState";
import { DEFAULT_VIEW_STATE, orderSystems, type Selection } from "@/state/view-state";
import { decodeDeckLink, type Deck } from "@/study/decks";
import { COLORS } from "@/study/questions";
import { useStudy } from "@/study/useStudy";
import { AboutDialog } from "@/ui/AboutDialog";
import { DetailPanel } from "@/ui/DetailPanel";
import { Header } from "@/ui/Header";
import { LesionPanel } from "@/ui/LesionPanel";
import { ErrorStatus, LoadingStatus } from "@/ui/LoadingStatus";
import { SearchDialog } from "@/ui/SearchDialog";
import { SystemsPanel } from "@/ui/SystemsPanel";
import { ViewDock } from "@/ui/ViewDock";
import { ExamPanel } from "@/ui/study/ExamPanel";
import { QuizPanel } from "@/ui/study/QuizPanel";
import { SessionSummary } from "@/ui/study/SessionSummary";
import { StudyHome } from "@/ui/study/StudyHome";
import type {
  AnatomyViewer,
  CameraPose,
  Insets,
  SceneState,
  Slice,
  ViewPreset,
} from "@/viewer/AnatomyViewer";
import { ViewerCanvas } from "@/viewer/ViewerCanvas";

const EMPTY: readonly string[] = [];
const CURATED: CuratedData = {
  muscles: musclesData.muscles as CuratedData["muscles"],
  nerves: nervesData.nerves as CuratedData["nerves"],
};
const LESION_COLOR = "#dc2626";

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
  const { state: view, update, shareUrl } = useUrlViewState();
  const [index, setIndex] = useState<AtlasIndex | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [studying, setStudying] = useState(false);
  const [lesion, setLesion] = useState<string | null>(null);
  const [slice, setSlice] = useState<Slice | null>(null);
  const [definitions, setDefinitions] = useState<Definitions | null>(null);
  const [sharedDeck, setSharedDeck] = useState<Deck | null>(() =>
    decodeDeckLink(window.location.hash),
  );
  const [initialCamera] = useState<CameraPose | null>(view.camera);
  const [insets, setInsets] = useState<Insets>({ top: 96, right: 16, bottom: 120, left: 16 });

  const viewerRef = useRef<AnatomyViewer | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const systemsRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const studyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    trackVisit();
    void loadDefinitions().then(setDefinitions, () => {});
  }, []);

  // Load the chosen body; switching bodies replaces the atlas and the viewer.
  const body = view.body;
  useEffect(() => {
    const abort = new AbortController();
    const load =
      body === "female"
        ? loadHybridFemale(
            BODIES.female.atlasUrl,
            BODIES.female.base,
            BODIES.male.atlasUrl,
            BODIES.male.base,
            abort.signal,
          )
        : loadAtlas(BODIES[body].atlasUrl, abort.signal);
    load
      .then((loaded) => {
        setProgress(0);
        setReady(false);
        setIndex(loaded);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [body]);

  const switchBody = (next: "male" | "female") => {
    if (next === body) return;
    study.exit();
    study.closeSummary();
    setStudying(false);
    setLesion(null);
    setSlice(null);
    setIndex(null);
    update((s) => ({ ...DEFAULT_VIEW_STATE, body: next, visible: s.visible }));
  };

  const content = useMemo(() => (index ? buildContent(index, CURATED) : null), [index]);
  const study = useStudy(content, CURATED);
  const { session } = study;
  const { exam } = study;
  const examQuestion =
    exam && exam.index < exam.stations.length ? exam.stations[exam.index]! : null;
  const question = studying ? (session?.question ?? examQuestion) : null;
  const answer = studying ? (session?.answer ?? null) : null;

  useEffect(() => {
    viewerRef.current?.setSlice(studying ? null : slice);
  }, [slice, studying]);

  // A shared deck link (#study=1&…) saves the deck and opens study mode.
  useEffect(() => {
    const onHash = () => {
      const deck = decodeDeckLink(window.location.hash);
      if (deck) setSharedDeck(deck);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const { saveDeck } = study;
  useEffect(() => {
    if (!sharedDeck || !study.ready || !content) return;
    void saveDeck(sharedDeck).then(() => {
      setSharedDeck(null);
      setStudying(true);
    });
  }, [sharedDeck, study.ready, saveDeck, content]);

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

  const exploreScene = useMemo<SceneState>(
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

  // While studying, the question decides what is shown; nothing is selected.
  const studyScene = useMemo<SceneState>(
    () => ({
      visible: question?.visible ?? view.visible,
      selected: EMPTY,
      isolate: false,
      explode: 0,
      rotate: false,
      view: view.view,
    }),
    [question, view.visible, view.view],
  );
  // Lesion view: skeleton and muscles, with the denervated muscles in red.
  const lesionParts = useMemo(
    () =>
      lesion && content
        ? content.items.filter((i) => i.muscle?.n === lesion).flatMap((i) => i.partIds)
        : [],
    [lesion, content],
  );
  const lesionScene = useMemo<SceneState>(
    () => ({
      visible: ["skeletal", "muscular"],
      selected: EMPTY,
      isolate: false,
      explode: 0,
      rotate: false,
      view: view.view,
    }),
    [view.view],
  );
  const scene = studying ? studyScene : lesion ? lesionScene : exploreScene;

  useEffect(() => {
    if (studying) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (lesion) {
      viewer.setHighlights(new Map(lesionParts.map((id) => [id, LESION_COLOR])));
      viewer.flyTo(lesionParts);
    } else viewer.setHighlights(null);
  }, [lesion, lesionParts, studying]);

  // Quiz highlights and camera moves.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (!question) {
      viewer.setHighlights(null);
      return;
    }
    if (question.kind === "pick" && answer) {
      const colors = new Map<string, string>(
        question.correctParts.map((id) => [id, COLORS.correct]),
      );
      if (answer.picked && !answer.correct) colors.set(answer.picked, COLORS.wrong);
      viewer.setHighlights(colors);
    } else {
      viewer.setHighlights(question.highlight);
    }
  }, [question, answer]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !question) return;
    // "Find it" shows the deck's whole region; other questions frame the target with context.
    if (question.kind === "pick") {
      const region = session?.pool.flatMap((i) => i.partIds) ?? [];
      if (region.length) viewer.flyTo(region);
      else viewer.refit();
    } else viewer.flyTo(question.focus, { minSize: 0.35 });
    // Only when the question changes, not on every session update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  useEffect(() => {
    if (question?.kind === "pick" && answer) {
      viewerRef.current?.flyTo(question.correctParts, { minSize: 0.35 });
    }
  }, [question, answer]);

  // Back to exploring: clear quiz tints and restore the explore camera.
  useEffect(() => {
    if (studying) return;
    const viewer = viewerRef.current;
    viewer?.setHighlights(null);
  }, [studying]);

  const visibleCount = useMemo(() => {
    if (!index) return 0;
    if (exploreScene.isolate) return exploreScene.selected.length;
    const shown = new Set(exploreScene.visible);
    const selected = new Set(exploreScene.selected);
    return index.atlas.parts.filter((p) => shown.has(p.system) || selected.has(p.id)).length;
  }, [index, exploreScene]);

  // Tell the viewer which screen area is free of panels, so framed parts land in the clear.
  useLayoutEffect(() => {
    const measure = () => {
      const gap = 12;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const header = headerRef.current?.getBoundingClientRect();
      const next: Insets = {
        top: Math.round((header?.bottom ?? 84) + gap),
        right: 16,
        bottom: 16,
        left: 16,
      };
      for (const ref of [systemsRef, detailRef, dockRef, studyRef]) {
        const r = ref.current?.getBoundingClientRect();
        if (!r || r.width === 0 || r.height === 0) continue;
        if (r.width > w * 0.6 || r.top > h * 0.45) {
          next.bottom = Math.max(next.bottom, Math.round(h - r.top + gap));
        } else if (r.left > w / 2) {
          next.right = Math.max(next.right, Math.round(w - r.left + gap));
        } else {
          next.left = Math.max(next.left, Math.round(r.right + gap));
        }
      }
      setInsets((prev) => (sameInsets(prev, next) ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  const onPick = useCallback(
    (id: string) => {
      if (studying) {
        if (session?.question?.kind === "pick" && !session.answer) study.answerPick(id);
        return;
      }
      setRotate(false);
      update({ selection: { kind: "part", id }, isolate: false });
    },
    [studying, session, study, update],
  );

  // "/" opens search; Escape clears the selection. Ignored while typing or studying.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const dialogOpen = document.querySelector('[aria-modal="true"]') !== null;
      if (studying || typing || dialogOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        update((s) => (s.selection ? { ...s, selection: null, isolate: false } : s));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [update, studying]);

  const selectConcept = (conceptId: string) => {
    if (!index) return;
    const concept = index.concepts.get(conceptId);
    if (!concept) return;
    setRotate(false);
    update((s) => ({
      ...s,
      selection: { kind: "concept", id: concept.id },
      isolate: false,
      explode: 0,
    }));
    viewerRef.current?.flyTo(concept.elements);
  };

  const chooseConcept = (concept: Concept) => {
    setSearchOpen(false);
    setSystemsOpen(false);
    setStudying(false);
    selectConcept(concept.id);
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
      if (studying) return;
      update((s) => (s.explode === 0 && !s.isolate ? { ...s, camera: pose } : s));
    },
    [update, studying],
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

  const toggleStudy = () => {
    if (studying) {
      study.exit();
      study.closeSummary();
      setStudying(false);
      if (view.camera) viewerRef.current?.setCamera(view.camera);
      else viewerRef.current?.refit();
    } else {
      setSearchOpen(false);
      setSystemsOpen(false);
      setRotate(false);
      setStudying(true);
      void study.refresh();
    }
  };

  // Study content for the selected structure (info panel and "Quiz me on this").
  const detailInfo = useMemo(() => {
    if (!content || !view.selection || selectedParts.length === 0) return null;
    const conceptId =
      view.selection.kind === "concept"
        ? view.selection.id
        : index?.parts.get(view.selection.id)?.conceptId;
    if (!conceptId) return null;
    const item =
      view.selection.kind === "part"
        ? content.byPart.get(view.selection.id)
        : content.byConcept.get(conceptId);
    const inSelection = new Set(selectedParts);
    const quizItems: StudyItem[] = item
      ? [item]
      : content.items.filter((i) => i.partIds.every((id) => inSelection.has(id)));
    return {
      item,
      regions: item ? [item.region] : content.regionsOfConcept(conceptId),
      groups: content.breadcrumb(conceptId),
      siblings: item ? content.siblings(item.conceptId) : [],
      quizItems,
      quizCount: Math.min(quizItems.length, 12),
      definition: index ? definitionFor(definitions, index, conceptId) : null,
    };
  }, [content, index, view.selection, selectedParts, definitions]);

  const quizSelection = () => {
    if (!detailInfo || detailInfo.quizItems.length === 0) return;
    // Never title the session with the structure's name: that would give the answers away.
    const title = "Quick quiz";
    setStudying(true);
    void study.startQuick(title, detailInfo.quizItems);
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden select-none">
      {index && (
        <ViewerCanvas
          atlas={index.atlas}
          modelBase={BODIES[body].base}
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
        pieces={index?.atlas.parts.length ?? 0}
        body={body}
        onBody={switchBody}
        studying={studying}
        due={study.dueTotal}
        onSearch={() => setSearchOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onToggleStudy={toggleStudy}
      />

      {!studying && (
        <>
          {index && (
            <SystemsPanel
              ref={systemsRef}
              index={index}
              visible={view.visible}
              visibleCount={visibleCount}
              open={systemsOpen}
              onClose={() => setSystemsOpen(false)}
              onChange={setVisible}
              onLesions={() => {
                setSystemsOpen(false);
                update({ selection: null, isolate: false });
                setLesion("radial");
              }}
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
            slice={slice}
            onSlice={setSlice}
          />

          <p className="pointer-events-none absolute bottom-6 left-4 z-10 hidden text-xs text-ink-faint xl:block">
            {view.explode > 0.8 ? "Drag to pan" : "Drag to orbit"} · Scroll to zoom · Click a
            structure
          </p>

          {lesion && content && (
            <LesionPanel
              ref={detailRef}
              curated={CURATED}
              nerveId={lesion}
              affected={content.items.filter((i) => i.muscle?.n === lesion)}
              onChange={setLesion}
              onSelect={(id) => {
                setLesion(null);
                selectConcept(id);
              }}
              onClose={() => setLesion(null)}
            />
          )}

          {!lesion && index && view.selection && selectedParts.length > 0 && (
            <DetailPanel
              key={view.selection.id}
              ref={detailRef}
              index={index}
              selection={view.selection}
              partIds={selectedParts}
              isolated={exploreScene.isolate}
              onIsolate={setIsolate}
              onSelectPart={(id) => update({ selection: { kind: "part", id }, isolate: false })}
              onClose={() => update({ selection: null, isolate: false })}
              onCopyLink={copyLink}
              info={detailInfo}
              onSelectConcept={selectConcept}
              onQuiz={quizSelection}
              curated={CURATED}
              onLesion={(nerveId) => {
                update({ selection: null, isolate: false });
                setLesion(nerveId);
              }}
            />
          )}
        </>
      )}

      {studying && index && content && ready && (
        <>
          {exam ? (
            <ExamPanel ref={studyRef} study={study} />
          ) : session ? (
            <QuizPanel ref={studyRef} study={study} />
          ) : study.summary ? (
            <SessionSummary
              summary={study.summary}
              streak={study.overview.streak}
              onDone={study.closeSummary}
            />
          ) : (
            <StudyHome
              ref={studyRef}
              index={index}
              content={content}
              study={study}
              onClose={toggleStudy}
              curated={CURATED}
              definitions={definitions}
            />
          )}
        </>
      )}

      {searchOpen && index && (
        <SearchDialog index={index} onChoose={chooseConcept} onClose={() => setSearchOpen(false)} />
      )}

      {aboutOpen && (
        <AboutDialog
          pieces={index?.atlas.parts.length ?? 0}
          body={body}
          concepts={index?.atlas.concepts.length ?? 3432}
          onClose={() => setAboutOpen(false)}
        />
      )}

      {!ready && !error && <LoadingStatus progress={progress} />}
      {error && <ErrorStatus message={error} />}
    </main>
  );
}
