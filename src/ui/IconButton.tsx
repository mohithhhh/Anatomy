import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

/** Square icon button. `label` is the accessible name and tooltip. */
export function IconButton({ label, active, className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "tap inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors",
        "hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-35",
        active && "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
