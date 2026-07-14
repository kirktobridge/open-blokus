import { useSyncExternalStore } from 'react';

/* Behavioral preferences — everything the user can choose that is *not*
 * appearance. Appearance (themes, design tokens, piece colors) lives in one
 * place: appearance.ts. The storage key is unchanged from when this store also
 * held token overrides; that `tokens` field is now ignored (appearance.ts
 * migrated it into a user theme) and drops out on the next write. */

/** How each seat's inventory is drawn in the PlayerCards. */
export type InventoryDisplay = 'silhouette' | 'dots';

const STORAGE_KEY = 'openblokus-settings';

interface Prefs {
  inventoryDisplay: InventoryDisplay;
  /** Sound cues on? (P7) Muting is this, not volume 0 — it survives a volume tweak. */
  sound: boolean;
  /** Master volume for the cues, 0–1. */
  volume: number;
}

const DEFAULTS: Prefs = { inventoryDisplay: 'silhouette', sound: true, volume: 0.6 };

const store: Pick<Storage, 'getItem' | 'setItem'> | null =
  typeof localStorage !== 'undefined' ? localStorage : null;

/** Volume is a slider value from an untrusted store — pin it to a sane range. */
export const clampVolume = (v: number): number =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULTS.volume;

function load(): Prefs {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      return {
        inventoryDisplay: parsed.inventoryDisplay === 'dots' ? 'dots' : 'silhouette',
        sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
        volume:
          typeof parsed.volume === 'number' ? clampVolume(parsed.volume) : DEFAULTS.volume,
      };
    }
  } catch {
    // corrupt / unavailable storage; fall back to defaults
  }
  return { ...DEFAULTS };
}

let state: Prefs = load();

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): Prefs {
  return state;
}

function commit(next: Prefs) {
  state = next;
  store?.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((cb) => cb());
}

export function setInventoryDisplay(mode: InventoryDisplay): void {
  if (mode === state.inventoryDisplay) return;
  commit({ ...state, inventoryDisplay: mode });
}

export function setSound(on: boolean): void {
  if (on === state.sound) return;
  commit({ ...state, sound: on });
}

export function setVolume(v: number): void {
  const volume = clampVolume(v);
  if (volume === state.volume) return;
  commit({ ...state, volume });
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useInventoryDisplay(): InventoryDisplay {
  return usePrefs().inventoryDisplay;
}
