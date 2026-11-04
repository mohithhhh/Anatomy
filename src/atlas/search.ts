import type { AtlasIndex } from "./atlas-index";
import type { Concept } from "./types";

export interface SearchResult {
  concept: Concept;
  /** Lower is better. */
  score: number;
}

const SUGGESTED = [
  "heart",
  "brain",
  "femur",
  "liver",
  "stomach",
  "kidney",
  "right lung",
  "humerus",
  "diaphragm",
  "skull",
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** FMA names are lower case ("left femur"); show them in sentence case. */
export function displayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function scoreName(name: string, query: string, tokens: string[]): number | null {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (` ${name}`.includes(` ${query}`)) return 2;
  const words = name.split(" ");
  const everyTokenStartsAWord = tokens.every((t) => words.some((w) => w.startsWith(t)));
  if (everyTokenStartsAWord) return 3;
  if (name.includes(query)) return 4;
  if (tokens.every((t) => name.includes(t))) return 5;
  return null;
}

/** Ranked concept search by name, FMA ID or mesh ID. */
export function searchConcepts(index: AtlasIndex, rawQuery: string, limit = 60): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) {
    const byName = new Map(index.atlas.concepts.map((c) => [c.name.toLowerCase(), c]));
    return SUGGESTED.flatMap((name) => {
      const concept = byName.get(name);
      return concept ? [{ concept, score: 0 }] : [];
    });
  }

  // Exact identifiers first: "FMA9611" or a mesh ID such as "FJ1452M".
  const id = rawQuery.trim().toUpperCase();
  const byId = index.concepts.get(id);
  if (byId) return [{ concept: byId, score: -1 }];
  const part = index.parts.get(id);
  if (part) {
    const concept = index.concepts.get(part.conceptId);
    if (concept) return [{ concept, score: -1 }];
  }

  const tokens = query.split(" ");
  const results: SearchResult[] = [];
  for (const concept of index.atlas.concepts) {
    const score = scoreName(normalize(concept.name), query, tokens);
    if (score !== null) results.push({ concept, score });
  }
  results.sort(
    (a, b) =>
      a.score - b.score ||
      a.concept.name.length - b.concept.name.length ||
      a.concept.name.localeCompare(b.concept.name),
  );
  return results.slice(0, limit);
}
