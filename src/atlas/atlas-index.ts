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

/**
 * Female body with the gaps filled: every HuBMAP female mesh, plus BodyParts3D skeleton and
 * muscles she lacks, scaled to her height. Male parts that share a name with a female part, and
 * male reproductive organs, are left out. Added parts are marked `approximate`.
 */
export async function loadHybridFemale(
  femaleUrl: string,
  femaleBase: string,
  maleUrl: string,
  maleBase: string,
  signal?: AbortSignal,
): Promise<AtlasIndex> {
  const [female, male] = (await Promise.all(
    [femaleUrl, maleUrl].map(async (url) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("The anatomy catalogue could not be loaded.");
      return (await response.json()) as Atlas;
    }),
  )) as [Atlas, Atlas];
  const height = (a: Atlas) => Math.max(...a.parts.map((p) => p.bounds[1][1] ?? 0));
  const scale = height(female) / height(male);
  const femaleNames = new Set(female.parts.map((p) => p.name.toLowerCase()));

  // Align the two bodies: median offset between structures both models have (femurs, tibias,
  // vertebrae…), measured after scaling.
  const centre = (p: Part, s = 1) =>
    [0, 1, 2].map((i) => (((p.bounds[0][i] ?? 0) + (p.bounds[1][i] ?? 0)) / 2) * s);
  const femaleByName = new Map(female.parts.map((p) => [p.name.toLowerCase(), p]));
  const deltas = male.parts.flatMap((p) => {
    const twin = femaleByName.get(p.name.toLowerCase());
    if (!twin || p.system !== "skeletal") return [];
    const a = centre(twin);
    const b = centre(p, scale);
    return [[0, 1, 2].map((i) => a[i]! - b[i]!)];
  });
  const median = (values: number[]) => {
    const sorted = values.toSorted((x, y) => x - y);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
  };
  const shift = [0, 1, 2].map((i) => median(deltas.map((d) => d[i]!))) as [number, number, number];
  const keep = male.parts.filter(
    (p) =>
      (p.system === "skeletal" || p.system === "muscular") &&
      !femaleNames.has(p.name.toLowerCase()),
  );
  const first = female.chunks.length;
  const usedChunks = [...new Set(keep.map((p) => p.chunk))].sort((a, b) => a - b);
  const remap = new Map(usedChunks.map((c, i) => [c, first + i]));
  const resolve = (base: string, file?: string) =>
    file ? base + file.split("/").pop() : undefined;
  const chunks = [
    ...female.chunks.map((c) => ({
      ...c,
      gzip: resolve(femaleBase, c.gzip),
      url: resolve(femaleBase, c.url)!,
    })),
    ...usedChunks.map((c) => {
      const chunk = male.chunks[c]!;
      return {
        ...chunk,
        gzip: resolve(maleBase, chunk.gzip),
        url: resolve(maleBase, chunk.url)!,
        scale,
        offset: shift,
      };
    }),
  ];
  const added = keep.map((p) => ({
    ...p,
    chunk: remap.get(p.chunk)!,
    approximate: true,
    bounds: [
      p.bounds[0].map((v, i) => v * scale + shift[i]!),
      p.bounds[1].map((v, i) => v * scale + shift[i]!),
    ] as [number[], number[]],
  }));
  const addedIds = new Set(added.map((p) => p.id));
  const concepts = [
    ...female.concepts,
    ...male.concepts
      .map((c) => ({ ...c, elements: c.elements.filter((e) => addedIds.has(e)) }))
      .filter((c) => c.elements.length > 0),
  ];
  return indexAtlas({
    ...female,
    parts: [...female.parts, ...added],
    concepts,
    chunks,
    triangles: female.triangles + added.reduce((n, p) => n + p.indexCount / 3, 0),
  });
}
