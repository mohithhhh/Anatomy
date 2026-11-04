import { SYSTEM_BY_ID } from "../atlas/systems.ts";
import type { SystemId } from "../atlas/types.ts";
import type { StudyItem } from "../content/content.ts";
import { EMPTY_CURATED, nerveName, type CuratedData } from "../content/curated.ts";
import type { QuestionType } from "./decks.ts";
import { seededRandom, shuffle } from "./random.ts";

export type Axis = "vertical" | "depth" | "medial";

/** A schedulable card. Its ID is stable, so progress survives deck changes. */
export interface CardRef {
  id: string;
  type: QuestionType;
  conceptId: string;
  /** Spatial cards compare two structures. */
  otherId?: string;
  axis?: Axis;
}

export const COLORS = {
  target: "#f59e0b",
  other: "#8b5cf6",
  correct: "#16a34a",
  wrong: "#dc2626",
} as const;

export interface Question {
  card: CardRef;
  /** Instruction, e.g. "Name the highlighted structure". */
  prompt: string;
  /** Names shown with the prompt, with the colour used in the 3D view. */
  subjects: { name: string; color?: string }[];
  /** Parts to tint, part ID → colour. */
  highlight: Map<string, string>;
  /** Parts to frame with the camera. */
  focus: string[];
  /** Systems to show while asking. */
  visible: SystemId[];
  /** "pick" questions are answered by clicking the model. */
  kind: "pick" | "choice";
  options: string[];
  correctIndex: number;
  /** Part IDs that count as correct for "pick" questions. */
  correctParts: string[];
  /** Typed answers are accepted for "name" questions. */
  typedAnswer?: string;
  /** Shown after answering. */
  explanation: string;
}

const RELATIONS: Record<Axis, [string, string]> = {
  vertical: ["Superior", "Inferior"],
  depth: ["Anterior", "Posterior"],
  medial: ["Medial", "Lateral"],
};

// ---------------------------------------------------------------------------------------------
// Which cards a set of items produces

function distance(a: StudyItem, b: StudyItem): number {
  return Math.hypot(
    a.center[0] - b.center[0],
    a.center[1] - b.center[1],
    a.center[2] - b.center[2],
  );
}

/** Interval of an item along an axis. "medial" uses distance from the midline. */
function interval(item: StudyItem, axis: Axis): [number, number] {
  const [min, max] = item.bounds;
  if (axis === "vertical") return [min[1], max[1]];
  if (axis === "depth") return [min[2], max[2]];
  const a = Math.abs(min[0]);
  const b = Math.abs(max[0]);
  return min[0] >= 0 || max[0] <= 0 ? [Math.min(a, b), Math.max(a, b)] : [0, Math.max(a, b)];
}

/**
 * The relation of A to B along an axis, only when it is clear: each structure lies beyond the
 * other's centre along that axis (bones may overlap a little at a joint), and the centres are
 * at least 1 cm apart. Returns 0 for "Superior/Anterior/Medial", 1 for the opposite, or null.
 */
export function spatialRelation(a: StudyItem, b: StudyItem, axis: Axis): 0 | 1 | null {
  if (axis === "medial" && (!a.side || a.side !== b.side)) return null;
  const [aMin, aMax] = interval(a, axis);
  const [bMin, bMax] = interval(b, axis);
  const aMid = (aMin + aMax) / 2;
  const bMid = (bMin + bMax) / 2;
  if (Math.abs(aMid - bMid) < 0.01) return null;
  // "Higher" means superior (+y), anterior (+z), or farther from the midline (lateral).
  const aHigher = aMin >= bMid && bMax <= aMid;
  const bHigher = bMin >= aMid && aMax <= bMid;
  if (!aHigher && !bHigher) return null;
  if (axis === "medial") return aHigher ? 1 : 0;
  return aHigher ? 0 : 1;
}

const MAX_SPATIAL_DISTANCE = 0.18;

/** Every card the given items support, for the given question types. */
export function cardsFor(items: readonly StudyItem[], types: readonly QuestionType[]): CardRef[] {
  const want = new Set(types);
  const cards: CardRef[] = [];
  const systems = new Set(items.map((i) => i.system));
  const parents = new Set(items.map((i) => i.parentName).filter(Boolean));

  for (const item of items) {
    const id = item.conceptId;
    if (want.has("find")) cards.push({ id: `find:${id}`, type: "find", conceptId: id });
    if (want.has("name")) cards.push({ id: `name:${id}`, type: "name", conceptId: id });
    if (want.has("side") && item.side) {
      cards.push({ id: `side:${id}`, type: "side", conceptId: id });
    }
    if (want.has("partOf") && item.parentName && parents.size >= 3) {
      cards.push({ id: `partOf:${id}`, type: "partOf", conceptId: id });
    }
    if (want.has("nerve") && item.muscle) {
      cards.push({ id: `nerve:${id}`, type: "nerve", conceptId: id });
    }
    if (want.has("system") && systems.size >= 2) {
      cards.push({ id: `system:${id}`, type: "system", conceptId: id });
    }
  }

  if (want.has("spatial")) {
    // For each item, one relation to a nearby structure that differs in name (not its mirror).
    const seen = new Set<string>();
    for (const a of items) {
      const neighbours = items
        .filter((b) => b !== a && b.region === a.region && distance(a, b) < MAX_SPATIAL_DISTANCE)
        .sort((x, y) => distance(a, x) - distance(a, y))
        .slice(0, 8);
      let made = 0;
      for (const b of neighbours) {
        const pair = [a.conceptId, b.conceptId].sort().join("|");
        if (seen.has(pair)) continue;
        for (const axis of ["vertical", "depth", "medial"] as const) {
          if (spatialRelation(a, b, axis) === null) continue;
          seen.add(pair);
          cards.push({
            id: `spatial:${a.conceptId}|${b.conceptId}|${axis}`,
            type: "spatial",
            conceptId: a.conceptId,
            otherId: b.conceptId,
            axis,
          });
          made++;
          break;
        }
        if (made >= 1) break;
      }
    }
  }
  return cards;
}

/** Parse a card ID back into a CardRef. */
export function parseCardId(id: string): CardRef | null {
  const [type, rest] = id.split(":") as [QuestionType, string | undefined];
  if (!rest) return null;
  if (type === "spatial") {
    const [a, b, axis] = rest.split("|");
    if (!a || !b || !axis) return null;
    return { id, type, conceptId: a, otherId: b, axis: axis as Axis };
  }
  return { id, type, conceptId: rest };
}

// ---------------------------------------------------------------------------------------------
// Building a question

function pickDistractors(
  target: StudyItem,
  pool: readonly StudyItem[],
  label: (item: StudyItem) => string | null,
  random: () => number,
  count = 3,
): string[] {
  const answer = label(target);
  const preferred = pool
    .filter((i) => i !== target && i.system === target.system && i.side === target.side)
    .sort((a, b) => distance(target, a) - distance(target, b));
  const fallback = pool
    .filter((i) => i !== target)
    .sort((a, b) => distance(target, a) - distance(target, b));
  const names: string[] = [];
  for (const list of [preferred, fallback]) {
    const candidates = [...new Set(list.map(label).filter((n): n is string => !!n))].filter(
      (n) => n !== answer && !names.includes(n),
    );
    names.push(...shuffle(candidates.slice(0, 12), random).slice(0, count - names.length));
    if (names.length >= count) break;
  }
  return names;
}

function withOptions(correct: string, distractors: string[], random: () => number) {
  const options = shuffle([correct, ...distractors], random);
  return { options, correctIndex: options.indexOf(correct) };
}

const tint = (item: StudyItem, color: string) =>
  new Map(item.partIds.map((id) => [id, color] as const));

/**
 * Turn a card into something to ask. `pool` provides distractors (usually the deck's items);
 * `deckSystems` is what "find" questions show. `seed` varies the options between reviews.
 */
export function buildQuestion(
  card: CardRef,
  byConcept: ReadonlyMap<string, StudyItem>,
  pool: readonly StudyItem[],
  deckSystems: readonly SystemId[],
  seed: string | number,
  curated: CuratedData = EMPTY_CURATED,
): Question | null {
  const item = byConcept.get(card.conceptId);
  if (!item) return null;
  const random = seededRandom(`${card.id}:${seed}`);
  const base = {
    card,
    focus: [...item.partIds],
    correctParts: [...item.partIds],
    visible: [item.system],
  };

  switch (card.type) {
    case "find":
      return {
        ...base,
        prompt: "Find this structure on the model",
        subjects: [{ name: item.name }],
        highlight: new Map(),
        focus: [],
        visible: [...new Set([...deckSystems, item.system])],
        kind: "pick",
        options: [],
        correctIndex: -1,
        explanation: `${item.name} is highlighted in green.`,
      };
    case "name": {
      const distractors = pickDistractors(item, pool, (i) => i.name, random);
      return {
        ...base,
        prompt: "Name the highlighted structure",
        subjects: [],
        highlight: tint(item, COLORS.target),
        kind: "choice",
        ...withOptions(item.name, distractors, random),
        typedAnswer: item.name,
        explanation: `This is the ${item.name.charAt(0).toLowerCase()}${item.name.slice(1)}.`,
      };
    }
    case "side": {
      const options = ["Left", "Right"];
      return {
        ...base,
        prompt: "Is the highlighted structure on the body's left or right?",
        subjects: [],
        highlight: tint(item, COLORS.target),
        kind: "choice",
        options,
        correctIndex: item.side === "left" ? 0 : 1,
        explanation: `${item.name}. Sides are the body's own, so the left side is on your right when the body faces you.`,
      };
    }
    case "system": {
      const systems = [...new Set([...deckSystems, ...pool.map((i) => i.system)])].filter(
        (s) => s !== item.system,
      );
      const others = shuffle(systems, random)
        .slice(0, 3)
        .map((s) => SYSTEM_BY_ID.get(s)!.name);
      const correct = SYSTEM_BY_ID.get(item.system)!.name;
      return {
        ...base,
        prompt: "Which system does the highlighted structure belong to?",
        subjects: [],
        highlight: tint(item, COLORS.target),
        visible: [...new Set([...deckSystems, item.system])],
        kind: "choice",
        ...withOptions(correct, others, random),
        explanation: `${item.name} belongs to the ${correct.toLowerCase()}.`,
      };
    }
    case "partOf": {
      if (!item.parentName) return null;
      const distractors = pickDistractors(item, pool, (i) => i.parentName, random);
      if (distractors.length < 2) return null;
      return {
        ...base,
        prompt: "The highlighted piece is part of which structure?",
        subjects: [],
        highlight: tint(item, COLORS.target),
        kind: "choice",
        ...withOptions(item.parentName, distractors, random),
        explanation: `${item.name} is part of the ${item.parentName.charAt(0).toLowerCase()}${item.parentName.slice(1)}.`,
      };
    }
    case "nerve": {
      if (!item.muscle) return null;
      const correct = nerveName(curated, item.muscle.n);
      const upper = item.region === "upper_limb";
      const sameLimb = ["axillary", "musculocutaneous", "radial", "median", "ulnar"];
      const others = Object.keys(curated.nerves)
        .filter((id) => id !== item.muscle!.n && sameLimb.includes(id) === upper)
        .map((id) => nerveName(curated, id))
        .filter((n) => n !== correct);
      const distractors = shuffle(others, random).slice(0, 3);
      if (distractors.length < 2) return null;
      return {
        ...base,
        prompt: "Which nerve supplies the highlighted muscle?",
        subjects: [],
        highlight: tint(item, COLORS.target),
        kind: "choice",
        ...withOptions(correct, distractors, random),
        explanation: `${item.muscleName ?? item.name} is supplied by the ${correct.charAt(0).toLowerCase()}${correct.slice(1)} (${item.muscle.r}). Draft content, pending expert review.`,
      };
    }
    case "spatial": {
      const other = card.otherId ? byConcept.get(card.otherId) : undefined;
      if (!other || !card.axis) return null;
      const relation = spatialRelation(item, other, card.axis);
      if (relation === null) return null;
      const [first, second] = RELATIONS[card.axis];
      const answer = relation === 0 ? first : second;
      const highlight = new Map([...tint(other, COLORS.other), ...tint(item, COLORS.target)]);
      return {
        ...base,
        prompt: `Is the first structure ${first.toLowerCase()} or ${second.toLowerCase()} to the second?`,
        subjects: [
          { name: item.name, color: COLORS.target },
          { name: other.name, color: COLORS.other },
        ],
        highlight,
        focus: [...item.partIds, ...other.partIds],
        visible: [...new Set([item.system, other.system])],
        kind: "choice",
        options: [first, second],
        correctIndex: relation,
        explanation: `${item.name} lies ${answer.toLowerCase()} to the ${other.name.charAt(0).toLowerCase()}${other.name.slice(1)} in the anatomical position.`,
      };
    }
  }
}
