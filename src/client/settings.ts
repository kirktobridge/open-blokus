import { useSyncExternalStore } from 'react';

/** How each seat's inventory is drawn in the PlayerCards. */
export type InventoryDisplay = 'silhouette' | 'dots';

/** A tunable CSS custom property surfaced in the Settings panel. */
export interface TokenDef {
  /** CSS custom property name, e.g. `--pnl`. */
  name: string;
  label: string;
}

/** Grouped registry of every retunable font/color/token. Order = display order. */
export const TOKEN_GROUPS: { group: string; tokens: TokenDef[] }[] = [
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

const STORAGE_KEY = 'openblokus-settings';

interface State {
  /** CSS token name → override value, layered over the active theme. */
  tokens: Record<string, string>;
  inventoryDisplay: InventoryDisplay;
}

const store: Pick<Storage, 'getItem' | 'setItem'> | null =
  typeof localStorage !== 'undefined' ? localStorage : null;

function load(): State {
  const base: State = { tokens: {}, inventoryDisplay: 'silhouette' };
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<State>;
    const tokens: Record<string, string> = {};
    if (parsed.tokens && typeof parsed.tokens === 'object') {
      for (const name of ALL_TOKEN_NAMES) {
        const v = (parsed.tokens as Record<string, unknown>)[name];
        if (typeof v === 'string') tokens[name] = v;
      }
    }
    const inventoryDisplay =
      parsed.inventoryDisplay === 'dots' ? 'dots' : 'silhouette';
    return { tokens, inventoryDisplay };
  } catch {
    return base;
  }
}

let state: State = load();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((cb) => cb());
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

/** Push the current token overrides onto <html> (var() consumers pick them up). */
function applyTokens() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const name of ALL_TOKEN_NAMES) {
    const v = state.tokens[name];
    if (v != null) root.style.setProperty(name, v);
    else root.style.removeProperty(name);
  }
}

function commit(next: State) {
  state = next;
  persist();
  applyTokens();
  emit();
}

/** Apply persisted overrides once at boot (call after initTheme, before render). */
export function initSettings(): void {
  applyTokens();
}

export function setTokenOverride(name: string, value: string): void {
  commit({ ...state, tokens: { ...state.tokens, [name]: value } });
}

export function clearTokenOverride(name: string): void {
  const tokens = { ...state.tokens };
  delete tokens[name];
  commit({ ...state, tokens });
}

export function resetAllTokens(): void {
  commit({ ...state, tokens: {} });
}

export function setInventoryDisplay(mode: InventoryDisplay): void {
  if (mode === state.inventoryDisplay) return;
  commit({ ...state, inventoryDisplay: mode });
}

export function useSettings(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useInventoryDisplay(): InventoryDisplay {
  return useSettings().inventoryDisplay;
}

/** The value currently in effect for a token (override, else the theme default). */
export function effectiveToken(name: string): string {
  const override = state.tokens[name];
  if (override != null) return override;
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
