import type { AtlasIndex } from "../atlas/atlas-index.ts";
import type { Concept, Part, SystemId } from "../atlas/types.ts";
import { buildContainers } from "./containers.ts";
import { EMPTY_CURATED, withoutSide, type CuratedData, type MuscleCard } from "./curated.ts";
import { sideOf, type Side } from "./laterality.ts";
import { regionOfPart, type RegionId } from "./regions.ts";

/** Groups larger than this are too general to name a region or to quiz as "part of". */
const SMALL_GROUP = 40;
/** Generic grouping concepts that make poor "part of" answers. */
const GENERIC =
  /^(region|segment|cardinal segment|subdivision|zone|portion|set|tree|organ part|anatomical|systemic|vascular tree|wall of|cavity of)\b|\b(tree|system|set of)\b/;

/**
 * One studyable structure: the named concept behind one or more meshes (1,659 concepts back the
 * 2,234 meshes; a few structures, such as the optic nerve, are split into several meshes).
 */
export interface StudyItem {
  conceptId: string;
  partIds: readonly string[];
  /** Display name, sentence case. */
  name: string;
  system: SystemId;
  region: RegionId;
  regionSource: "name" | "group" | "position";
  side: Side | null;
  center: [number, number, number];
  size: [number, number, number];
  bounds: [Vec3, Vec3];
  /**
   * The larger structure this is part of, read from the FMA name ("Long head of left biceps
   * brachii" → "Left biceps brachii"). Null when the name does not say.
   */
  parentName: string | null;
  /** Concept ID of that parent, when the atlas has it as a structure of its own. */
  parentId: string | null;
  /** Curated muscle card (the item's own, or its parent muscle's). */
  muscle?: MuscleCard;
  /** Name of the muscle the card belongs to. */
  muscleName?: string;
}

export interface ContentIndex {
  items: readonly StudyItem[];
  byConcept: ReadonlyMap<string, StudyItem>;
  byPart: ReadonlyMap<string, StudyItem>;
  /** Regions covered by any concept (union of its meshes). */
  regionsOfConcept: (conceptId: string) => RegionId[];
  /** Named groups this belongs to, smallest first (at most four), excluding side-only twins. */
  breadcrumb: (conceptId: string) => Concept[];
  /** Other study items that share this item's parent. */
  siblings: (conceptId: string) => StudyItem[];
}

type Vec3 = [number, number, number];

function unionBounds(parts: readonly Part[]): [Vec3, Vec3] {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, part.bounds[0][i] ?? 0);
      max[i] = Math.max(max[i]!, part.bounds[1][i] ?? 0);
    }
  }
  return [min, max];
}

function mostCommon<T>(values: readonly T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].toSorted((a, b) => b[1] - a[1])[0]![0];
}

export function sentenceCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function isMeaningfulGroup(concept: Concept): boolean {
  return concept.elements.length <= SMALL_GROUP && !GENERIC.test(concept.name.toLowerCase());
}

/** "X of Y to Z" → "Y": FMA names state what a part belongs to. */
export function parentFromName(name: string): string | null {
  const match = /^(.+?)\s+of\s+(.+)$/i.exec(name);
  if (!match) return null;
  const parent = match[2]!.split(/\s+(?:to|with|and)\s+/i)[0]!.trim();
  return parent.length > 2 ? sentenceCase(parent) : null;
}

export function buildContent(
  index: AtlasIndex,
  curated: CuratedData = EMPTY_CURATED,
): ContentIndex {
  const containers = buildContainers(index.atlas);
  // Skip groups that only drop the side ("long head of biceps brachii" for the left one): they
  // are poor answers to "what is this part of?".
  const meaningfulAncestors = (conceptId: string) => {
    const own = withoutSide(index.concepts.get(conceptId)?.name ?? "");
    return containers(conceptId)
      .filter((c) => isMeaningfulGroup(c) && withoutSide(c.name) !== own)
      .slice(0, 4);
  };

  const partsByConcept = new Map<string, Part[]>();
  for (const part of index.atlas.parts) {
    const list = partsByConcept.get(part.conceptId) ?? [];
    list.push(part);
    partsByConcept.set(part.conceptId, list);
  }

  const items: StudyItem[] = [];
  const partRegion = new Map<string, RegionId>();
  for (const [conceptId, parts] of partsByConcept) {
    const concept = index.concepts.get(conceptId);
    // The translucent body surface is a reference layer, not something to study.
    if (!concept || parts[0]!.system === "integumentary") continue;
    const groups = meaningfulAncestors(conceptId);
    const groupNames = groups.map((g) => g.name);
    const placed = parts.map((part) => regionOfPart(part, groupNames));
    parts.forEach((part, i) => partRegion.set(part.id, placed[i]!.region));
    const region = mostCommon(placed.map((p) => p.region));
    const bounds = unionBounds(parts);
    const name = sentenceCase(parts[0]!.name);
    items.push({
      conceptId,
      partIds: parts.map((p) => p.id),
      name,
      system: parts[0]!.system,
      region,
      regionSource: placed.find((p) => p.region === region)!.source,
      side: sideOf(name),
      center: [0, 1, 2].map((i) => (bounds[0][i]! + bounds[1][i]!) / 2) as Vec3,
      size: [0, 1, 2].map((i) => bounds[1][i]! - bounds[0][i]!) as Vec3,
      bounds,
      parentName: parentFromName(name),
      parentId: null,
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));

  const byConcept = new Map(items.map((item) => [item.conceptId, item]));
  const conceptByName = new Map(index.atlas.concepts.map((c) => [c.name.toLowerCase(), c.id]));
  for (const item of items) {
    if (item.parentName) item.parentId = conceptByName.get(item.parentName.toLowerCase()) ?? null;
    for (const name of [item.name, item.parentName]) {
      const key = name ? withoutSide(name) : "";
      const card = curated.muscles[key];
      if (item.system === "muscular" && card) {
        item.muscle = card;
        item.muscleName = sentenceCase(key.replace(/ muscle$/, ""));
        break;
      }
    }
  }
  const byPart = new Map<string, StudyItem>();
  for (const item of items) for (const id of item.partIds) byPart.set(id, item);

  const byParent = new Map<string, StudyItem[]>();
  for (const item of items) {
    if (!item.parentName) continue;
    const list = byParent.get(item.parentName) ?? [];
    list.push(item);
    byParent.set(item.parentName, list);
  }

  return {
    items,
    byConcept,
    byPart,
    regionsOfConcept(conceptId) {
      const concept = index.concepts.get(conceptId);
      const regions = new Set<RegionId>();
      for (const element of concept?.elements ?? []) {
        const region = partRegion.get(element);
        if (region) regions.add(region);
      }
      return [...regions];
    },
    breadcrumb: (conceptId) => meaningfulAncestors(conceptId),
    siblings(conceptId) {
      const parentName = byConcept.get(conceptId)?.parentName;
      if (!parentName) return [];
      return (byParent.get(parentName) ?? []).filter((i) => i.conceptId !== conceptId);
    },
  };
}
