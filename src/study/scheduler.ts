import { Rating, createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";

/** Card memory state as stored (dates as epoch milliseconds, so it serialises cleanly). */
export interface CardState {
  id: string;
  due: number;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
}

export interface ReviewLogEntry {
  id?: number;
  cardId: string;
  rating: Grade;
  correct: boolean;
  /** Epoch milliseconds. */
  at: number;
  /** Time spent answering. */
  ms: number;
  /** Whether this was the card's first review. */
  firstReview: boolean;
}

export { Rating };
export type { Grade };

const engine = fsrs({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 365 });

function toCard(state: CardState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.lastReview === null ? undefined : new Date(state.lastReview),
  } as Card;
}

function fromCard(id: string, card: Card): CardState {
  return {
    id,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

export function newCardState(id: string, now: number): CardState {
  return fromCard(id, createEmptyCard(new Date(now)));
}

/** Apply a rating and return the card's next state. */
export function review(state: CardState, rating: Grade, now: number): CardState {
  return fromCard(state.id, engine.next(toCard(state), new Date(now), rating).card);
}

/**
 * Suggested rating from the answer: wrong → Again, slow → Hard, otherwise Good. Learners can
 * override it ("That was easy", "I guessed").
 */
export function suggestRating(correct: boolean, ms: number): Grade {
  if (!correct) return Rating.Again;
  return ms > 20_000 ? Rating.Hard : Rating.Good;
}
