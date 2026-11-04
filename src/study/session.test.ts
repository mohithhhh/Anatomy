import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { CardRef } from "./questions.ts";
import { Rating, newCardState, review, suggestRating } from "./scheduler.ts";
import { buildQueue, newIntroducedToday, recordAnswer, streakFrom } from "./session.ts";
import { IndexedDbStore, MemoryStore, localDay } from "./store.ts";

const NOW = new Date("2026-11-04T10:00:00").getTime();
const DAY = 86_400_000;
const card = (n: number, type: CardRef["type"] = "name"): CardRef => ({
  id: `${type}:FMA${n}`,
  type,
  conceptId: `FMA${n}`,
});

describe("scheduler", () => {
  it("schedules a correct answer later than a wrong one", () => {
    const fresh = newCardState("name:FMA1", NOW);
    const good = review(fresh, Rating.Good, NOW);
    const again = review(fresh, Rating.Again, NOW);
    expect(good.due).toBeGreaterThan(again.due);
    expect(good.reps).toBe(1);
  });

  it("grows the interval with repeated success", () => {
    let state = newCardState("name:FMA1", NOW);
    let time = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = review(state, Rating.Good, time);
      intervals.push(state.due - time);
      time = state.due;
    }
    expect(intervals[3]!).toBeGreaterThan(intervals[1]!);
    expect(intervals[3]!).toBeGreaterThan(DAY);
  });

  it("suggests ratings from correctness and time", () => {
    expect(suggestRating(false, 1000)).toBe(Rating.Again);
    expect(suggestRating(true, 5000)).toBe(Rating.Good);
    expect(suggestRating(true, 30_000)).toBe(Rating.Hard);
  });
});

describe("buildQueue", () => {
  const cards = Array.from({ length: 60 }, (_, i) => card(i));

  it("puts due cards first, then new cards up to the daily limit", () => {
    const states = new Map([
      ["name:FMA5", { ...newCardState("name:FMA5", NOW), due: NOW - 2 * DAY, reps: 2, state: 2 }],
      ["name:FMA6", { ...newCardState("name:FMA6", NOW), due: NOW - DAY, reps: 2, state: 2 }],
      ["name:FMA7", { ...newCardState("name:FMA7", NOW), due: NOW + DAY, reps: 2, state: 2 }],
    ]);
    const queue = buildQueue(cards, states, NOW, { newToday: 5, newPerDay: 20 });
    expect(queue.cards[0]!.id).toBe("name:FMA5");
    expect(queue.cards[1]!.id).toBe("name:FMA6");
    expect(queue.cards.map((c) => c.id)).not.toContain("name:FMA7");
    expect(queue.stats).toEqual({ total: 60, due: 2, newAvailable: 15, learned: 3 });
    expect(queue.cards.length).toBe(17);
  });

  it("stops introducing new cards once the daily limit is reached", () => {
    const queue = buildQueue(cards, new Map(), NOW, { newToday: 20, newPerDay: 20 });
    expect(queue.cards).toEqual([]);
  });

  it("spreads cards about the same structure apart", () => {
    const pairs = Array.from({ length: 10 }, (_, i) => [card(i, "name"), card(i, "find")]).flat();
    const queue = buildQueue(pairs, new Map(), NOW, { newToday: 0, newPerDay: 20 });
    for (let i = 1; i < queue.cards.length; i++) {
      expect(queue.cards[i]!.conceptId).not.toBe(queue.cards[i - 1]!.conceptId);
    }
  });
});

describe("recording answers", () => {
  for (const [label, make] of [
    ["memory", () => new MemoryStore()],
    ["IndexedDB", () => new IndexedDbStore(`test-${Math.random()}`)],
  ] as const) {
    it(`saves state and counts new cards (${label} store)`, async () => {
      const store = make();
      const first = await recordAnswer(store, card(1), undefined, Rating.Good, true, 2000, NOW);
      await recordAnswer(store, card(1), first, Rating.Good, true, 1500, NOW + 60_000);
      await recordAnswer(store, card(2), undefined, Rating.Again, false, 4000, NOW + 120_000);
      const saved = await store.getCards(["name:FMA1", "name:FMA2", "name:FMA3"]);
      expect([...saved.keys()].sort()).toEqual(["name:FMA1", "name:FMA2"]);
      expect(saved.get("name:FMA1")!.reps).toBe(2);
      expect(await newIntroducedToday(store, NOW + 180_000)).toBe(2);
      expect(await store.reviewDays()).toEqual([localDay(NOW)]);
    });
  }
});

describe("streakFrom", () => {
  it("counts consecutive days ending today or yesterday", () => {
    const days = [0, 1, 2, 4].map((n) => localDay(NOW - n * DAY));
    expect(streakFrom(days, NOW)).toBe(3);
    expect(streakFrom(days.slice(1), NOW)).toBe(2);
    expect(streakFrom([], NOW)).toBe(0);
  });
});
