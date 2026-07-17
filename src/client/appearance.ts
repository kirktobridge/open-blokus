import { useSyncExternalStore } from 'react';
import { COLOR_ORDER } from '../game/types';
import { PIECE_TOKEN } from './theme';

/* The one appearance store. A *theme* is a complete assignment of the token
 * vocabulary; the three built-ins live as [data-theme] blocks in theme.css. A
 * user theme is a sparse fork of a built-in — its overrides are the only values
 * ever written as inline vars on <html>, so the cascade resolves exactly
 * `override ?? builtin(base)` and a built-in is pristine the moment it's
 * selected. Piece colors are ordinary tokens (--piece-*), not a second rail. */

export type ThemeMode = 'light' | 'dark' | 'walnut';

/** Selectable built-ins, in order, with the human name surfaced in Settings. */
export const THEME_CYCLE: readonly ThemeMode[] = ['light', 'dark', 'walnut'];
export const THEME_META: Record<ThemeMode, { name: string; hint: string }> = {
  light: { name: 'Linen', hint: 'warm light' },
  dark: { name: 'Lamplight', hint: 'warm dark' },
  walnut: { name: 'Walnut', hint: 'hero' },
};

/** A tunable CSS custom property surfaced in the Settings panel. */
export interface TokenDef {
  /** CSS custom property name, e.g. `--pnl`. */
  name: string;
  label: string;
}

/** The piece-color group; Settings gives it its own section (PalettePicker). */
export const PIECE_GROUP = 'Piece colors';

/** Grouped registry of every retunable font/color/token. Order = display order. */
export const TOKEN_GROUPS: { group: string; tokens: TokenDef[] }[] = [
  {
    group: PIECE_GROUP,
    tokens: COLOR_ORDER.map((c) => ({
      name: PIECE_TOKEN[c],
      label: c[0].toUpperCase() + c.slice(1),
    })),
  },
  {
    group: 'Fonts',
    tokens: [
      { name: '--font-ui', label: 'UI font' },
      { name: '--font-mono', label: 'Mono font' },
    ],
  },
  {
    group: 'Text & ink',
    tokens: [
      { name: '--ink', label: 'Ink (body)' },
      { name: '--mut', label: 'Muted' },
      { name: '--top-ink', label: 'Bar ink' },
      { name: '--top-mut', label: 'Bar muted' },
      { name: '--fg', label: 'Foreground' },
      { name: '--fg-muted', label: 'Foreground muted' },
      { name: '--outline-strong', label: 'Strong outline' },
    ],
  },
  {
    group: 'Panels & surfaces',
    tokens: [
      { name: '--pnl', label: 'Panel' },
      { name: '--pnl-bd', label: 'Panel border' },
      { name: '--well', label: 'Well' },
      { name: '--surface', label: 'Surface' },
      { name: '--bg', label: 'Background' },
    ],
  },
  {
    group: 'Board',
    tokens: [
      { name: '--mat', label: 'Board mat' },
      { name: '--grid', label: 'Board grid' },
      { name: '--empty-cell', label: 'Empty cell' },
      { name: '--grid-line', label: 'Grid line' },
      { name: '--mat-stud', label: 'Stud size' },
      { name: '--placed-piece', label: 'Placed (neutral)' },
      { name: '--frame-a', label: 'Frame top' },
      { name: '--frame-b', label: 'Frame bottom' },
      { name: '--frame-hi', label: 'Frame highlight' },
      { name: '--last-move-ring', label: 'Last-move ring' },
    ],
  },
  {
    group: 'Accents',
    tokens: [
      { name: '--brass', label: 'Brass' },
      { name: '--top-bd', label: 'Bar border' },
      { name: '--top-bg', label: 'Bar fill' },
      { name: '--pill-idle', label: 'Idle pill' },
      { name: '--cell-outline', label: 'Cell outline' },
      { name: '--overlay', label: 'Overlay' },
    ],
  },
  {
    group: 'Backdrop',
    tokens: [{ name: '--table-bg', label: 'Table backdrop' }],
  },
];

const ALL_TOKEN_NAMES = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name));

/** A user's theme: a named sparse fork of one built-in. */
export interface UserTheme {
  id: string;
  name: string;
  /** Every user theme forks a built-in; unset tokens fall through to it. */
  base: ThemeMode;
  overrides: Record<string, string>;
}

export interface AppearanceState {
  userThemes: UserTheme[];
  /** A ThemeMode (a pristine built-in) or a UserTheme id. */
  activeId: string;
}
type State = AppearanceState;

const STORAGE_KEY = 'openblokus-appearance';
/** Pre-unification keys, migrated once then dropped (see migrate()). */
const OLD_THEME_KEY = 'openblokus-theme';
const OLD_SETTINGS_KEY = 'openblokus-settings';
const OLD_PALETTES_KEY = 'openblokus-palettes';
const OLD_SELECTED_KEY = 'openblokus-palette-selected';

/** localStorage guarded for SSR / non-browser (tests) environments. */
const store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null =
  typeof localStorage !== 'undefined' ? localStorage : null;

function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'walnut';
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The built-in to fall back on when nothing is saved: whatever the OS prefers. */
function osTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Keep only known token names with string values. */
function sanitizeOverrides(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  const rec = raw as Record<string, unknown>;
  for (const name of ALL_TOKEN_NAMES) {
    if (typeof rec[name] === 'string') out[name] = rec[name] as string;
  }
  return out;
}

function sanitizeTheme(raw: unknown): UserTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string' || typeof rec.name !== 'string') return null;
  if (!isThemeMode(rec.base)) return null;
  return { id: rec.id, name: rec.name, base: rec.base, overrides: sanitizeOverrides(rec.overrides) };
}

/**
 * One-time migration from the four pre-unification stores. Themes, token
 * overrides and palettes all collapse into user themes: a saved palette becomes
 * a theme carrying the four --piece-* overrides, saved token overrides become a
 * "Custom" theme, and the selected palette (if any) absorbs both.
 */
function migrate(): State | null {
  if (!store) return null;
  const oldTheme = store.getItem(OLD_THEME_KEY);
  const oldPalettes = store.getItem(OLD_PALETTES_KEY);
  const oldSettings = store.getItem(OLD_SETTINGS_KEY);
  if (oldTheme == null && oldPalettes == null && oldSettings == null) return null;

  const base: ThemeMode = isThemeMode(oldTheme) ? oldTheme : osTheme();

  let tokens: Record<string, string> = {};
  if (oldSettings) {
    const parsed = JSON.parse(oldSettings) as { tokens?: unknown };
    tokens = sanitizeOverrides(parsed.tokens);
  }

  // Each old palette → a user theme holding only the piece-color overrides.
  const userThemes: UserTheme[] = [];
  const byOldId = new Map<string, UserTheme>();
  if (oldPalettes) {
    const parsed = JSON.parse(oldPalettes) as unknown;
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (!p || typeof p !== 'object') continue;
        const rec = p as Record<string, unknown>;
        const colors = rec.colors as Record<string, unknown> | undefined;
        if (typeof rec.id !== 'string' || typeof rec.name !== 'string' || !colors) continue;
        const overrides: Record<string, string> = {};
        for (const c of COLOR_ORDER) {
          if (typeof colors[c] === 'string') overrides[PIECE_TOKEN[c]] = colors[c] as string;
        }
        const theme: UserTheme = { id: newId(), name: rec.name, base, overrides };
        userThemes.push(theme);
        byOldId.set(rec.id, theme);
      }
    }
  }

  const selectedPalette = byOldId.get(store.getItem(OLD_SELECTED_KEY) ?? '');
  let activeId: string = base;
  if (selectedPalette) {
    // The one theme in effect before the migration: its piece colors *and* the
    // token overrides that were layered on top of everything.
    selectedPalette.overrides = { ...tokens, ...selectedPalette.overrides };
    activeId = selectedPalette.id;
  } else if (Object.keys(tokens).length > 0) {
    const custom: UserTheme = { id: newId(), name: 'Custom', base, overrides: tokens };
    userThemes.push(custom);
    activeId = custom.id;
  }

  return { userThemes, activeId };
}

function load(): State {
  const fallback: State = { userThemes: [], activeId: osTheme() };
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      const userThemes = Array.isArray(parsed.userThemes)
        ? parsed.userThemes.map(sanitizeTheme).filter((t): t is UserTheme => t !== null)
        : [];
      const activeId =
        typeof parsed.activeId === 'string' &&
        (isThemeMode(parsed.activeId) || userThemes.some((t) => t.id === parsed.activeId))
          ? parsed.activeId
          : fallback.activeId;
      return { userThemes, activeId };
    }
    const migrated = migrate();
    if (migrated) {
      // Persist the new shape first, then drop the keys it replaces. (The prefs
      // store keeps OLD_SETTINGS_KEY for inventoryDisplay; its `tokens` field is
      // ignored there and disappears on the next prefs write.)
      store?.setItem(STORAGE_KEY, JSON.stringify(migrated));
      store?.removeItem(OLD_THEME_KEY);
      store?.removeItem(OLD_PALETTES_KEY);
      store?.removeItem(OLD_SELECTED_KEY);
      return migrated;
    }
  } catch {
    // corrupt / unavailable storage: clean defaults, never throw at boot
  }
  return fallback;
}

// Single module-level snapshot; replaced (new ref) only on mutation so
// useSyncExternalStore can compare by identity without re-render loops.
let state: State = load();

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): State {
  return state;
}

function persist() {
  store?.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** The active user theme, or null when a built-in is selected (pristine). */
function activeTheme(s: State = state): UserTheme | null {
  return s.userThemes.find((t) => t.id === s.activeId) ?? null;
}

/** The built-in underneath the active theme. */
function activeBase(s: State = state): ThemeMode {
  const t = activeTheme(s);
  if (t) return t.base;
  return isThemeMode(s.activeId) ? s.activeId : 'light';
}

/**
 * Resolve the appearance onto <html>: the base built-in as [data-theme] (the
 * CSS blocks carry every token's default) and the active theme's overrides —
 * and only those — as inline vars. Rewritten in full on every change, so an
 * override can never survive a theme switch.
 */
function applyAppearance() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = activeBase();
  const overrides = activeTheme()?.overrides ?? {};
  for (const name of ALL_TOKEN_NAMES) {
    const v = overrides[name];
    if (v != null) root.style.setProperty(name, v);
    else root.style.removeProperty(name);
  }
}

function commit(next: State) {
  state = next;
  persist();
  applyAppearance();
  listeners.forEach((cb) => cb());
}

/** Call once before render (in main.tsx) to avoid a light-mode flash. */
export function initAppearance(): void {
  applyAppearance();
}

/** Select a built-in (`ThemeMode`) or a user theme by id. Unknown ids are ignored. */
export function setActiveTheme(id: string): void {
  if (id === state.activeId) return;
  if (!isThemeMode(id) && !state.userThemes.some((t) => t.id === id)) return;
  commit({ ...state, activeId: id });
}

/**
 * Edit a token on the active theme. Editing a built-in forks it first: the edit
 * lands on a new "<Name> (custom)" theme, leaving the built-in pristine.
 */
export function setTokenOverride(name: string, value: string): void {
  const target = activeTheme();
  if (!target) {
    const base = activeBase();
    const fork: UserTheme = {
      id: newId(),
      name: `${THEME_META[base].name} (custom)`,
      base,
      overrides: { [name]: value },
    };
    commit({ userThemes: [...state.userThemes, fork], activeId: fork.id });
    return;
  }
  commit({
    ...state,
    userThemes: state.userThemes.map((t) =>
      t.id === target.id ? { ...t, overrides: { ...t.overrides, [name]: value } } : t,
    ),
  });
}

/** Drop one override from the active theme (falls back to its base's value). */
export function clearTokenOverride(name: string): void {
  const target = activeTheme();
  if (!target || !(name in target.overrides)) return;
  const overrides = { ...target.overrides };
  delete overrides[name];
  commit({
    ...state,
    userThemes: state.userThemes.map((t) => (t.id === target.id ? { ...t, overrides } : t)),
  });
}

export function renameUserTheme(id: string, name: string): void {
  commit({
    ...state,
    userThemes: state.userThemes.map((t) => (t.id === id ? { ...t, name } : t)),
  });
}

/** Delete a user theme; if it was active, fall back to the built-in it forked. */
export function deleteUserTheme(id: string): void {
  const target = state.userThemes.find((t) => t.id === id);
  if (!target) return;
  commit({
    userThemes: state.userThemes.filter((t) => t.id !== id),
    activeId: state.activeId === id ? target.base : state.activeId,
  });
}

/** Current appearance state (non-reactive read, for non-React callers). */
export function getAppearance(): State {
  return state;
}

/** Reactive appearance state. */
export function useAppearance(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The active theme (null ⇒ a pristine built-in is selected) and its base. Reactive. */
export function useActiveTheme(): { theme: UserTheme | null; base: ThemeMode } {
  const s = useAppearance();
  return { theme: activeTheme(s), base: activeBase(s) };
}

/** The value in effect for a token: the active theme's override, else the base's. */
export function effectiveToken(name: string): string {
  const override = activeTheme()?.overrides[name];
  if (override != null) return override;
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
