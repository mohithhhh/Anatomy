import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SystemId } from "../atlas/types.ts";
import type { ContentIndex, StudyItem } from "../content/content.ts";
import { EMPTY_CURATED, type CuratedData } from "../content/curated.ts";
import { track } from "../analytics.ts";
import { deckItems, type Deck } from "./decks.ts";
import { gradeTyped, type TypedGrade } from "./grading.ts";
import { buildQuestion, cardsFor, type CardRef, type Question } from "./questions.ts";
import { shuffle, seededRandom } from "./random.ts";
import { suggestRating, type CardState, type Grade } from "./scheduler.ts";
import {
  REQUEUE_WITHIN_MS,
  buildQueue,
  newIntroducedToday,
  recordAnswer,
  streakFrom,
  type DeckStats,
} from "./session.ts";
import { localDay, openStore, type ProgressStore } from "./store.ts";

export interface Answer {
  correct: boolean;
  chosen?: number;
  picked?: string;
  typed?: string;
  typedGrade?: TypedGrade;
  ms: number;
  suggested: Grade;
}

export interface Session {
  title: string;
  deckId: string | null;
  pool: readonly StudyItem[];
  systems: readonly SystemId[];
  queue: readonly CardRef[];
  position: number;
  question: Question | null;
  answer: Answer | null;
  shownAt: number;
  correct: number;
  answered: number;
}

export interface Summary {
  title: string;
  deckId: string | null;
  answered: number;
  correct: number;
  /** Earliest next due time among the cards reviewed. */
  nextDue: number | null;
}

/** A timed practical exam: tagged structures, typed answers, no feedback until the end. */
export interface Exam {
  title: string;
  stations: Question[];
  index: number;
  answers: { typed: string; grade: TypedGrade; ms: number }[];
  stationStart: number;
  /** Seconds per station. */
  seconds: number;
}

export const EXAM_STATIONS = 10;
export const EXAM_SECONDS = 60;

export interface Overview {
  streak: number;
  reviewedToday: number;
  stats: ReadonlyMap<string, DeckStats>;
}

const MAX_REQUEUES = 2;

export function useStudy(content: ContentIndex | null, curated: CuratedData = EMPTY_CURATED) {
  const store = useRef<ProgressStore | null>(null);
  const states = useRef(new Map<string, CardState>());
  const requeues = useRef(new Map<string, number>());
  const nextDues = useRef<number[]>([]);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [overview, setOverview] = useState<Overview>({
    streak: 0,
    reviewedToday: 0,
    stats: new Map(),
  });
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);

  useEffect(() => {
    const status = { cancelled: false };
    void openStore().then(async ({ store: opened, persistent: saved }) => {
      if (status.cancelled) return;
      store.current = opened;
      setPersistent(saved);
      setDecks(await opened.listDecks());
      setReady(true);
    });
    return () => {
      status.cancelled = true;
    };
  }, []);

  /** Recompute due and new counts for every deck. */
  const refresh = useCallback(async () => {
    const s = store.current;
    if (!s || !content) return;
    const now = Date.now();
    const list = await s.listDecks();
    const newToday = await newIntroducedToday(s, now);
    const stats = new Map<string, DeckStats>();
    for (const deck of list) {
      const cards = cardsFor(deckItems(content, deck), deck.types);
      const found = await s.getCards(cards.map((c) => c.id));
      stats.set(deck.id, buildQueue(cards, found, now, { newToday }).stats);
    }
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    setDecks(list);
    setOverview({
      streak: streakFrom(await s.reviewDays(), now),
      reviewedToday: (await s.reviewsSince(start.getTime())).length,
      stats,
    });
  }, [content]);

  useEffect(() => {
    if (ready && content) void refresh();
  }, [ready, content, refresh]);

  const saveDeck = useCallback(
    async (deck: Deck) => {
      await store.current?.putDeck(deck);
      track("Deck saved", { types: deck.types.join(","), regions: deck.regions.join(",") });
      await refresh();
    },
    [refresh],
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      await store.current?.deleteDeck(id);
      await refresh();
    },
    [refresh],
  );

  const question = useCallback(
    (card: CardRef, pool: readonly StudyItem[], systems: readonly SystemId[]) => {
      if (!content) return null;
      const reps = states.current.get(card.id)?.reps ?? 0;
      return buildQuestion(
        card,
        content.byConcept,
        pool,
        systems,
        `${localDay(Date.now())}:${reps}`,
        curated,
      );
    },
    [content, curated],
  );

  /** Start a session; cards whose question cannot be built are skipped. */
  const begin = useCallback(
    (
      title: string,
      deckId: string | null,
      queue: CardRef[],
      pool: readonly StudyItem[],
      systems: readonly SystemId[],
    ) => {
      requeues.current.clear();
      nextDues.current = [];
      setSummary(null);
      let position = 0;
      let first: Question | null = null;
      while (position < queue.length && !(first = question(queue[position]!, pool, systems))) {
        position++;
      }
      if (!first) {
        setSummary({ title, deckId, answered: 0, correct: 0, nextDue: null });
        return;
      }
      track("Study session started", { cards: queue.length });
      setSession({
        title,
        deckId,
        pool,
        systems,
        queue,
        position,
        question: first,
        answer: null,
        shownAt: Date.now(),
        correct: 0,
        answered: 0,
      });
    },
    [question],
  );

  const startDeck = useCallback(
    async (deck: Deck) => {
      const s = store.current;
      if (!s || !content) return;
      const now = Date.now();
      const pool = deckItems(content, deck);
      const cards = cardsFor(pool, deck.types);
      const found = await s.getCards(cards.map((c) => c.id));
      for (const [id, state] of found) states.current.set(id, state);
      const queue = buildQueue(cards, found, now, {
        newToday: await newIntroducedToday(s, now),
      });
      begin(deck.name, deck.id, queue.cards, pool, deck.systems);
    },
    [content, begin],
  );

  /** A short session about specific structures ("Quiz me on this"). */
  const startQuick = useCallback(
    async (title: string, items: readonly StudyItem[]) => {
      const s = store.current;
      if (!s || !content || items.length === 0) return;
      const first = items[0]!;
      const pool = content.items.filter(
        (i) => i.region === first.region && i.system === first.system,
      );
      const targets = new Set(items.map((i) => i.conceptId));
      const all = cardsFor(pool, ["name", "find", "side", "partOf", "spatial", "nerve"]).filter(
        (c) => targets.has(c.conceptId),
      );
      const random = seededRandom(Date.now());
      const queue =
        items.length === 1
          ? all
          : shuffle(
              all.filter((c) => c.type === "name" || c.type === "find"),
              random,
            );
      const found = await s.getCards(queue.map((c) => c.id));
      for (const [id, state] of found) states.current.set(id, state);
      begin(title, null, queue.slice(0, 12), pool, [...new Set(items.map((i) => i.system))]);
    },
    [content, begin],
  );

  const answerWith = useCallback((grade: (q: Question) => Omit<Answer, "ms" | "suggested">) => {
    setSession((s) => {
      if (!s?.question || s.answer) return s;
      const result = grade(s.question);
      const ms = Date.now() - s.shownAt;
      return { ...s, answer: { ...result, ms, suggested: suggestRating(result.correct, ms) } };
    });
  }, []);

  const answerChoice = useCallback(
    (index: number) => answerWith((q) => ({ correct: index === q.correctIndex, chosen: index })),
    [answerWith],
  );

  const answerTyped = useCallback(
    (text: string) =>
      answerWith((q) => {
        const typedGrade = gradeTyped(text, q.typedAnswer ?? q.options[q.correctIndex] ?? "");
        return { correct: typedGrade !== "wrong", typed: text, typedGrade };
      }),
    [answerWith],
  );

  const answerPick = useCallback(
    (partId: string | null) =>
      answerWith((q) => ({
        correct: partId !== null && q.correctParts.includes(partId),
        picked: partId ?? undefined,
      })),
    [answerWith],
  );

  const finish = useCallback(
    (s: Session) => {
      const nextDue = nextDues.current.length ? Math.min(...nextDues.current) : null;
      track("Study session finished", {
        answered: s.answered,
        correct: s.answered ? Math.round((s.correct / s.answered) * 100) : 0,
      });
      setSession(null);
      setSummary({
        title: s.title,
        deckId: s.deckId,
        answered: s.answered,
        correct: s.correct,
        nextDue,
      });
      void refresh();
    },
    [refresh],
  );

  /** Save the answer with the suggested (or overridden) rating and move on. */
  const next = useCallback(
    async (override?: Grade) => {
      const s = session;
      const st = store.current;
      if (!s?.answer || !st) return;
      const card = s.queue[s.position]!;
      const now = Date.now();
      const updated = await recordAnswer(
        st,
        card,
        states.current.get(card.id),
        override ?? s.answer.suggested,
        s.answer.correct,
        s.answer.ms,
        now,
      );
      states.current.set(card.id, updated);
      nextDues.current.push(updated.due);

      // Ask again later in this session if it is due again soon.
      let queue = s.queue;
      const times = requeues.current.get(card.id) ?? 0;
      if (updated.due - now < REQUEUE_WITHIN_MS && times < MAX_REQUEUES) {
        requeues.current.set(card.id, times + 1);
        const at = Math.min(queue.length, s.position + 4);
        queue = [...queue.slice(0, at), card, ...queue.slice(at)];
      }

      const counted = {
        ...s,
        queue,
        answered: s.answered + 1,
        correct: s.correct + (s.answer.correct ? 1 : 0),
      };
      let position = s.position + 1;
      let nextQuestion: Question | null = null;
      while (
        position < queue.length &&
        !(nextQuestion = question(queue[position]!, s.pool, s.systems))
      ) {
        position++;
      }
      if (!nextQuestion) {
        finish(counted);
        return;
      }
      setSession({
        ...counted,
        position,
        question: nextQuestion,
        answer: null,
        shownAt: Date.now(),
      });
    },
    [session, question, finish],
  );

  const exit = useCallback(() => {
    if (session && session.answered > 0) finish(session);
    else setSession(null);
  }, [session, finish]);

  const closeSummary = useCallback(() => setSummary(null), []);

  const startExam = useCallback(
    async (deck: Deck) => {
      if (!content || !store.current) return;
      const pool = deckItems(content, deck);
      const random = seededRandom(Date.now());
      const stations = shuffle(pool, random)
        .map((item) =>
          question(
            { id: `name:${item.conceptId}`, type: "name", conceptId: item.conceptId },
            pool,
            deck.systems,
          ),
        )
        .filter((q): q is Question => q !== null)
        .slice(0, EXAM_STATIONS);
      if (!stations.length) return;
      setSummary(null);
      setSession(null);
      track("Practical exam started", { stations: stations.length });
      setExam({
        title: deck.name,
        stations,
        index: 0,
        answers: [],
        stationStart: Date.now(),
        seconds: EXAM_SECONDS,
      });
    },
    [content, question],
  );

  /** Submit the current station (an empty answer counts as wrong) and move on. */
  const submitExam = useCallback((typed: string) => {
    setExam((e) => {
      if (!e || e.index >= e.stations.length) return e;
      const q = e.stations[e.index]!;
      const grade = gradeTyped(typed, q.typedAnswer ?? "");
      const ms = Date.now() - e.stationStart;
      const s = store.current;
      if (s) {
        const prev = states.current.get(q.card.id);
        void recordAnswer(
          s,
          q.card,
          prev,
          grade === "wrong" ? 1 : 3,
          grade !== "wrong",
          ms,
          Date.now(),
        ).then((updated) => states.current.set(q.card.id, updated));
      }
      return {
        ...e,
        index: e.index + 1,
        answers: [...e.answers, { typed, grade, ms }],
        stationStart: Date.now(),
      };
    });
  }, []);

  /** A normal session over the stations someone got wrong. */
  const reviewMissed = useCallback(
    (missed: Question[]) => {
      if (!content || !missed.length) return;
      const items = missed
        .map((q) => content.byConcept.get(q.card.conceptId))
        .filter((i): i is StudyItem => i !== undefined);
      const queue = items.flatMap((i) => [
        { id: `name:${i.conceptId}`, type: "name" as const, conceptId: i.conceptId },
        { id: `find:${i.conceptId}`, type: "find" as const, conceptId: i.conceptId },
      ]);
      begin(
        "Exam misses",
        null,
        queue,
        content.items.filter((i) =>
          items.some((m) => m.region === i.region && m.system === i.system),
        ),
        [...new Set(items.map((i) => i.system))],
      );
    },
    [content, begin],
  );

  const closeExam = useCallback(() => {
    setExam(null);
    void refresh();
  }, [refresh]);

  const dueTotal = useMemo(
    () => [...overview.stats.values()].reduce((n, s) => n + s.due, 0),
    [overview],
  );

  return {
    ready,
    persistent,
    decks,
    overview,
    dueTotal,
    session,
    summary,
    refresh,
    saveDeck,
    deleteDeck,
    startDeck,
    startQuick,
    answerChoice,
    answerTyped,
    answerPick,
    next,
    exit,
    closeSummary,
    exam,
    startExam,
    submitExam,
    closeExam,
    reviewMissed,
  };
}

export type Study = ReturnType<typeof useStudy>;
