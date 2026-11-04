import { clsx } from "clsx";
import { Check, Download, Flame, Link2, Plus, Timer, Trash2, X } from "lucide-react";
import { forwardRef, useState } from "react";
import type { AtlasIndex } from "@/atlas/atlas-index";
import type { ContentIndex } from "@/content/content";
import type { CuratedData } from "@/content/curated";
import type { Definitions } from "@/content/definitions";
import { deckToAnki, downloadText } from "@/study/anki";
import { STARTER_DECKS, deckItems, encodeDeckLink, makeDeck, type Deck } from "@/study/decks";
import { cardsFor } from "@/study/questions";
import type { Study } from "@/study/useStudy";
import { IconButton } from "../IconButton";
import { SectionTitle } from "./Chip";
import { DeckBuilder } from "./DeckBuilder";

interface Props {
  index: AtlasIndex;
  content: ContentIndex;
  study: Study;
  onClose: () => void;
  curated: CuratedData;
  definitions: Definitions | null;
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-xl bg-ink/[0.04] px-3 py-2">
      <p className="flex items-center gap-1 text-lg font-semibold tabular-nums">
        {icon}
        {value.toLocaleString("en")}
      </p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

export const StudyHome = forwardRef<HTMLElement, Props>(function StudyHome(
  { index, content, study, onClose, curated, definitions },
  ref,
) {
  const [building, setBuilding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { decks, overview } = study;
  const saved = new Set(decks.map((d) => d.id));
  const starters = STARTER_DECKS.map((s) => makeDeck(s, s.name)).filter((d) => !saved.has(d.id));

  const share = async (deck: Deck) => {
    const url = `${window.location.origin}${window.location.pathname}#${encodeDeckLink(deck)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link", url);
    }
    setCopied(deck.id);
    setTimeout(() => setCopied(null), 1800);
  };

  const start = async (deck: Deck) => {
    if (!saved.has(deck.id)) await study.saveDeck(deck);
    await study.startDeck(deck);
  };

  return (
    <section
      ref={ref}
      aria-labelledby="study-title"
      className={clsx(
        "panel z-30 flex flex-col overflow-hidden bg-surface-solid/95",
        "fixed inset-x-2 bottom-2 max-h-[72dvh]",
        "md:absolute md:inset-x-auto md:top-24 md:right-4 md:bottom-4 md:max-h-none md:w-96",
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 id="study-title" className="text-lg font-semibold tracking-tight">
          {building ? "New deck" : "Study"}
        </h2>
        <IconButton
          label="Close study"
          onClick={building ? () => setBuilding(false) : onClose}
          className="-mr-2"
        >
          <X size={18} aria-hidden />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {building ? (
          <DeckBuilder
            index={index}
            content={content}
            onCancel={() => setBuilding(false)}
            onCreate={async (deck, startNow) => {
              await study.saveDeck(deck);
              setBuilding(false);
              if (startNow) await study.startDeck(deck);
            }}
          />
        ) : (
          <>
            <div className="flex gap-2">
              <Stat
                label="Day streak"
                value={overview.streak}
                icon={<Flame size={16} className="text-amber-500" aria-hidden />}
              />
              <Stat label="Due now" value={study.dueTotal} />
              <Stat label="Reviewed today" value={overview.reviewedToday} />
            </div>
            {!study.persistent && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                This browser is not saving data (private mode?), so progress lasts only for this
                visit.
              </p>
            )}

            {decks.length > 0 && (
              <div className="mt-4">
                <SectionTitle>Your decks</SectionTitle>
                <ul className="space-y-2">
                  {decks.map((deck) => {
                    const stats = overview.stats.get(deck.id);
                    const ready = (stats?.due ?? 0) + (stats?.newAvailable ?? 0);
                    return (
                      <li key={deck.id} className="rounded-xl border border-line p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{deck.name}</p>
                            <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                              {stats
                                ? `${stats.due} due · ${stats.newAvailable} new · ${stats.learned}/${stats.total} seen`
                                : "…"}
                            </p>
                          </div>
                          <IconButton
                            label={`Copy link to ${deck.name}`}
                            onClick={() => share(deck)}
                            className="size-8"
                          >
                            {copied === deck.id ? (
                              <Check size={15} aria-hidden />
                            ) : (
                              <Link2 size={15} aria-hidden />
                            )}
                          </IconButton>
                          <IconButton
                            label={`Export ${deck.name} for Anki`}
                            className="size-8"
                            onClick={() =>
                              downloadText(
                                `${deck.name.replace(/[^A-Za-z0-9]+/g, "-")}.anki.txt`,
                                deckToAnki(
                                  deck,
                                  content,
                                  curated,
                                  definitions,
                                  window.location.origin,
                                ),
                              )
                            }
                          >
                            <Download size={15} aria-hidden />
                          </IconButton>
                          <IconButton
                            label={`Delete ${deck.name}`}
                            className="size-8"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete “${deck.name}”? Your progress on its cards is kept.`,
                                )
                              ) {
                                void study.deleteDeck(deck.id);
                              }
                            }}
                          >
                            <Trash2 size={15} aria-hidden />
                          </IconButton>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => start(deck)}
                            disabled={ready === 0}
                            className="tap h-9 flex-1 rounded-lg bg-ink text-sm font-medium text-white hover:bg-ink/85 disabled:bg-ink/10 disabled:text-ink-muted"
                          >
                            {ready === 0
                              ? "All done for today"
                              : `Study ${Math.min(ready, 30)} cards`}
                          </button>
                          <button
                            type="button"
                            onClick={() => void study.startExam(deck)}
                            className="tap flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink-muted hover:bg-ink/5 hover:text-ink"
                            title="10 timed stations, typed answers, like a practical exam"
                          >
                            <Timer size={15} aria-hidden /> Exam
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setBuilding(true)}
              className="tap mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/25 text-sm font-medium text-ink-muted hover:bg-ink/5 hover:text-ink"
            >
              <Plus size={16} aria-hidden /> New deck
            </button>

            {starters.length > 0 && (
              <div className="mt-5">
                <SectionTitle>
                  {decks.length ? "More to try" : "Start with a ready-made deck"}
                </SectionTitle>
                <ul className="space-y-1.5">
                  {starters.map((deck) => {
                    const items = deckItems(content, deck);
                    const count = cardsFor(items, deck.types).length;
                    return (
                      <li key={deck.id}>
                        <button
                          type="button"
                          onClick={() => start(deck)}
                          className="tap flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-ink/5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{deck.name}</span>
                            <span className="block text-xs text-ink-muted">
                              {items.length} structures · {count} cards
                            </span>
                          </span>
                          <span className="text-xs font-medium text-accent">Start</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <p className="mt-5 text-[11px] leading-relaxed text-ink-faint">
              Progress is saved on this device only. Cards come back just before you would forget
              them, using the FSRS spaced-repetition algorithm.
            </p>
          </>
        )}
      </div>
    </section>
  );
});
