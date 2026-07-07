import { useSyncExternalStore } from 'react';

/**
 * Reactive `prefers-reduced-motion: reduce`. All P16 ceremony (count-ups,
 * settle, shake, racing bars) checks this and snaps to the end state when set,
 * so the drama never fights an accessibility preference. SSR-safe: false when
 * there's no `matchMedia` (server render / older environments).
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function mql(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia(QUERY);
}

function subscribe(cb: () => void): () => void {
  const m = mql();
  if (!m) return () => {};
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}

const getSnapshot = () => mql()?.matches ?? false;
const getServerSnapshot = () => false;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
