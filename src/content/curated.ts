/** Hand-curated muscle and nerve data (data/content/*.json). Draft until an anatomist reviews it. */
export interface MuscleCard {
  /** Origin */
  o: string;
  /** Insertion */
  i: string;
  /** Action */
  a: string;
  /** Nerve: a key in nerves.json, or a plain nerve name */
  n: string;
  /** Spinal roots */
  r: string;
}

export interface NerveInfo {
  name: string;
  roots: string;
  lesion: string;
}

export interface CuratedData {
  muscles: Record<string, MuscleCard>;
  nerves: Record<string, NerveInfo>;
}

export const EMPTY_CURATED: CuratedData = { muscles: {}, nerves: {} };

export function nerveName(data: CuratedData, id: string): string {
  return (
    data.nerves[id]?.name ??
    `${id.charAt(0).toUpperCase()}${id.slice(1).replaceAll("_", " ")} nerve`
  );
}

export const withoutSide = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(left|right)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
