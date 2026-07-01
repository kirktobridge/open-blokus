import { useCallback, useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark';
const STORAGE_KEY = 'openblokus-theme';

/** Resolve the initial theme: saved choice wins, else OS preference. */
function initialTheme(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
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

function currentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

// Minimal external store so the button label tracks the <html> attribute.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as ThemeMode);

  const toggle = useCallback(() => {
    const next: ThemeMode = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((cb) => cb());
  }, []);

  return (
    <button
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title="Toggle dark mode"
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 1000,
        padding: '4px 10px',
        cursor: 'pointer',
      }}
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
