import { SYSTEMS } from "./systems";
import type { Atlas, Concept, Part, SystemId } from "./types";

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

export function indexAtlas(atlas: Atlas): AtlasIndex {
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
