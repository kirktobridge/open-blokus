import { useSyncExternalStore } from 'react';

/**
 * Live viewport size. The front door sizes its board off the *page*, not off a fixed
 * constant — a hardcoded px board leaves a 1900×900 screen two-thirds empty (P29).
 * SSR-safe: falls back to a typical laptop viewport when there's no `window`.
 */
const FALLBACK = { w: 1280, h: 800 };

let snapshot = FALLBACK;

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onResize = () => {
    // Re-key the cached object only when the size actually changed — useSyncExternalStore
    // compares by identity and would otherwise loop on every resize tick.
    if (snapshot.w !== window.innerWidth || snapshot.h !== window.innerHeight) {
      snapshot = { w: window.innerWidth, h: window.innerHeight };
    }
    cb();
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}

function getSnapshot(): { w: number; h: number } {
  if (typeof window === 'undefined') return FALLBACK;
  if (snapshot.w !== window.innerWidth || snapshot.h !== window.innerHeight) {
    snapshot = { w: window.innerWidth, h: window.innerHeight };
  }
  return snapshot;
}

const getServerSnapshot = () => FALLBACK;

export function useViewport(): { w: number; h: number } {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
