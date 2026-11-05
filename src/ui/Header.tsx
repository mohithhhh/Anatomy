import { Compass, GraduationCap, Info, Search } from "lucide-react";
import { forwardRef } from "react";
import { IconButton } from "./IconButton";

import { BODIES, type BodyId } from "@/atlas/model-source";

interface Props {
  pieces: number;
  body: BodyId;
  onBody: (body: BodyId) => void;
  studying: boolean;
  /** Cards due across all decks, shown as a badge. */
  due: number;
  onSearch: () => void;
  onAbout: () => void;
  onToggleStudy: () => void;
}

export const APP_NAME = "Anatomy";

export const Header = forwardRef<HTMLElement, Props>(function Header(
  { pieces, body, onBody, studying, due, onSearch, onAbout, onToggleStudy },
  ref,
) {
  return (
    <header
      ref={ref}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 md:p-4"
    >
      <div className="pointer-events-auto panel min-w-0 px-3 py-2.5 min-[360px]:px-4">
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="inline-block size-2 rounded-full bg-accent" aria-hidden />
          {APP_NAME}
          <span className="rounded-md border border-line px-1.5 py-px text-[10px] font-medium tracking-wider text-ink-muted">
            3D
          </span>
        </h1>
        <div className="mt-1.5 flex items-center gap-2">
          <div role="radiogroup" aria-label="Body" className="flex rounded-lg bg-ink/[0.06] p-0.5">
            {(Object.keys(BODIES) as BodyId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={body === id}
                onClick={() => onBody(id)}
                className={`tap rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${body === id ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {BODIES[id].label}
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-ink-muted tabular-nums sm:inline">
            {pieces ? `${pieces.toLocaleString("en")} pieces · ${BODIES[body].source}` : "Loading…"}
          </span>
        </div>
      </div>
      <nav aria-label="Main" className="pointer-events-auto panel flex items-center gap-1 p-1">
        <button
          type="button"
          onClick={onToggleStudy}
          aria-pressed={studying}
          className="tap relative flex h-10 items-center gap-2 rounded-xl bg-ink px-3 text-sm font-medium text-white transition-colors hover:bg-ink/85"
        >
          {studying ? <Compass size={18} aria-hidden /> : <GraduationCap size={18} aria-hidden />}
          <span className="max-[359px]:sr-only">{studying ? "Explore" : "Study"}</span>
          {!studying && due > 0 && (
            <span
              className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-ink tabular-nums"
              aria-label={`${due} cards due`}
            >
              {due > 99 ? "99+" : due}
            </span>
          )}
        </button>
        {!studying && (
          <button
            type="button"
            onClick={onSearch}
            className="tap flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Find a structure"
            aria-keyshortcuts="/"
          >
            <Search size={18} aria-hidden />
            <span className="hidden sm:inline">Find a structure</span>
            <kbd className="hidden rounded-md border border-line px-1.5 text-[11px] font-sans text-ink-faint sm:inline">
              /
            </kbd>
          </button>
        )}
        <IconButton label="About and credits" onClick={onAbout}>
          <Info size={18} aria-hidden />
        </IconButton>
      </nav>
    </header>
  );
});
