import { clsx } from "clsx";
import { Check, ChevronRight, ExternalLink, Focus, Link2, X } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { AtlasIndex } from "@/atlas/atlas-index";
import { displayName } from "@/atlas/search";
import { SYSTEM_BY_ID } from "@/atlas/systems";
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
}

const MAX_LISTED = 50;

function fmaUrl(conceptId: string) {
  const iri = `http://purl.org/sig/ont/fma/${conceptId.toLowerCase()}`;
  return `https://bioportal.bioontology.org/ontologies/FMA?p=classes&conceptid=${encodeURIComponent(iri)}`;
}

export const DetailPanel = forwardRef<HTMLElement, Props>(function DetailPanel(
  { index, selection, partIds, isolated, onIsolate, onSelectPart, onClose, onCopyLink },
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

  // Move focus to the title when the selection changes, for keyboard and screen-reader users.
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    setCopied(false);
  }, [selection.id]);

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
        "md:absolute md:inset-x-auto md:top-24 md:right-4 md:bottom-auto md:max-h-[calc(100dvh-14rem)] md:w-80",
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
        {system && (
          <>
            <p className="text-sm leading-relaxed text-ink-muted">{system.description}</p>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              System overview. Structure-specific notes are coming.
            </p>
          </>
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
        <p className="mt-2 text-[11px] text-ink-faint">For education only, not clinical use.</p>
      </div>

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
