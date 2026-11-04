import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import definitions from "../../data/content/definitions.json";
import lock from "../../data/models.lock.json";
import muscles from "../../data/content/muscles.json";
import nerves from "../../data/content/nerves.json";
import { indexAtlas } from "../atlas/atlas-index.ts";
import type { Atlas } from "../atlas/types.ts";
import { buildContent } from "../content/content.ts";
import type { CuratedData } from "../content/curated.ts";
import type { Definitions } from "../content/definitions.ts";
import { deckToAnki } from "./anki.ts";
import { makeDeck } from "./decks.ts";

const curated = { muscles: muscles.muscles, nerves: nerves.nerves } as CuratedData;
const index = indexAtlas(
  JSON.parse(
    readFileSync(
      new URL(`../../public/models/${lock.version}/atlas.json`, import.meta.url),
      "utf8",
    ),
  ) as Atlas,
);
const content = buildContent(index, curated);

describe("deckToAnki", () => {
  const deck = makeDeck(
    { regions: ["upper_limb"], systems: ["muscular"], types: ["name"] },
    "Arm muscles",
  );
  const text = deckToAnki(
    deck,
    content,
    curated,
    definitions as unknown as Definitions,
    "https://example.org",
  );
  const rows = text.trim().split("\n");

  it("writes Anki's header lines and three tab-separated columns", () => {
    expect(rows.slice(0, 4)).toEqual([
      "#separator:tab",
      "#html:true",
      "#tags column:3",
      "#deck:Arm muscles",
    ]);
    for (const row of rows.slice(4)) expect(row.split("\t")).toHaveLength(3);
  });

  it("includes muscle facts once per muscle, with a link back to the 3D view", () => {
    const nerve = rows.filter((r) => r.startsWith("Biceps brachii: nerve supply?"));
    expect(nerve).toHaveLength(1);
    expect(nerve[0]).toContain("Musculocutaneous nerve (C5–C6)");
    expect(nerve[0]).toContain('href="https://example.org/#p=');
  });
});
