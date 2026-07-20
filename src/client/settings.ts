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
  /** Advisor: highlight every legal spot for the selected piece (P3 R1). Opt-in. */
  moveOptions: boolean;
  /** Advisor: the per-color open-corner meter (P34 M2). Opt-in. */
  cornerCounter: boolean;
  /** Advisor: shade your own pieces with no legal move this turn (P39). Opt-in. */
  unplayableSelf: boolean;
  /** Advisor: shade opponents' pieces with no legal move this turn (P39). Opt-in. */
  unplayableOpponents: boolean;
  /** Advisor: highlight your open corners an opponent could seize next turn (P44). Opt-in. */
  incursionAdvisor: boolean;
  /** Persistent event-feed panel — the game's beat history (P43). Ambient narration,
   * not an advisor aid, so it's on by default (advisor toggles are opt-in). */
  eventFeed: boolean;
}

const DEFAULTS: Prefs = {
  inventoryDisplay: 'silhouette',
  sound: true,
  volume: 0.6,
  moveOptions: false,
  cornerCounter: false,
  unplayableSelf: false,
  unplayableOpponents: false,
  incursionAdvisor: false,
  eventFeed: true,
};

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
        moveOptions:
          typeof parsed.moveOptions === 'boolean' ? parsed.moveOptions : DEFAULTS.moveOptions,
        cornerCounter:
          typeof parsed.cornerCounter === 'boolean'
            ? parsed.cornerCounter
            : DEFAULTS.cornerCounter,
        unplayableSelf:
          typeof parsed.unplayableSelf === 'boolean'
            ? parsed.unplayableSelf
            : DEFAULTS.unplayableSelf,
        unplayableOpponents:
          typeof parsed.unplayableOpponents === 'boolean'
            ? parsed.unplayableOpponents
            : DEFAULTS.unplayableOpponents,
        incursionAdvisor:
          typeof parsed.incursionAdvisor === 'boolean'
            ? parsed.incursionAdvisor
            : DEFAULTS.incursionAdvisor,
        eventFeed:
          typeof parsed.eventFeed === 'boolean' ? parsed.eventFeed : DEFAULTS.eventFeed,
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

export function setMoveOptions(on: boolean): void {
  if (on === state.moveOptions) return;
  commit({ ...state, moveOptions: on });
}

export function setCornerCounter(on: boolean): void {
  if (on === state.cornerCounter) return;
  commit({ ...state, cornerCounter: on });
}

export function setUnplayableSelf(on: boolean): void {
  if (on === state.unplayableSelf) return;
  commit({ ...state, unplayableSelf: on });
}

export function setUnplayableOpponents(on: boolean): void {
  if (on === state.unplayableOpponents) return;
  commit({ ...state, unplayableOpponents: on });
}

export function setIncursionAdvisor(on: boolean): void {
  if (on === state.incursionAdvisor) return;
  commit({ ...state, incursionAdvisor: on });
}

export function setEventFeed(on: boolean): void {
  if (on === state.eventFeed) return;
  commit({ ...state, eventFeed: on });
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useInventoryDisplay(): InventoryDisplay {
  return usePrefs().inventoryDisplay;
}
