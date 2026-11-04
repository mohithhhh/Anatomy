import { clsx } from "clsx";
import { Check, Keyboard, MousePointerClick, X } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Rating } from "@/study/scheduler";
import type { Study } from "@/study/useStudy";
import { IconButton } from "../IconButton";

interface Props {
  study: Study;
}

const TYPED_KEY = "anatomy:typed-answers";

function readTypedPreference() {
  try {
    return localStorage.getItem(TYPED_KEY) === "1";
  } catch {
    return false;
  }
}

export const QuizPanel = forwardRef<HTMLElement, Props>(function QuizPanel({ study }, ref) {
  const session = study.session!;
  const { question, answer } = session;
  const [typing, setTyping] = useState(readTypedPreference);
  const [typed, setTyped] = useState("");
  const nextButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const canType = question?.typedAnswer !== undefined;
  const useTyping = typing && canType;

  // New question: reset the input. Answered: move focus to "Next" so Enter continues.
  useEffect(() => setTyped(""), [question]);
  useEffect(() => {
    if (answer) nextButton.current?.focus();
    else if (useTyping) input.current?.focus();
  }, [answer, useTyping, question]);

  // Number keys choose an option; Enter continues; Escape ends the session.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") {
        study.exit();
        return;
      }
      if (!question || answer) return;
      const n = Number(e.key);
      if (question.kind === "choice" && !useTyping && n >= 1 && n <= question.options.length) {
        e.preventDefault();
        study.answerChoice(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, answer, useTyping, study]);

  if (!question) return null;
  const total = session.queue.length;
  const progress = Math.round((session.position / Math.max(1, total)) * 100);
  const correctAnswer =
    question.kind === "pick" ? question.subjects[0]?.name : question.options[question.correctIndex];

  const setTypingPreference = (on: boolean) => {
    setTyping(on);
    try {
      localStorage.setItem(TYPED_KEY, on ? "1" : "0");
    } catch {
      // Preference only.
    }
  };

  return (
    <section
      ref={ref}
      aria-label="Quiz"
      className={clsx(
        "panel z-30 flex flex-col overflow-hidden bg-surface-solid/95",
        "fixed inset-x-2 bottom-2 max-h-[55dvh]",
        "md:absolute md:inset-x-auto md:bottom-4 md:left-1/2 md:max-h-[60dvh] md:w-[34rem] md:-translate-x-1/2",
      )}
    >
      <div className="h-1 shrink-0 bg-ink/10">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-2 px-4 pt-2.5">
        <p className="min-w-0 flex-1 truncate text-xs text-ink-muted">
          {session.title} ·{" "}
          <span className="tabular-nums">
            {Math.min(session.position + 1, total)} / {total}
          </span>
        </p>
        <IconButton label="End session" onClick={study.exit} className="-mr-2 size-8">
          <X size={16} aria-hidden />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <h2 className="text-base font-semibold leading-snug" id="quiz-prompt">
          {question.prompt}
        </h2>
        {question.subjects.length > 0 && (
          <ol className="mt-2 space-y-1">
            {question.subjects.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm font-medium">
                {s.color ? (
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                ) : null}
                <span className={clsx(question.kind === "pick" && "text-lg")}>
                  {question.subjects.length > 1 && (
                    <span className="mr-1 text-ink-faint">{i === 0 ? "First:" : "Second:"}</span>
                  )}
                  {s.name}
                </span>
              </li>
            ))}
          </ol>
        )}

        {question.kind === "pick" && !answer && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-ink/[0.04] px-3 py-2 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <MousePointerClick size={15} aria-hidden /> Click it on the model. Drag to turn,
              scroll to zoom.
            </span>
            <button
              type="button"
              onClick={() => study.answerPick(null)}
              className="tap shrink-0 font-medium text-ink hover:underline"
            >
              Show me
            </button>
          </div>
        )}

        {question.kind === "choice" && !useTyping && (
          <div
            className={clsx(
              "mt-3 grid gap-2",
              question.options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
            )}
            role="group"
            aria-labelledby="quiz-prompt"
          >
            {question.options.map((option, i) => {
              const isCorrect = i === question.correctIndex;
              const chosen = answer?.chosen === i;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!!answer}
                  onClick={() => study.answerChoice(i)}
                  className={clsx(
                    "tap flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    !answer && "border-line hover:border-ink/30 hover:bg-ink/[0.03]",
                    answer && isCorrect && "border-green-600 bg-green-50 text-green-900",
                    answer && chosen && !isCorrect && "border-red-600 bg-red-50 text-red-900",
                    answer && !isCorrect && !chosen && "border-line opacity-60",
                  )}
                >
                  <kbd className="hidden size-5 shrink-0 items-center justify-center rounded border border-line text-[10px] text-ink-faint sm:inline-flex">
                    {i + 1}
                  </kbd>
                  <span className="min-w-0 flex-1">{option}</span>
                  {answer && isCorrect && (
                    <Check size={16} className="shrink-0 text-green-700" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {useTyping && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!answer && typed.trim()) study.answerTyped(typed);
            }}
          >
            <input
              ref={input}
              value={answer?.typed ?? typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!!answer}
              placeholder="Type the full name, e.g. Left humerus"
              aria-label="Your answer"
              autoComplete="off"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent"
            />
            {!answer && (
              <button
                type="submit"
                className="tap h-11 rounded-xl bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85"
              >
                Check
              </button>
            )}
          </form>
        )}

        {canType && !answer && (
          <button
            type="button"
            onClick={() => setTypingPreference(!typing)}
            className="tap mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
          >
            <Keyboard size={14} aria-hidden />{" "}
            {typing ? "Choose from options instead" : "Type the answer instead"}
          </button>
        )}

        {answer && (
          <div
            role="status"
            className={clsx(
              "mt-3 rounded-xl px-3 py-2.5 text-sm",
              answer.correct
                ? answer.typedGrade === "close"
                  ? "bg-amber-50 text-amber-950"
                  : "bg-green-50 text-green-950"
                : "bg-red-50 text-red-950",
            )}
          >
            <p className="font-semibold">
              {answer.correct
                ? answer.typedGrade === "close"
                  ? `Almost. Check the spelling: ${correctAnswer}`
                  : "Correct"
                : `Not quite. The answer is ${correctAnswer}.`}
            </p>
            <p className="mt-0.5 opacity-80">{question.explanation}</p>
          </div>
        )}
      </div>

      {answer && (
        <div className="flex shrink-0 items-center gap-2 border-t border-line p-2">
          {answer.correct && (
            <>
              <button
                type="button"
                onClick={() => void study.next(Rating.Hard)}
                className="tap h-10 rounded-xl px-3 text-xs font-medium text-ink-muted hover:bg-ink/5"
              >
                I guessed
              </button>
              <button
                type="button"
                onClick={() => void study.next(Rating.Easy)}
                className="tap h-10 rounded-xl px-3 text-xs font-medium text-ink-muted hover:bg-ink/5"
              >
                Too easy
              </button>
            </>
          )}
          <button
            ref={nextButton}
            type="button"
            onClick={() => void study.next()}
            className="tap ml-auto h-10 rounded-xl bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
});
