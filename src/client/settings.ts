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

/**
 * What the app actually reads. `sound` here is the *effective* answer: the stored pref
 * narrowed by the contextual override (P47), never the override written into storage.
 */
interface EffectivePrefs extends Prefs {
  /** Quiet only because of the context (a fully-bot watch game), not the user's pref —
   * so the settings panel can say *why*, and an un-mute knows what to clear. */
  soundContextMuted: boolean;
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

/**
 * Contextual mute (P47): a fully-bot watch game fires cues no human triggered, so it
 * starts silent. Deliberately *not* persisted and not written into `state` — it's a
 * property of the situation, not a choice, so leaving the watch game restores the
 * user's own sound with nothing to undo. An explicit un-mute clears it.
 */
let contextMute = false;

let snapshot: EffectivePrefs = derive();

function derive(): EffectivePrefs {
  return { ...state, sound: state.sound && !contextMute, soundContextMuted: contextMute };
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): EffectivePrefs {
  return snapshot;
}

function publish() {
  snapshot = derive();
  listeners.forEach((cb) => cb());
}

function commit(next: Prefs) {
  state = next;
  store?.setItem(STORAGE_KEY, JSON.stringify(state));
  publish();
}

/**
 * Silence (or release) the current context without touching the saved pref. Idempotent,
 * so the caller can just declare the situation on every render pass.
 */
export function setSoundContextMute(muted: boolean): void {
  if (muted === contextMute) return;
  contextMute = muted;
  publish();
}

export function setInventoryDisplay(mode: InventoryDisplay): void {
  if (mode === state.inventoryDisplay) return;
  commit({ ...state, inventoryDisplay: mode });
}

export function setSound(on: boolean): void {
  // An explicit choice outranks the contextual override (P47): un-muting a watch game
  // releases it, even though the stored pref was on the whole time.
  const released = on && contextMute;
  if (released) contextMute = false;
  if (on !== state.sound) commit({ ...state, sound: on });
  else if (released) publish();
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

export function usePrefs(): EffectivePrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The same snapshot, for callers outside React (and for tests of the store itself). */
export function getPrefs(): EffectivePrefs {
  return snapshot;
}

/** Watch the snapshot; returns an unsubscribe. */
export function subscribePrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export function useInventoryDisplay(): InventoryDisplay {
  return usePrefs().inventoryDisplay;
}
