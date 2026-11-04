import { describe, expect, it } from "vitest";
import { loadFixture } from "../test/atlas-fixture.ts";
import {
  STARTER_DECKS,
  decodeDeckLink,
  deckId,
  deckItems,
  encodeDeckLink,
  makeDeck,
} from "./decks.ts";
import { cardsFor } from "./questions.ts";

describe("deck links", () => {
  it("round-trips and gives equal filters the same ID", () => {
    const deck = makeDeck(
      { regions: ["upper_limb"], systems: ["skeletal", "muscular"], types: ["find", "name"] },
      "Arm & hand",
    );
    const decoded = decodeDeckLink(`#${encodeDeckLink(deck)}`)!;
    expect(decoded.name).toBe("Arm & hand");
    expect(decoded.id).toBe(deck.id);
    expect(
      deckId({
        regions: ["upper_limb"],
        systems: ["muscular", "skeletal"],
        types: ["name", "find"],
      }),
    ).toBe(deck.id);
  });

  it("rejects incomplete or hostile links", () => {
    expect(decodeDeckLink("#study=1&r=upper_limb")).toBeNull();
    expect(decodeDeckLink("#study=1&r=nowhere&s=skeletal&t=find")).toBeNull();
    expect(decodeDeckLink("#c=FMA1")).toBeNull();
    const long = decodeDeckLink(`#study=1&n=${"x".repeat(500)}&r=thorax&s=cardiac&t=find`)!;
    expect(long.name.length).toBeLessThanOrEqual(80);
  });
});

describe("starter decks", () => {
  const { content } = loadFixture();
  for (const deck of STARTER_DECKS) {
    it(`${deck.name} has enough to study`, () => {
      const items = deckItems(content, deck);
      expect(items.length).toBeGreaterThanOrEqual(15);
      expect(cardsFor(items, deck.types).length).toBeGreaterThanOrEqual(40);
    });
  }
});
