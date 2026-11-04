import { Dexie, type Table } from "dexie";
import type { Deck } from "./decks.ts";
import type { CardState, ReviewLogEntry } from "./scheduler.ts";

/** Where study progress lives. Local to the device; no account. */
export interface ProgressStore {
  getCards(ids: readonly string[]): Promise<Map<string, CardState>>;
  putCard(card: CardState): Promise<void>;
  addReview(entry: ReviewLogEntry): Promise<void>;
  reviewsSince(time: number): Promise<ReviewLogEntry[]>;
  /** Local dates ("2026-11-04") with at least one review, newest first. */
  reviewDays(): Promise<string[]>;
  listDecks(): Promise<Deck[]>;
  putDeck(deck: Deck): Promise<void>;
  deleteDeck(id: string): Promise<void>;
}

export function localDay(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

class StudyDatabase extends Dexie {
  cards!: Table<CardState, string>;
  reviews!: Table<ReviewLogEntry, number>;
  decks!: Table<Deck, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      cards: "id, due",
      reviews: "++id, cardId, at",
      decks: "id, createdAt",
    });
  }
}

export class IndexedDbStore implements ProgressStore {
  private db: StudyDatabase;

  constructor(name = "anatomy-study") {
    this.db = new StudyDatabase(name);
  }

  async getCards(ids: readonly string[]) {
    const found = await this.db.cards.bulkGet([...ids]);
    return new Map(found.filter((c) => c !== undefined).map((c) => [c.id, c]));
  }

  async putCard(card: CardState) {
    await this.db.cards.put(card);
  }

  async addReview(entry: ReviewLogEntry) {
    const { id: _ignored, ...rest } = entry;
    await this.db.reviews.add(rest);
  }

  reviewsSince(time: number) {
    return this.db.reviews.where("at").aboveOrEqual(time).toArray();
  }

  async reviewDays() {
    const times = (await this.db.reviews.orderBy("at").keys()) as number[];
    return [...new Set(times.toReversed().map(localDay))];
  }

  listDecks() {
    return this.db.decks.orderBy("createdAt").toArray();
  }

  async putDeck(deck: Deck) {
    await this.db.decks.put(deck);
  }

  async deleteDeck(id: string) {
    await this.db.decks.delete(id);
  }
}

/** In-memory store for tests, and a fallback when IndexedDB is unavailable (private mode). */
export class MemoryStore implements ProgressStore {
  cards = new Map<string, CardState>();
  reviews: ReviewLogEntry[] = [];
  decks = new Map<string, Deck>();

  async getCards(ids: readonly string[]) {
    return new Map(ids.flatMap((id) => (this.cards.has(id) ? [[id, this.cards.get(id)!]] : [])));
  }
  async putCard(card: CardState) {
    this.cards.set(card.id, card);
  }
  async addReview(entry: ReviewLogEntry) {
    this.reviews.push({ ...entry, id: this.reviews.length + 1 });
  }
  async reviewsSince(time: number) {
    return this.reviews.filter((r) => r.at >= time);
  }
  async reviewDays() {
    return [...new Set(this.reviews.toSorted((a, b) => b.at - a.at).map((r) => localDay(r.at)))];
  }
  async listDecks() {
    return [...this.decks.values()].sort((a, b) => a.createdAt - b.createdAt);
  }
  async putDeck(deck: Deck) {
    this.decks.set(deck.id, deck);
  }
  async deleteDeck(id: string) {
    this.decks.delete(id);
  }
}

/** IndexedDB when it works, otherwise memory (progress then lasts only for this visit). */
export async function openStore(): Promise<{ store: ProgressStore; persistent: boolean }> {
  try {
    const store = new IndexedDbStore();
    await store.listDecks();
    return { store, persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}
