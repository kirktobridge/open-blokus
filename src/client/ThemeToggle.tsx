import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'walnut';
const STORAGE_KEY = 'openblokus-theme';

/** Selectable themes, in order, with the human name surfaced in Settings. */
export const THEME_CYCLE: readonly ThemeMode[] = ['light', 'dark', 'walnut'];
export const THEME_META: Record<ThemeMode, { name: string; hint: string }> = {
  light: { name: 'Linen', hint: 'warm light' },
  dark: { name: 'Lamplight', hint: 'warm dark' },
  walnut: { name: 'Walnut', hint: 'hero' },
};

function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'walnut';
}

/** Resolve the initial theme: saved choice wins, else OS preference. */
function initialTheme(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (isThemeMode(saved)) return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply the theme to <html> so var()-based inline styles re-skin instantly. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
}

/** Call once before render (in main.tsx) to avoid a light-mode flash. */
export function initTheme(): void {
  applyTheme(initialTheme());
}

function readTheme(): ThemeMode {
  const t = document.documentElement.dataset.theme;
  return isThemeMode(t) ? t : 'light';
}

// Minimal external store so subscribers track the <html> attribute.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Set (and persist) the active theme, notifying subscribers. */
export function setTheme(mode: ThemeMode): void {
  applyTheme(mode);
  localStorage.setItem(STORAGE_KEY, mode);
  listeners.forEach((cb) => cb());
}

/** Reactive current theme. */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, readTheme, () => 'light' as ThemeMode);
}

/** Subscribe to theme changes (for non-React consumers, e.g. token overrides). */
export function onThemeChange(cb: () => void): () => void {
  return subscribe(cb);
}
