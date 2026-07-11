import { useSyncExternalStore } from 'react';

/**
 * Reactive "is the viewport wide enough for the landscape home layout?" (P27).
 * Above the breakpoint the home screen lays its three action cards out in a row
 * and relaxes its width cap; below it the single-column portrait/mobile stack is
 * preserved unchanged. SSR-safe: false (narrow stack) when there's no `matchMedia`.
 */
const WIDE_QUERY = '(min-width: 1200px)';

function mql(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia(WIDE_QUERY);
}

function subscribe(cb: () => void): () => void {
  const m = mql();
  if (!m) return () => {};
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}

const getSnapshot = () => mql()?.matches ?? false;
const getServerSnapshot = () => false;

export function useWideLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
