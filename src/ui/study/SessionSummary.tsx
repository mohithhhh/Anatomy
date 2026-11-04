import { PartyPopper } from "lucide-react";
import type { Summary } from "@/study/useStudy";

function when(time: number | null): string {
  if (time === null) return "";
  const minutes = Math.round((time - Date.now()) / 60_000);
  if (minutes < 1) return "in a moment";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export function SessionSummary({
  summary,
  streak,
  onDone,
}: {
  summary: Summary;
  streak: number;
  onDone: () => void;
}) {
  const percent = summary.answered ? Math.round((summary.correct / summary.answered) * 100) : 0;
  return (
    <div
      role="dialog"
      aria-labelledby="summary-title"
      className="panel fixed inset-x-2 bottom-2 z-40 bg-surface-solid p-5 md:absolute md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[26rem] md:-translate-x-1/2"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
        <PartyPopper size={15} className="text-accent" aria-hidden /> Session complete
      </p>
      <h2 id="summary-title" className="mt-1 text-lg font-semibold tracking-tight">
        {summary.answered === 0 ? "Nothing to review right now" : summary.title}
      </h2>
      {summary.answered > 0 && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-ink/[0.04] py-2">
            <dd className="text-lg font-semibold tabular-nums">{summary.answered}</dd>
            <dt className="text-[11px] text-ink-muted">answered</dt>
          </div>
          <div className="rounded-xl bg-ink/[0.04] py-2">
            <dd className="text-lg font-semibold tabular-nums">{percent}%</dd>
            <dt className="text-[11px] text-ink-muted">correct</dt>
          </div>
          <div className="rounded-xl bg-ink/[0.04] py-2">
            <dd className="text-lg font-semibold tabular-nums">{streak}</dd>
            <dt className="text-[11px] text-ink-muted">day streak</dt>
          </div>
        </dl>
      )}
      <p className="mt-3 text-sm text-ink-muted">
        {summary.nextDue
          ? `Next review ${when(summary.nextDue)}. Come back then and the cards you found hard will be waiting.`
          : "Come back tomorrow for new cards."}
      </p>
      <button
        type="button"
        autoFocus
        onClick={onDone}
        className="tap mt-4 h-10 w-full rounded-xl bg-ink text-sm font-medium text-white hover:bg-ink/85"
      >
        Done
      </button>
    </div>
  );
}
