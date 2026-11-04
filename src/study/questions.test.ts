import { describe, expect, it } from "vitest";
import type { SystemId } from "../atlas/types.ts";
import { loadFixture } from "../test/atlas-fixture.ts";
import { deckItems } from "./decks.ts";
import {
  buildQuestion,
  cardsFor,
  parseCardId,
  spatialRelation,
  type CardRef,
} from "./questions.ts";

const { content } = loadFixture();
const byName = (name: string) => content.items.find((i) => i.name === name)!;
const upperBones = deckItems(content, { regions: ["upper_limb"], systems: ["skeletal"] });
const ask = (card: CardRef, pool = upperBones, systems: SystemId[] = ["skeletal"]) =>
  buildQuestion(card, content.byConcept, pool, systems, "test")!;

describe("cardsFor", () => {
  const cards = cardsFor(upperBones, ["find", "name", "side", "system", "partOf", "spatial"]);

  it("makes find and name cards for every structure", () => {
    expect(cards.filter((c) => c.type === "find").length).toBe(upperBones.length);
    expect(cards.filter((c) => c.type === "name").length).toBe(upperBones.length);
  });

  it("skips 'which system' when the deck has only one system", () => {
    expect(cards.some((c) => c.type === "system")).toBe(false);
  });

  it("makes side cards only for lateral structures", () => {
    for (const c of cards.filter((x) => x.type === "side")) {
      expect(content.byConcept.get(c.conceptId)!.side).not.toBeNull();
    }
  });

  it("makes unambiguous spatial cards", () => {
    const spatial = cards.filter((c) => c.type === "spatial");
    expect(spatial.length).toBeGreaterThan(20);
    for (const c of spatial) {
      const a = content.byConcept.get(c.conceptId)!;
      const b = content.byConcept.get(c.otherId!)!;
      expect(spatialRelation(a, b, c.axis!)).not.toBeNull();
    }
  });

  it("uses IDs that parse back", () => {
    for (const c of cards.slice(0, 200)) expect(parseCardId(c.id)).toEqual(c);
  });
});

describe("spatialRelation", () => {
  it("follows the anatomical axes", () => {
    const humerus = byName("Left humerus");
    const radius = byName("Left radius");
    expect(spatialRelation(humerus, radius, "vertical")).toBe(0); // humerus is superior
    expect(spatialRelation(radius, humerus, "vertical")).toBe(1);
    const sternum = byName("Body of sternum");
    const vertebra = byName("Fifth thoracic vertebra");
    expect(spatialRelation(sternum, vertebra, "depth")).toBe(0); // sternum is anterior
    // Palms face forward, so the little finger is medial and the thumb lateral.
    const fifth = byName("Left fifth metacarpal bone");
    const first = byName("Left first metacarpal bone");
    expect(spatialRelation(fifth, first, "medial")).toBe(0);
    expect(spatialRelation(first, fifth, "medial")).toBe(1);
  });

  it("refuses medial/lateral across the midline", () => {
    expect(spatialRelation(byName("Left femur"), byName("Right femur"), "medial")).toBeNull();
  });
});

describe("buildQuestion", () => {
  const humerus = byName("Left humerus");

  it("builds a name question with distinct options and the answer among them", () => {
    const q = ask({ id: `name:${humerus.conceptId}`, type: "name", conceptId: humerus.conceptId });
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4);
    expect(q.options[q.correctIndex]).toBe("Left humerus");
    expect(q.highlight.size).toBe(humerus.partIds.length);
    // Distractors stay on the same side, so the side is not a giveaway.
    for (const option of q.options) expect(option.startsWith("Left")).toBe(true);
  });

  it("builds a find question answered by clicking", () => {
    const q = ask({ id: `find:${humerus.conceptId}`, type: "find", conceptId: humerus.conceptId });
    expect(q.kind).toBe("pick");
    expect(q.correctParts).toEqual(humerus.partIds);
    expect(q.highlight.size).toBe(0);
  });

  it("answers left/right from the body's side", () => {
    const right = byName("Right humerus");
    const q = ask({ id: `side:${right.conceptId}`, type: "side", conceptId: right.conceptId });
    expect(q.options[q.correctIndex]).toBe("Right");
  });

  it("asks part-of without naming the piece", () => {
    const head = byName("Long head of left biceps brachii");
    const muscles = deckItems(content, { regions: ["upper_limb"], systems: ["muscular"] });
    const q = ask(
      { id: `partOf:${head.conceptId}`, type: "partOf", conceptId: head.conceptId },
      muscles,
      ["muscular"],
    );
    expect(q.options[q.correctIndex]).toBe("Left biceps brachii");
    expect(q.prompt).not.toContain("biceps");
    expect(q.subjects).toEqual([]);
  });

  it("varies option order with the seed but keeps the answer", () => {
    const card: CardRef = {
      id: `name:${humerus.conceptId}`,
      type: "name",
      conceptId: humerus.conceptId,
    };
    const a = buildQuestion(card, content.byConcept, upperBones, ["skeletal"], 1)!;
    const b = buildQuestion(card, content.byConcept, upperBones, ["skeletal"], 2)!;
    expect(a.options[a.correctIndex]).toBe(b.options[b.correctIndex]);
  });
});
