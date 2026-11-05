import type { AtlasIndex } from "../atlas/atlas-index.ts";
import { withoutSide } from "./curated.ts";

export interface DefinitionEntry {
  uberon: string;
  name: string;
  definition?: string;
  synonyms?: string[];
}

export interface Definitions {
  source: { name: string; release: string; license: string; url: string };
  concepts: Record<string, DefinitionEntry>;
}

/** Loaded on demand: the file is about 380 kB, so it lives in its own chunk. */
export async function loadDefinitions(): Promise<Definitions> {
  const module = await import("../../data/content/definitions.json");
  return module.default as unknown as Definitions;
}

export interface FoundDefinition extends DefinitionEntry {
  /** Set when the text describes the general structure (e.g. "femur" for "left femur"). */
  general: boolean;
}

/** The concept's own definition, or the definition of the same structure without its side. */
export function definitionFor(
  defs: Definitions | null,
  index: AtlasIndex,
  conceptId: string,
): FoundDefinition | null {
  if (!defs) return null;
  const uberon = index.parts.get(index.concepts.get(conceptId)?.elements[0] ?? "")?.uberon;
  if (uberon) {
    const match = Object.values(defs.concepts).find((d) => d.uberon === uberon && d.definition);
    if (match) return { ...match, general: false };
  }
  const own = defs.concepts[conceptId];
  if (own?.definition) return { ...own, general: false };
  const concept = index.concepts.get(conceptId);
  if (!concept) return null;
  const general = withoutSide(concept.name);
  if (general === concept.name.toLowerCase()) return null;
  const match = index.atlas.concepts.find((c) => c.name.toLowerCase() === general);
  const entry = match ? defs.concepts[match.id] : undefined;
  return entry?.definition ? { ...entry, general: true } : null;
}
