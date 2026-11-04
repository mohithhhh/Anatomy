import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Toggle chip used in pickers. */
export function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={clsx(
        "tap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        on
          ? "border-accent bg-accent-soft text-accent"
          : "border-line text-ink-muted hover:bg-ink/5 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
      {children}
    </h3>
  );
}
