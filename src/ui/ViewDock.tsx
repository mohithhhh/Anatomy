import { Layers3, Pause, RotateCcw, RotateCw } from "lucide-react";
import { forwardRef, type CSSProperties } from "react";
import type { ViewPreset } from "@/viewer/AnatomyViewer";
import { IconButton } from "./IconButton";

interface Props {
  explode: number;
  view: ViewPreset;
  rotate: boolean;
  onExplode: (value: number) => void;
  onView: (view: ViewPreset) => void;
  onRotate: () => void;
  onReset: () => void;
  onSystems: () => void;
}

const VIEWS: { id: ViewPreset; short: string; label: string }[] = [
  { id: "three-quarter", short: "¾", label: "Three-quarter view" },
  { id: "front", short: "F", label: "Front view" },
  { id: "side", short: "S", label: "Side view" },
  { id: "back", short: "B", label: "Back view" },
];

export const ViewDock = forwardRef<HTMLDivElement, Props>(function ViewDock(
  { explode, view, rotate, onExplode, onView, onRotate, onReset, onSystems },
  ref,
) {
  const percent = Math.round(explode * 100);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 md:p-4"
    >
      <div className="pointer-events-auto panel flex w-full max-w-xl flex-wrap items-center gap-x-2 gap-y-1 p-1.5 md:flex-nowrap md:gap-3 md:p-2">
        <IconButton label="Systems" onClick={onSystems} className="md:hidden">
          <Layers3 size={19} aria-hidden />
        </IconButton>
        <div className="flex min-w-0 flex-1 basis-[60%] flex-col px-1 md:basis-auto md:px-2">
          <div className="flex items-baseline justify-between text-xs">
            <label htmlFor="explode" className="font-medium text-ink-muted">
              Explode
            </label>
            <output htmlFor="explode" className="text-ink tabular-nums">
              {percent}%
            </output>
          </div>
          <input
            id="explode"
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(e) => onExplode(Number(e.target.value) / 100)}
            className="range w-full"
            style={{ "--fill": `${percent}%` } as CSSProperties}
            aria-valuetext={`${percent}% exploded`}
          />
        </div>
        <div
          className="flex w-full items-center justify-between gap-0.5 border-t border-line pt-1 md:w-auto md:justify-start md:border-t-0 md:border-l md:pt-0 md:pl-2"
          role="group"
          aria-label="Camera"
        >
          {VIEWS.map((v) => (
            <IconButton
              key={v.id}
              label={v.label}
              active={view === v.id && explode < 0.8}
              aria-pressed={view === v.id}
              disabled={explode > 0.8 && v.id !== "front"}
              onClick={() => onView(v.id)}
              className="text-sm font-semibold"
            >
              {v.short}
            </IconButton>
          ))}
          <IconButton
            label={rotate ? "Pause rotation" : "Rotate body"}
            active={rotate}
            disabled={explode >= 0.4}
            onClick={onRotate}
          >
            {rotate ? <Pause size={17} aria-hidden /> : <RotateCw size={17} aria-hidden />}
          </IconButton>
          <IconButton label="Reset view" onClick={onReset}>
            <RotateCcw size={17} aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  );
});
