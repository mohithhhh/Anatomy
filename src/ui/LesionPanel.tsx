import { clsx } from "clsx";
import { Zap, X } from "lucide-react";
import { forwardRef } from "react";
import type { CuratedData } from "@/content/curated";
import type { StudyItem } from "@/content/content";
import { IconButton } from "./IconButton";

interface Props {
  curated: CuratedData;
  nerveId: string;
  affected: readonly StudyItem[];
  onChange: (nerveId: string) => void;
  onSelect: (conceptId: string) => void;
  onClose: () => void;
}

/** "What if this nerve were cut?" Highlights the muscles it supplies and lists the deficits. */
export const LesionPanel = forwardRef<HTMLElement, Props>(function LesionPanel(
  { curated, nerveId, affected, onChange, onSelect, onClose },
  ref,
) {
  const nerve = curated.nerves[nerveId];
  const muscles = [...new Set(affected.map((i) => i.muscleName ?? i.name))].sort();
  return (
    <section
      ref={ref}
      aria-labelledby="lesion-title"
      className={clsx(
        "panel z-30 flex flex-col overflow-hidden bg-surface-solid/95",
        "fixed inset-x-2 bottom-2 max-h-[50dvh]",
        "md:absolute md:inset-x-auto md:top-24 md:right-4 md:bottom-auto md:max-h-[calc(100dvh-12rem)] md:w-80",
      )}
    >
      <div className="h-1 shrink-0 bg-red-600" aria-hidden />
      <div className="flex items-start gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-red-700 uppercase">
            <Zap size={12} aria-hidden /> Nerve lesion
          </p>
          <label htmlFor="lesion-nerve" className="sr-only">
            Nerve
          </label>
          <select
            id="lesion-nerve"
            value={nerveId}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-base font-semibold"
          >
            {Object.entries(curated.nerves).map(([id, n]) => (
              <option key={id} value={id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <IconButton label="Close lesion view" onClick={onClose} className="-mr-2">
          <X size={18} aria-hidden />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-3 select-text">
        <h2 id="lesion-title" className="sr-only">
          {nerve?.name} lesion
        </h2>
        <p className="text-xs text-ink-muted">Roots {nerve?.roots}</p>
        <p className="mt-2 text-sm leading-relaxed">{nerve?.lesion}</p>
        <h3 className="mt-3 mb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
          Muscles affected ({muscles.length}), shown in red
        </h3>
        <ul className="-mx-1.5">
          {muscles.map((name) => {
            const item = affected.find((i) => (i.muscleName ?? i.name) === name)!;
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => onSelect(item.conceptId)}
                  className="tap w-full rounded-md px-1.5 py-1 text-left text-sm hover:bg-ink/5"
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          Draft teaching content, pending expert review. Lists the main muscles in this model only;
          for education, not clinical use.
        </p>
      </div>
    </section>
  );
});
