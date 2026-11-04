import { ExternalLink, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { APP_NAME } from "./Header";

interface Props {
  pieces: number;
  concepts: number;
  onClose: () => void;
}

const LINKS = [
  {
    label: "BodyParts3D dataset license (CC BY 4.0)",
    href: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
  },
  {
    label: "Original geometry and metadata",
    href: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html",
  },
  {
    label: "Source publication (Mitsuhashi et al., 2009)",
    href: "https://doi.org/10.1093/nar/gkn613",
  },
  {
    label: "Viewer adapted from human-atlas (MIT)",
    href: "https://github.com/ashemag/human-atlas",
  },
  { label: "Full attribution", href: "/ATTRIBUTION.md" },
];

export function AboutDialog({ pieces, concepts, onClose }: Props) {
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  // Focus once on open; return focus to where it was on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/15 p-2 md:items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="panel max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto bg-surface-solid p-5 select-text"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
              About
            </p>
            <h2 id="about-title" className="mt-0.5 text-xl font-semibold tracking-tight">
              {APP_NAME}: a free 3D study atlas
            </h2>
          </div>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap -mt-1 -mr-2 rounded-lg p-2 text-ink-muted hover:bg-ink/5"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-muted">
          <p>
            Explore {pieces.toLocaleString("en")} individual meshes and{" "}
            {concepts.toLocaleString("en")} named structures from an adult male reference anatomy.
            Free, with no account. Quizzes and spaced repetition are next.
          </p>
          <p>
            The model does not include every human structure or variation. Named structures can
            contain several pieces. Colours and system groupings are chosen for study, and geometry
            is simplified for the web.
          </p>
          <p className="rounded-lg bg-ink/[0.04] px-3 py-2 text-xs">
            For education only. This is not a diagnostic, clinical or surgical reference.
          </p>
        </div>
        <h3 className="mt-4 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
          Sources and credits
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0
          International.
        </p>
        <ul className="mt-2 space-y-1">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                {link.label} <ExternalLink size={12} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
