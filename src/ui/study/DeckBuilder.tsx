import { useMemo, useState } from "react";
import type { AtlasIndex } from "@/atlas/atlas-index";
import { SYSTEM_BY_ID } from "@/atlas/systems";
import type { SystemId } from "@/atlas/types";
import type { ContentIndex } from "@/content/content";
import { REGIONS, type RegionId } from "@/content/regions";
import {
  QUESTION_TYPES,
  defaultDeckName,
  deckItems,
  makeDeck,
  type Deck,
  type QuestionType,
} from "@/study/decks";
import { cardsFor } from "@/study/questions";
import { Chip, SectionTitle } from "./Chip";

interface Props {
  index: AtlasIndex;
  content: ContentIndex;
  onCancel: () => void;
  onCreate: (deck: Deck, start: boolean) => void;
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function DeckBuilder({ index, content, onCancel, onCreate }: Props) {
  const [regions, setRegions] = useState<RegionId[]>(["upper_limb"]);
  const [systems, setSystems] = useState<SystemId[]>(["skeletal"]);
  const [types, setTypes] = useState<QuestionType[]>(["find", "name", "side"]);
  const [name, setName] = useState("");

  const studySystems = index.activeSystems.filter((s) => s !== "integumentary");
  const items = useMemo(
    () => deckItems(content, { regions, systems }),
    [content, regions, systems],
  );
  const cards = useMemo(() => cardsFor(items, types), [items, types]);
  const perSystem = useMemo(() => {
    const counts = new Map<SystemId, number>();
    const inRegions = new Set(regions);
    for (const item of content.items) {
      if (inRegions.has(item.region)) counts.set(item.system, (counts.get(item.system) ?? 0) + 1);
    }
    return counts;
  }, [content, regions]);

  const filter = { regions, systems, types };
  const valid = cards.length > 0;
  const create = (start: boolean) => valid && onCreate(makeDeck(filter, name), start);

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="deck-name"
          className="mb-1.5 block text-[11px] font-semibold tracking-wider text-ink-muted uppercase"
        >
          Name
        </label>
        <input
          id="deck-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultDeckName(filter)}
          maxLength={80}
          className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <SectionTitle>Regions</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <Chip
              key={r.id}
              on={regions.includes(r.id)}
              onClick={() => setRegions(toggle(regions, r.id))}
            >
              {r.name}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Systems</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {studySystems.map((id) => (
            <Chip
              key={id}
              on={systems.includes(id)}
              onClick={() => setSystems(toggle(systems, id))}
            >
              {SYSTEM_BY_ID.get(id)!.name}
              <span className="ml-1 text-ink-faint tabular-nums">{perSystem.get(id) ?? 0}</span>
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Questions</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {QUESTION_TYPES.map((t) => (
            <Chip
              key={t.id}
              title={t.hint}
              on={types.includes(t.id)}
              onClick={() => setTypes(toggle(types, t.id))}
            >
              {t.label}
            </Chip>
          ))}
        </div>
      </div>
      <p className="text-sm text-ink-muted" aria-live="polite">
        {items.length.toLocaleString("en")} structures · {cards.length.toLocaleString("en")} cards
        {!valid && (
          <span className="block text-xs text-danger">
            Pick at least one region, system and question type with structures in it.
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() => create(true)}
          className="tap h-10 flex-1 rounded-xl bg-ink text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-40"
        >
          Create and start
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => create(false)}
          className="tap h-10 rounded-xl border border-line px-3 text-sm font-medium text-ink-muted hover:bg-ink/5 disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="tap h-10 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-ink/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
