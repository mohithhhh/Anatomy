import { clsx } from "clsx";
import { Check, ChevronRight, ExternalLink, Focus, GraduationCap, Link2, X } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { AtlasIndex } from "@/atlas/atlas-index";
import { displayName } from "@/atlas/search";
import { SYSTEM_BY_ID } from "@/atlas/systems";
import type { Concept } from "@/atlas/types";
import type { StudyItem } from "@/content/content";
import { nerveName, type CuratedData } from "@/content/curated";
import type { FoundDefinition } from "@/content/definitions";
import { REGION_BY_ID, type RegionId } from "@/content/regions";
import type { Selection } from "@/state/view-state";
import { IconButton } from "./IconButton";

interface Props {
  index: AtlasIndex;
  selection: Selection;
  partIds: readonly string[];
  isolated: boolean;
  onIsolate: (isolate: boolean) => void;
  onSelectPart: (id: string) => void;
  onClose: () => void;
  onCopyLink: () => Promise<void>;
  /** Study content for this selection, when there is any. */
  info: {
    item: StudyItem | undefined;
    regions: readonly RegionId[];
    groups: readonly Concept[];
    siblings: readonly StudyItem[];
    quizCount: number;
    definition: FoundDefinition | null;
  } | null;
  curated: CuratedData;
  onLesion: (nerveId: string) => void;
  onSelectConcept: (conceptId: string) => void;
  onQuiz: () => void;
}

const MAX_SIBLINGS = 8;

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-ink/5"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight size={14} className="shrink-0 text-ink-faint" aria-hidden />
    </button>
  );
}

const MAX_LISTED = 50;

function fmaUrl(conceptId: string) {
  const iri = `http://purl.org/sig/ont/fma/${conceptId.toLowerCase()}`;
  return `https://bioportal.bioontology.org/ontologies/FMA?p=classes&conceptid=${encodeURIComponent(iri)}`;
}

export const DetailPanel = forwardRef<HTMLElement, Props>(function DetailPanel(
  {
    index,
    selection,
    partIds,
    isolated,
    onIsolate,
    onSelectPart,
    onClose,
    onCopyLink,
    info,
    onSelectConcept,
    onQuiz,
    curated,
    onLesion,
  },
  ref,
) {
  const title = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);

  const part = selection.kind === "part" ? index.parts.get(selection.id) : undefined;
  const concept =
    selection.kind === "concept"
      ? index.concepts.get(selection.id)
      : part && index.concepts.get(part.conceptId);
  const first = part ?? index.parts.get(partIds[0] ?? "");
  const system = first ? SYSTEM_BY_ID.get(first.system) : undefined;
  const name = part ? part.name : concept ? displayName(concept.name) : selection.id;
  const conceptId = concept?.id ?? part?.conceptId;
  const pieces = partIds.map((id) => index.parts.get(id)).filter((p) => p !== undefined);

  // The panel remounts per selection (keyed by the caller): focus the title for keyboard and
  // screen-reader users.
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);

  const copy = async () => {
    await onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section
      ref={ref}
      aria-labelledby="detail-title"
      className={clsx(
        "panel z-30 flex flex-col overflow-hidden bg-surface-solid/95",
        "fixed inset-x-2 bottom-2 max-h-[46dvh]",
        "md:absolute md:inset-x-auto md:top-24 md:right-4 md:bottom-auto md:max-h-[calc(100dvh-12rem)] md:w-80",
      )}
    >
      <div className="h-1 shrink-0" style={{ background: system?.color }} aria-hidden />
      <div className="flex items-start gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            {system?.name ?? "Anatomy"}
          </p>
          <h2
            id="detail-title"
            ref={title}
            tabIndex={-1}
            className="mt-0.5 text-lg leading-snug font-semibold tracking-tight outline-none"
          >
            {name}
          </h2>
        </div>
        <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
          <X size={18} aria-hidden />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-3 select-text">
        {info && (info.regions.length > 0 || info.item?.side) && (
          <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
            {info.regions.slice(0, 3).map((r) => (
              <span
                key={r}
                className="rounded-md bg-accent-soft/70 px-2 py-0.5 font-medium text-accent"
              >
                {REGION_BY_ID.get(r)!.name}
              </span>
            ))}
            {info.regions.length > 3 && (
              <span className="rounded-md bg-ink/[0.05] px-2 py-0.5 text-ink-muted">
                +{info.regions.length - 3} regions
              </span>
            )}
            {info.item?.side && (
              <span className="rounded-md bg-ink/[0.05] px-2 py-0.5 text-ink-muted">
                {info.item.side === "left" ? "Left side" : "Right side"}
              </span>
            )}
          </div>
        )}

        {info?.item?.parentName && (
          <p className="mb-2 text-sm">
            <span className="text-ink-muted">Part of </span>
            {info.item.parentId ? (
              <button
                type="button"
                onClick={() => onSelectConcept(info.item!.parentId!)}
                className="tap font-medium text-accent hover:underline"
              >
                {info.item.parentName}
              </button>
            ) : (
              <span className="font-medium">{info.item.parentName}</span>
            )}
          </p>
        )}

        {info?.definition ? (
          <>
            <p className="text-sm leading-relaxed text-ink-muted">{info.definition.definition}</p>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {info.definition.general ? `Definition of ${info.definition.name}. ` : ""}
              Source: Uberon {info.definition.uberon}, CC BY 3.0.
            </p>
            {info.definition.synonyms && (
              <p className="mt-1 text-[11px] text-ink-muted">
                Also called: {info.definition.synonyms.join(", ")}
              </p>
            )}
          </>
        ) : (
          system && (
            <>
              <p className="text-sm leading-relaxed text-ink-muted">{system.description}</p>
              <p className="mt-1.5 text-[11px] text-ink-faint">
                System overview: no structure-specific definition yet.
              </p>
            </>
          )
        )}

        {info?.item?.muscle && (
          <div className="mt-3 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                {info.item.muscleName}
              </h3>
              <span className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-900">
                Draft · pending review
              </span>
            </div>
            <dl className="mt-2 space-y-1.5 text-sm">
              {(
                [
                  ["Origin", info.item.muscle.o],
                  ["Insertion", info.item.muscle.i],
                  ["Action", info.item.muscle.a],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] text-ink-faint">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-[11px] text-ink-faint">Nerve supply</dt>
                <dd>
                  {curated.nerves[info.item.muscle.n] ? (
                    <button
                      type="button"
                      onClick={() => onLesion(info.item!.muscle!.n)}
                      className="tap font-medium text-accent hover:underline"
                      title="Show what happens if this nerve is injured"
                    >
                      {nerveName(curated, info.item.muscle.n)}
                    </button>
                  ) : (
                    nerveName(curated, info.item.muscle.n)
                  )}{" "}
                  <span className="text-ink-muted">({info.item.muscle.r})</span>
                </dd>
              </div>
            </dl>
          </div>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-ink/[0.04] px-2.5 py-2">
            <dt className="text-ink-faint">FMA ID</dt>
            <dd className="mt-0.5 font-medium text-ink tabular-nums">{conceptId ?? "—"}</dd>
          </div>
          <div className="rounded-lg bg-ink/[0.04] px-2.5 py-2">
            <dt className="text-ink-faint">{part ? "Mesh" : "Pieces"}</dt>
            <dd className="mt-0.5 font-medium text-ink tabular-nums">
              {part ? part.id : pieces.length.toLocaleString("en")}
            </dd>
          </div>
        </dl>

        {pieces.length > 1 && (
          <div className="mt-3">
            <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
              Included pieces
            </h3>
            <ul className="-mx-1.5">
              {pieces.slice(0, MAX_LISTED).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPart(p.id)}
                    className="tap flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-ink/5"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <ChevronRight size={14} className="shrink-0 text-ink-faint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {pieces.length > MAX_LISTED && (
              <p className="mt-1 text-xs text-ink-faint">
                And {pieces.length - MAX_LISTED} more pieces.
              </p>
            )}
          </div>
        )}

        {info && info.siblings.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
              Other parts of {info.item?.parentName?.toLowerCase() ?? "this structure"}
            </h3>
            <div className="-mx-1.5">
              {info.siblings.slice(0, MAX_SIBLINGS).map((s) => (
                <LinkRow
                  key={s.conceptId}
                  label={s.name}
                  onClick={() => onSelectConcept(s.conceptId)}
                />
              ))}
            </div>
            {info.siblings.length > MAX_SIBLINGS && (
              <p className="mt-1 text-xs text-ink-faint">
                And {info.siblings.length - MAX_SIBLINGS} more.
              </p>
            )}
          </div>
        )}

        {info && info.groups.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
              Belongs to
            </h3>
            <div className="-mx-1.5">
              {info.groups.map((g) => (
                <LinkRow
                  key={g.id}
                  label={displayName(g.name)}
                  onClick={() => onSelectConcept(g.id)}
                />
              ))}
            </div>
          </div>
        )}

        {conceptId && (
          <a
            href={fmaUrl(conceptId)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            FMA entry on BioPortal <ExternalLink size={12} aria-hidden />
          </a>
        )}
        <p className="mt-2 text-[11px] text-ink-faint">
          For education only, not clinical use.{" "}
          <a
            href={`https://github.com/mohithhhh/anatomy/issues/new?title=${encodeURIComponent(`Content error: ${name}`)}&body=${encodeURIComponent(`Structure: ${name}\nFMA ID: ${conceptId ?? "?"}\nLink: ${window.location.href}\n\nWhat is wrong, and your source:\n`)}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-ink"
          >
            Report an error
          </a>
        </p>
      </div>

      {info && info.quizCount > 0 && (
        <div className="shrink-0 border-t border-line px-2 pt-2">
          <button
            type="button"
            onClick={onQuiz}
            className="tap flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent-soft text-sm font-medium text-accent hover:bg-accent-soft/70"
          >
            <GraduationCap size={17} aria-hidden />
            {info.quizCount === 1 ? "Quiz me on this" : `Quiz me on these ${info.quizCount}`}
          </button>
        </div>
      )}
      <div className="flex shrink-0 gap-2 border-t border-line p-2">
        <button
          type="button"
          onClick={() => onIsolate(!isolated)}
          aria-pressed={isolated}
          className={clsx(
            "tap flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors",
            isolated ? "bg-accent-soft text-accent" : "bg-ink text-white hover:bg-ink/85",
          )}
        >
          <Focus size={17} aria-hidden />
          {isolated ? "Show surroundings" : "Isolate"}
        </button>
        <button
          type="button"
          onClick={copy}
          className="tap flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </section>
  );
});
