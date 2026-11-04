import type { CardRef } from "./questions.ts";
import { seededRandom, shuffle } from "./random.ts";
import { localDay, type ProgressStore } from "./store.ts";
import { newCardState, review, type CardState, type Grade } from "./scheduler.ts";

export const NEW_PER_DAY = 20;
export const SESSION_LIMIT = 30;

/** Core recognition first; relational questions once a structure is familiar. */
const TYPE_PRIORITY: Record<CardRef["type"], number> = {
  name: 0,
  find: 0,
  side: 1,
  partOf: 1,
  system: 2,
  spatial: 2,
  nerve: 2,
};

export interface DeckStats {
  total: number;
  due: number;
  newAvailable: number;
  learned: number;
}

export interface Queue {
  cards: CardRef[];
  stats: DeckStats;
}

/** How many cards were seen for the first time today (they count against the daily limit). */
export async function newIntroducedToday(store: ProgressStore, now: number): Promise<number> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const reviews = await store.reviewsSince(start.getTime());
  return reviews.filter((r) => r.firstReview).length;
}

/**
 * Due cards first (most overdue first), then new cards up to the daily limit, interleaved so
 * that both cards about one structure are not asked back to back.
 */
export function buildQueue(
  cards: readonly CardRef[],
  states: ReadonlyMap<string, CardState>,
  now: number,
  options: { newToday: number; newPerDay?: number; limit?: number; seed?: string },
): Queue {
  const newPerDay = options.newPerDay ?? NEW_PER_DAY;
  const limit = options.limit ?? SESSION_LIMIT;
  const due = cards
    .filter((c) => {
      const s = states.get(c.id);
      return s !== undefined && s.due <= now;
    })
    .sort((a, b) => states.get(a.id)!.due - states.get(b.id)!.due);
  const unseen = cards.filter((c) => !states.has(c.id));
  const random = seededRandom(options.seed ?? localDay(now));
  const ordered = shuffle(unseen, random).sort(
    (a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type],
  );
  // Spread cards for the same structure apart.
  const spread: CardRef[] = [];
  const deferred: CardRef[] = [];
  for (const card of ordered) {
    if (spread.slice(-3).some((c) => c.conceptId === card.conceptId)) deferred.push(card);
    else spread.push(card);
  }
  spread.push(...deferred);

  const newSlots = Math.max(0, newPerDay - options.newToday);
  const fresh = spread.slice(0, newSlots);
  return {
    cards: [...due, ...fresh].slice(0, limit),
    stats: {
      total: cards.length,
      due: due.length,
      newAvailable: Math.min(unseen.length, newSlots),
      learned: cards.length - unseen.length,
    },
  };
}

/** Record an answer: update the card's memory state and the review log. */
export async function recordAnswer(
  store: ProgressStore,
  card: CardRef,
  previous: CardState | undefined,
  rating: Grade,
  correct: boolean,
  ms: number,
  now: number,
): Promise<CardState> {
  const next = review(previous ?? newCardState(card.id, now), rating, now);
  await store.putCard(next);
  await store.addReview({
    cardId: card.id,
    rating,
    correct,
    at: now,
    ms,
    firstReview: previous === undefined,
  });
  return next;
}

/** Consecutive days with at least one review, ending today or yesterday. */
export function streakFrom(days: readonly string[], now: number): number {
  const set = new Set(days);
  const cursor = new Date(now);
  if (!set.has(localDay(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(localDay(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Re-ask a card later in the same session if it is due again within this many minutes. */
export const REQUEUE_WITHIN_MS = 15 * 60_000;
