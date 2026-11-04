import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import muscles from "../../data/content/muscles.json";
import nerves from "../../data/content/nerves.json";
import definitions from "../../data/content/definitions.json";
import lock from "../../data/models.lock.json";
import { indexAtlas } from "../atlas/atlas-index.ts";
import type { Atlas } from "../atlas/types.ts";
import { deckItems } from "../study/decks.ts";
import { buildQuestion } from "../study/questions.ts";
import { buildContent } from "./content.ts";
import type { CuratedData } from "./curated.ts";
import { definitionFor, type Definitions } from "./definitions.ts";

const curated: CuratedData = {
  muscles: muscles.muscles as CuratedData["muscles"],
  nerves: nerves.nerves as CuratedData["nerves"],
};
const index = indexAtlas(
  JSON.parse(
    readFileSync(
      new URL(`../../public/models/${lock.version}/atlas.json`, import.meta.url),
      "utf8",
    ),
  ) as Atlas,
);
const content = buildContent(index, curated);
const defs = definitions as unknown as Definitions;
const item = (name: string) => content.items.find((i) => i.name === name)!;

describe("curated muscle data", () => {
  it("matches every curated muscle to the model", () => {
    const matched = new Set(content.items.map((i) => i.muscleName?.toLowerCase()));
    const missing = Object.keys(curated.muscles).filter(
      (k) => !matched.has(k.replace(/ muscle$/, "")),
    );
    expect(missing).toEqual([]);
  });

  it("gives heads of a muscle their parent's card", () => {
    const head = item("Long head of left biceps brachii");
    expect(head.muscleName).toBe("Biceps brachii");
    expect(head.muscle?.n).toBe("musculocutaneous");
  });

  it("only references nerves that are named consistently", () => {
    for (const card of Object.values(curated.muscles)) expect(card.n.length).toBeGreaterThan(2);
    expect(Object.keys(curated.nerves).length).toBe(11);
  });
});

describe("definitions", () => {
  it("uses the structure's own Uberon definition", () => {
    const heart = index.atlas.concepts.find((c) => c.name === "heart")!;
    const found = definitionFor(defs, index, heart.id)!;
    expect(found.uberon).toBe("UBERON:0000948");
    expect(found.general).toBe(false);
  });

  it("falls back to the unsided structure", () => {
    const found = definitionFor(defs, index, item("Left femur").conceptId);
    expect(found?.general).toBe(true);
    expect(found?.definition?.length).toBeGreaterThan(20);
  });

  it("never ships auto-generated stub definitions", () => {
    for (const entry of Object.values(defs.concepts)) {
      expect(entry.definition ?? "").not.toContain("Automatically generated");
    }
  });
});

describe("nerve questions", () => {
  it("asks for the right nerve with limb-appropriate distractors", () => {
    const deltoid = content.items.find((i) => i.muscleName === "Deltoid")!;
    const pool = deckItems(content, { regions: ["upper_limb"], systems: ["muscular"] });
    const q = buildQuestion(
      { id: `nerve:${deltoid.conceptId}`, type: "nerve", conceptId: deltoid.conceptId },
      content.byConcept,
      pool,
      ["muscular"],
      1,
      curated,
    )!;
    expect(q.options[q.correctIndex]).toBe("Axillary nerve");
    for (const o of q.options) expect(o).not.toMatch(/femoral|obturator|gluteal|tibial|fibular/i);
  });
});
