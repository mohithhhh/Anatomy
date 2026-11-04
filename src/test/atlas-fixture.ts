import { readFileSync } from "node:fs";
import lock from "../../data/models.lock.json";
import { indexAtlas, type AtlasIndex } from "../atlas/atlas-index.ts";
import type { Atlas } from "../atlas/types.ts";
import { buildContent, type ContentIndex } from "../content/content.ts";

let cached: { index: AtlasIndex; content: ContentIndex } | null = null;

/** The real downloaded atlas, loaded once per test file. */
export function loadFixture() {
  if (cached) return cached;
  const url = new URL(`../../public/models/${lock.version}/atlas.json`, import.meta.url);
  const index = indexAtlas(JSON.parse(readFileSync(url, "utf8")) as Atlas);
  cached = { index, content: buildContent(index) };
  return cached;
}
