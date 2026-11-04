import { Activity, AlertTriangle } from "lucide-react";

export function LoadingStatus({ progress }: { progress: number }) {
  return (
    <div
      role="status"
      className="panel absolute top-1/2 left-1/2 z-40 flex w-72 -translate-x-1/2 -translate-y-1/2 items-center gap-3 p-4"
    >
      <Activity size={20} className="shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Preparing the anatomy</p>
        <p className="text-xs text-ink-muted tabular-nums">{progress}% of 34 MB</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ErrorStatus({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="panel absolute top-1/2 left-1/2 z-40 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 p-5"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-danger">
        <AlertTriangle size={18} aria-hidden /> Something went wrong
      </p>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="tap mt-4 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-ink/85"
      >
        Reload
      </button>
    </div>
  );
}
