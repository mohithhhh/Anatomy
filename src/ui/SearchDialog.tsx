import { clsx } from "clsx";
import { Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AtlasIndex } from "@/atlas/atlas-index";
import { displayName, searchConcepts } from "@/atlas/search";
import { SYSTEM_BY_ID } from "@/atlas/systems";
import type { Concept } from "@/atlas/types";

interface Props {
  index: AtlasIndex;
  onChoose: (concept: Concept) => void;
  onClose: () => void;
}

/** Command-palette style search over all 3,432 named structures. */
export function SearchDialog({ index, onChoose, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const results = useMemo(() => searchConcepts(index, query), [index, query]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (i: number) => {
    const result = results[i];
    if (result) onChoose(result.concept);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/10 p-2 pt-3 md:pt-[12vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find a structure"
        className="panel flex max-h-[min(34rem,calc(100dvh-1.5rem))] w-full max-w-lg flex-col overflow-hidden bg-surface-solid"
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={18} className="shrink-0 text-ink-faint" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Heart, femur, left biceps, FMA ID…"
            aria-label="Search named structures"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="tap -mr-1 rounded-lg p-2 text-ink-muted hover:bg-ink/5"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
          {!query
            ? "Suggestions"
            : results.length === 60
              ? "Top 60 matches"
              : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
        </p>
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
        >
          {results.map(({ concept }, i) => {
            const first = index.parts.get(concept.elements[0] ?? "");
            const system = first ? SYSTEM_BY_ID.get(first.system) : undefined;
            return (
              <li
                key={concept.id}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={clsx(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                  i === active && "bg-accent-soft/70",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-ink/10"
                  style={{ background: system?.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{displayName(concept.name)}</span>
                <span className="shrink-0 text-xs text-ink-faint tabular-nums">
                  {concept.elements.length === 1 ? "1 piece" : `${concept.elements.length} pieces`}
                </span>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">
              No structures match “{query}”.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
