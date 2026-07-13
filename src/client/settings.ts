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
}

const store: Pick<Storage, 'getItem' | 'setItem'> | null =
  typeof localStorage !== 'undefined' ? localStorage : null;

function load(): Prefs {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      if (parsed.inventoryDisplay === 'dots') return { inventoryDisplay: 'dots' };
    }
  } catch {
    // corrupt / unavailable storage; fall back to defaults
  }
  return { inventoryDisplay: 'silhouette' };
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

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useInventoryDisplay(): InventoryDisplay {
  return usePrefs().inventoryDisplay;
}
