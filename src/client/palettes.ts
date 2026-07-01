import { useSyncExternalStore } from 'react';
import type { Color } from '../game/types';
import { COLORS } from '../shared/constants';
import { COLOR_HEX } from './theme';

/** A hex color per Blokus color. */
export type PaletteColors = Record<Color, string>;

export interface Palette {
  id: string;
  name: string;
  colors: PaletteColors;
  /** Built-in palettes cannot be edited or deleted. */
  immutable?: boolean;
}

/** The classic red/blue/yellow/green scheme. Always present, never editable. */
export const DEFAULT_PALETTE: Palette = {
  id: 'classic',
  name: 'Classic',
  immutable: true,
  colors: { ...COLOR_HEX },
};

const STORAGE_KEY = 'openblokus-palettes';
const SELECTED_KEY = 'openblokus-palette-selected';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** A stored palette is usable only if it has a valid hex for every color. */
function isValidColors(colors: unknown): colors is PaletteColors {
  if (!colors || typeof colors !== 'object') return false;
  const rec = colors as Record<string, unknown>;
  return COLORS.every((c) => typeof rec[c] === 'string' && HEX_RE.test(rec[c] as string));
}

function sanitize(p: unknown): Palette | null {
  if (!p || typeof p !== 'object') return null;
  const rec = p as Record<string, unknown>;
  if (typeof rec.id !== 'string' || typeof rec.name !== 'string') return null;
  if (!isValidColors(rec.colors)) return null;
  // Custom palettes are never immutable, whatever the stored flag claimed.
  return { id: rec.id, name: rec.name, colors: { ...(rec.colors as PaletteColors) } };
}

interface State {
  /** Default first, then user-defined palettes. */
  palettes: Palette[];
  selectedId: string;
}

/** localStorage guarded for SSR / non-browser (tests) environments. */
const store: Pick<Storage, 'getItem' | 'setItem'> | null =
  typeof localStorage !== 'undefined' ? localStorage : null;

function load(): State {
  let custom: Palette[] = [];
  let savedId: string | null = null;
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        custom = parsed.map(sanitize).filter((p): p is Palette => p !== null);
      }
    }
    savedId = store?.getItem(SELECTED_KEY) ?? null;
  } catch {
    // corrupt / unavailable storage; fall back to defaults only
  }
  const palettes = [DEFAULT_PALETTE, ...custom];
  const selectedId = palettes.some((p) => p.id === savedId)
    ? (savedId as string)
    : DEFAULT_PALETTE.id;
  return { palettes, selectedId };
}

// Single module-level snapshot; replaced (new ref) only on mutation so
// useSyncExternalStore can compare by identity without re-render loops.
let state: State = load();

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((cb) => cb());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): State {
  return state;
}

function persist() {
  if (!store) return;
  const custom = state.palettes.filter((p) => !p.immutable);
  store.setItem(STORAGE_KEY, JSON.stringify(custom));
  store.setItem(SELECTED_KEY, state.selectedId);
}

function commit(next: State) {
  state = next;
  persist();
  emit();
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Select the active palette by id (ignored if unknown). */
export function selectPalette(id: string): void {
  if (id === state.selectedId || !state.palettes.some((p) => p.id === id)) return;
  commit({ ...state, selectedId: id });
}

/**
 * Create a custom palette (starting from the given colors) and select it.
 * Returns the new palette's id.
 */
export function createPalette(name: string, colors: PaletteColors): string {
  const id = newId();
  const palette: Palette = { id, name, colors: { ...colors } };
  commit({ palettes: [...state.palettes, palette], selectedId: id });
  return id;
}

/** Update a custom palette's name/colors. Immutable palettes are untouched. */
export function updatePalette(id: string, patch: Partial<Pick<Palette, 'name' | 'colors'>>): void {
  commit({
    ...state,
    palettes: state.palettes.map((p) =>
      p.id === id && !p.immutable
        ? { ...p, ...patch, colors: patch.colors ? { ...patch.colors } : p.colors }
        : p,
    ),
  });
}

/** Delete a custom palette; falls back to the default if it was selected. */
export function deletePalette(id: string): void {
  const target = state.palettes.find((p) => p.id === id);
  if (!target || target.immutable) return;
  const palettes = state.palettes.filter((p) => p.id !== id);
  const selectedId = state.selectedId === id ? DEFAULT_PALETTE.id : state.selectedId;
  commit({ palettes, selectedId });
}

/** All palettes (default first). Reactive. */
export function usePalettes(): Palette[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).palettes;
}

/** The currently selected palette. Reactive. */
export function useActivePalette(): Palette {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return s.palettes.find((p) => p.id === s.selectedId) ?? DEFAULT_PALETTE;
}

/** The active palette's color map — drop-in replacement for COLOR_HEX. */
export function usePaletteColors(): PaletteColors {
  return useActivePalette().colors;
}
