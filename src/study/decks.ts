import { SYSTEM_IDS, isSystemId } from "../atlas/systems.ts";
import type { SystemId } from "../atlas/types.ts";
import type { ContentIndex } from "../content/content.ts";
import { REGION_BY_ID, REGION_IDS, isRegionId, type RegionId } from "../content/regions.ts";
import { hashString } from "./random.ts";

export type QuestionType = "find" | "name" | "side" | "system" | "partOf" | "spatial" | "nerve";

export const QUESTION_TYPES: readonly { id: QuestionType; label: string; hint: string }[] = [
  { id: "find", label: "Find it", hint: "We name it, you click it" },
  { id: "name", label: "Name it", hint: "We highlight it, you name it" },
  { id: "side", label: "Left or right", hint: "Which side of the body?" },
  { id: "partOf", label: "Part of", hint: "Which larger structure?" },
  { id: "spatial", label: "Directions", hint: "Superior, medial, anterior…" },
  { id: "nerve", label: "Nerve supply", hint: "Limb muscles: which nerve?" },
  { id: "system", label: "Which system", hint: "Only when a deck has several" },
];
const TYPE_IDS = QUESTION_TYPES.map((t) => t.id);

/** A deck is a saved filter over the study items; cards are shared across decks. */
export interface Deck {
  id: string;
  name: string;
  regions: RegionId[];
  systems: SystemId[];
  types: QuestionType[];
  createdAt: number;
}

export type DeckFilter = Pick<Deck, "regions" | "systems" | "types">;

/** Same filter → same ID, so a shared link never creates a duplicate. */
export function deckId(filter: DeckFilter): string {
  const key = [
    [...filter.regions].sort().join(","),
    [...filter.systems].sort().join(","),
    [...filter.types].sort().join(","),
  ].join("|");
  return `d${hashString(key).toString(36)}`;
}

export function defaultDeckName(filter: DeckFilter): string {
  const regions =
    filter.regions.length === REGION_IDS.length || filter.regions.length === 0
      ? "Whole body"
      : filter.regions.map((r) => REGION_BY_ID.get(r)!.name).join(" + ");
  const systems: Partial<Record<SystemId, string>> = {
    skeletal: "bones",
    muscular: "muscles",
    arterial: "arteries",
    venous: "veins",
    nervous: "nerves",
    cardiac: "heart",
  };
  const parts = filter.systems.map((s) => systems[s] ?? s);
  return `${regions}: ${parts.length > 3 ? `${parts.length} systems` : parts.join(", ")}`;
}

export function makeDeck(filter: DeckFilter, name?: string, now = Date.now()): Deck {
  return {
    id: deckId(filter),
    name: name?.trim() || defaultDeckName(filter),
    regions: [...filter.regions],
    systems: [...filter.systems],
    types: [...filter.types],
    createdAt: now,
  };
}

export function deckItems(content: ContentIndex, filter: Pick<Deck, "regions" | "systems">) {
  const regions = new Set(filter.regions);
  const systems = new Set(filter.systems);
  return content.items.filter((i) => regions.has(i.region) && systems.has(i.system));
}

/** Ready-made decks for people who have none yet. */
export const STARTER_DECKS: readonly (DeckFilter & { name: string })[] = [
  {
    name: "Upper limb: bones",
    regions: ["upper_limb"],
    systems: ["skeletal"],
    types: ["find", "name", "side"],
  },
  {
    name: "Upper limb: muscles",
    regions: ["upper_limb"],
    systems: ["muscular"],
    types: ["find", "name", "side", "partOf", "nerve"],
  },
  {
    name: "Lower limb: bones and muscles",
    regions: ["lower_limb"],
    systems: ["skeletal", "muscular"],
    types: ["find", "name", "side", "spatial"],
  },
  {
    name: "Thorax: the heart",
    regions: ["thorax"],
    systems: ["cardiac"],
    types: ["find", "name", "partOf", "spatial"],
  },
  {
    name: "Head and neck: skull",
    regions: ["head_neck"],
    systems: ["skeletal"],
    types: ["find", "name", "side", "spatial"],
  },
];

// ---------------------------------------------------------------------------------------------
// Share links: #study=1&n=Upper%20limb&r=upper_limb&s=skeletal&t=find,name

export function encodeDeckLink(deck: Deck): string {
  const params = new URLSearchParams();
  params.set("study", "1");
  params.set("n", deck.name);
  params.set("r", deck.regions.join(","));
  params.set("s", deck.systems.join(","));
  params.set("t", deck.types.join(","));
  return params.toString().replaceAll("%2C", ",");
}

export function decodeDeckLink(hash: string): Deck | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("study") !== "1") return null;
  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const regions = REGION_IDS.filter((r) => list("r").filter(isRegionId).includes(r));
  const systems = SYSTEM_IDS.filter((s) => list("s").filter(isSystemId).includes(s));
  const types = TYPE_IDS.filter((t) => list("t").includes(t));
  if (!regions.length || !systems.length || !types.length) return null;
  const name = (params.get("n") ?? "").slice(0, 80);
  return makeDeck({ regions, systems, types }, name);
}
