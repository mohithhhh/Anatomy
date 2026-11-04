/**
 * Privacy-friendly analytics: no cookies, no personal data, nothing stored about the person
 * beyond the date of their first visit (kept on their device). Events are sent to Plausible only
 * when VITE_PLAUSIBLE_DOMAIN is set at build time; otherwise every call is a no-op.
 */
const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const endpoint =
  (import.meta.env.VITE_PLAUSIBLE_ENDPOINT as string | undefined) ??
  "https://plausible.io/api/event";

type Props = Record<string, string | number | boolean>;

export function track(name: string, props: Props = {}): void {
  if (!domain || typeof window === "undefined") return;
  // Deep links carry the selected structure in the hash; never send it.
  const url = `${window.location.origin}${window.location.pathname}`;
  const body = JSON.stringify({ name, url, domain, props });
  try {
    if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: "text/plain" }))) {
      void fetch(endpoint, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics must never break the app.
  }
}

const FIRST_VISIT_KEY = "anatomy:first-visit";

/** Bucket for "how long since this browser first opened the app", for return-rate charts. */
export function returnBucket(now = Date.now()): string {
  let first = now;
  try {
    const stored = Number(localStorage.getItem(FIRST_VISIT_KEY));
    if (stored > 0 && stored <= now) first = stored;
    else localStorage.setItem(FIRST_VISIT_KEY, String(now));
  } catch {
    return "unknown";
  }
  const days = Math.floor((now - first) / 86_400_000);
  if (days === 0) return "day 0";
  if (days === 1) return "day 1";
  if (days < 7) return "days 2-6";
  if (days < 14) return "days 7-13";
  if (days < 30) return "days 14-29";
  return "day 30+";
}

export function trackVisit(): void {
  track("pageview", { return: returnBucket() });
}
