import { clsx } from "clsx";
import { X } from "lucide-react";
import { forwardRef } from "react";
import type { AtlasIndex } from "@/atlas/atlas-index";
import { PRESETS, SYSTEM_BY_ID } from "@/atlas/systems";
import type { SystemId } from "@/atlas/types";
import { IconButton } from "./IconButton";

interface Props {
  index: AtlasIndex;
  visible: readonly SystemId[];
  visibleCount: number;
  /** Mobile: shown as a bottom sheet only while open. Desktop: always shown. */
  open: boolean;
  onClose: () => void;
  onChange: (visible: SystemId[]) => void;
}

export const SystemsPanel = forwardRef<HTMLElement, Props>(function SystemsPanel(
  { index, visible, visibleCount, open, onClose, onChange },
  ref,
) {
  const shown = new Set(visible);
  const toggle = (id: SystemId) =>
    onChange(shown.has(id) ? visible.filter((v) => v !== id) : [...visible, id]);
  const isPreset = (systems: readonly SystemId[]) =>
    systems.length === shown.size && systems.every((id) => shown.has(id));

  return (
    <section
      ref={ref}
      aria-label="Body systems"
      className={clsx(
        "panel z-30 flex flex-col overflow-hidden",
        // Mobile bottom sheet
        "fixed inset-x-2 bottom-2 max-h-[70dvh]",
        !open && "max-md:hidden",
        // Desktop side panel
        "md:absolute md:inset-x-auto md:top-24 md:bottom-auto md:left-4 md:max-h-[calc(100dvh-14rem)] md:w-64",
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Systems</h2>
        <IconButton label="Close systems" onClick={onClose} className="-mr-2 md:hidden">
          <X size={18} aria-hidden />
        </IconButton>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 pb-2" role="group" aria-label="Presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={isPreset(preset.systems)}
            onClick={() => onChange([...preset.systems])}
            className={clsx(
              "tap rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              isPreset(preset.systems)
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-muted hover:bg-ink/5 hover:text-ink",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {index.activeSystems.map((id) => {
          const system = SYSTEM_BY_ID.get(id)!;
          const on = shown.has(id);
          return (
            <li key={id} className="flex items-center gap-1 rounded-lg hover:bg-ink/[0.03]">
              <button
                type="button"
                onClick={() => onChange([id])}
                title={`Show only ${system.name.toLowerCase()}`}
                className="tap flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left text-sm"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-ink/10"
                  style={{ background: system.color }}
                  aria-hidden
                />
                <span className={clsx("truncate", on ? "text-ink" : "text-ink-faint")}>
                  {system.name}
                </span>
                <span className="ml-auto text-xs text-ink-faint tabular-nums">
                  {index.counts[id]}
                </span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Show ${system.name.toLowerCase()}`}
                onClick={() => toggle(id)}
                className={clsx(
                  "tap relative mr-2 h-5 w-9 shrink-0 rounded-full transition-colors",
                  on ? "bg-accent" : "bg-ink/15",
                )}
              >
                <span
                  className={clsx(
                    "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
                    on && "translate-x-4",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-muted">
        <span>{visibleCount.toLocaleString("en")} pieces visible</span>
        <button
          type="button"
          onClick={() => onChange([])}
          className="tap rounded-md px-1.5 py-1 font-medium hover:bg-ink/5 hover:text-ink"
        >
          Hide all
        </button>
      </div>
    </section>
  );
});
