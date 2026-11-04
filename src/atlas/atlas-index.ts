import { SYSTEMS } from "./systems.ts";
import type { Atlas, Concept, Part, SystemId } from "./types.ts";

/** Lookup tables built once after the atlas loads. */
export interface AtlasIndex {
  atlas: Atlas;
  parts: ReadonlyMap<string, Part>;
  concepts: ReadonlyMap<string, Concept>;
  /** Number of meshes per system. */
  counts: Readonly<Record<SystemId, number>>;
  /** Systems that have at least one mesh, in display order. */
  activeSystems: readonly SystemId[];
}

/**
 * Known mistakes in the source data's display systems, fixed by mesh name. Both levator
 * scapulae muscles are tagged as skeletal in the upstream manifest.
 */
const SYSTEM_CORRECTIONS: Record<string, SystemId> = {
  "Left levator scapulae": "muscular",
  "Right levator scapulae": "muscular",
};

/**
 * The female reference set names meshes by Uberon ID, often one ID for both sides and with no
 * matching named concept. Give each such mesh its own concept (named with its side, from the
 * _L/_R suffix of its ID) and keep the Uberon ID for definitions.
 */
function giveMeshesOwnConcepts(atlas: Atlas) {
  const known = new Set(atlas.concepts.map((c) => c.id));
  for (const part of atlas.parts) {
    if (known.has(part.conceptId)) continue;
    let name = part.name;
    if (!/\b(left|right)\b/i.test(name)) {
      if (part.id.endsWith("_L")) name = `Left ${name}`;
      else if (part.id.endsWith("_R")) name = `Right ${name}`;
    }
    part.name = name.charAt(0).toUpperCase() + name.slice(1);
    if (part.conceptId.startsWith("UBERON:")) part.uberon = part.conceptId;
    part.conceptId = part.id;
    atlas.concepts.push({ id: part.id, name: part.name.toLowerCase(), elements: [part.id] });
    known.add(part.id);
  }
}

export function indexAtlas(atlas: Atlas): AtlasIndex {
  for (const part of atlas.parts) {
    const fixed = SYSTEM_CORRECTIONS[part.name];
    if (fixed) part.system = fixed;
  }
  giveMeshesOwnConcepts(atlas);
  const counts = Object.fromEntries(SYSTEMS.map((s) => [s.id, 0])) as Record<SystemId, number>;
  for (const part of atlas.parts) counts[part.system]++;
  return {
    atlas,
    parts: new Map(atlas.parts.map((p) => [p.id, p])),
    concepts: new Map(atlas.concepts.map((c) => [c.id, c])),
    counts,
    activeSystems: SYSTEMS.map((s) => s.id).filter((id) => counts[id] > 0),
  };
}

export async function loadAtlas(url: string, signal?: AbortSignal): Promise<AtlasIndex> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("The anatomy catalogue could not be loaded.");
  return indexAtlas((await response.json()) as Atlas);
}
