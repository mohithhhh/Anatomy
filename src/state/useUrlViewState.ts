import { useCallback, useEffect, useRef, useState } from "react";
import { decodeViewState, encodeViewState, type ViewState } from "./view-state";

const WRITE_DELAY_MS = 250;

/**
 * View state mirrored into the URL hash. Writes use replaceState (debounced, because some
 * browsers throttle history updates), so the back button is not flooded with every slider move.
 * Editing the hash by hand, or opening a link, updates the state.
 */
export function useUrlViewState() {
  const [state, setState] = useState<ViewState>(() => decodeViewState(window.location.hash));
  const lastWritten = useRef(window.location.hash.replace(/^#/, ""));

  useEffect(() => {
    const encoded = encodeViewState(state);
    if (encoded === lastWritten.current) return;
    const timer = setTimeout(() => {
      lastWritten.current = encoded;
      const url = `${window.location.pathname}${window.location.search}${encoded ? `#${encoded}` : ""}`;
      window.history.replaceState(window.history.state, "", url);
    }, WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === lastWritten.current) return;
      lastWritten.current = hash;
      setState(decodeViewState(hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const update = useCallback((change: Partial<ViewState> | ((s: ViewState) => ViewState)) => {
    setState((s) => (typeof change === "function" ? change(s) : { ...s, ...change }));
  }, []);

  /** Full URL for the current view, for copy-link buttons. */
  const shareUrl = useCallback((s: ViewState) => {
    const encoded = encodeViewState(s);
    return `${window.location.origin}${window.location.pathname}${encoded ? `#${encoded}` : ""}`;
  }, []);

  return { state, update, shareUrl };
}
