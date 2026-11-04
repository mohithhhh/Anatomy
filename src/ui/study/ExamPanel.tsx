import { clsx } from "clsx";
import { Check, Timer, X } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { Study } from "@/study/useStudy";
import { IconButton } from "../IconButton";

/** Practical-exam stations: 60 seconds each, typed answers, results at the end. */
export const ExamPanel = forwardRef<HTMLElement, { study: Study }>(function ExamPanel(
  { study },
  ref,
) {
  const exam = study.exam!;
  const done = exam.index >= exam.stations.length;
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const typedRef = useRef(typed);
  typedRef.current = typed;

  useEffect(() => {
    setTyped("");
    input.current?.focus();
  }, [exam.index]);

  // Countdown; time running out submits whatever has been typed.
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - exam.stationStart >= exam.seconds * 1000) study.submitExam(typedRef.current);
    }, 250);
    return () => clearInterval(timer);
  }, [done, exam.stationStart, exam.seconds, study]);

  const left = Math.max(0, exam.seconds - Math.floor((now - exam.stationStart) / 1000));
  const correct = exam.answers.filter((a) => a.grade !== "wrong").length;

  return (
    <section
      ref={ref}
      aria-label="Practical exam"
      className={clsx(
        "panel z-30 flex flex-col overflow-hidden bg-surface-solid/95",
        "fixed inset-x-2 bottom-2 max-h-[60dvh]",
        "md:absolute md:inset-x-auto md:bottom-4 md:left-1/2 md:max-h-[70dvh] md:w-[32rem] md:-translate-x-1/2",
      )}
    >
      {!done && (
        <div className="h-1 shrink-0 bg-ink/10">
          <div
            className={clsx(
              "h-full transition-[width] duration-200",
              left <= 10 ? "bg-red-600" : "bg-accent",
            )}
            style={{ width: `${(left / exam.seconds) * 100}%` }}
          />
        </div>
      )}
      <div className="flex items-center gap-2 px-4 pt-2.5">
        <p className="min-w-0 flex-1 truncate text-xs text-ink-muted">
          Practical exam · {exam.title}
          {!done && (
            <span className="tabular-nums">
              {" "}
              · Station {exam.index + 1} / {exam.stations.length}
            </span>
          )}
        </p>
        {!done && (
          <span
            className={clsx(
              "flex items-center gap-1 text-sm font-semibold tabular-nums",
              left <= 10 && "text-red-700",
            )}
            aria-live="off"
          >
            <Timer size={15} aria-hidden /> {left}s
          </span>
        )}
        <IconButton label="End exam" onClick={study.closeExam} className="-mr-2 size-8">
          <X size={16} aria-hidden />
        </IconButton>
      </div>

      {!done ? (
        <form
          className="px-4 pt-1 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            study.submitExam(typed);
          }}
        >
          <h2 className="text-base font-semibold">Name the tagged structure</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Type the full name, including the side. No feedback until the end.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              ref={input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Your answer"
              autoComplete="off"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="tap h-11 rounded-xl bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85"
            >
              Next
            </button>
          </div>
        </form>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
          <h2 className="text-lg font-semibold">
            Score {correct} / {exam.stations.length}
          </h2>
          <ol className="mt-2 divide-y divide-line text-sm">
            {exam.stations.map((q, i) => {
              const a = exam.answers[i]!;
              const ok = a.grade !== "wrong";
              return (
                <li key={q.card.id} className="flex items-start gap-2 py-1.5">
                  <span className={clsx("mt-0.5 shrink-0", ok ? "text-green-700" : "text-red-700")}>
                    {ok ? (
                      <Check size={15} aria-label="Correct" />
                    ) : (
                      <X size={15} aria-label="Wrong" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{q.typedAnswer}</span>
                    {!ok && (
                      <span className="block text-xs text-ink-muted">
                        You wrote: {a.typed || "nothing"}
                      </span>
                    )}
                    {a.grade === "close" && (
                      <span className="block text-xs text-amber-800">
                        Accepted, check the spelling: {a.typed}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex gap-2">
            {correct < exam.stations.length && (
              <button
                type="button"
                onClick={() => {
                  const missed = exam.stations.filter((_, i) => exam.answers[i]!.grade === "wrong");
                  study.closeExam();
                  study.reviewMissed(missed);
                }}
                className="tap h-10 flex-1 rounded-xl bg-ink text-sm font-medium text-white hover:bg-ink/85"
              >
                Review my misses
              </button>
            )}
            <button
              type="button"
              onClick={study.closeExam}
              className="tap h-10 flex-1 rounded-xl border border-line text-sm font-medium text-ink-muted hover:bg-ink/5"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  );
});
