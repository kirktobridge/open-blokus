import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * P47's model: a fully-bot watch game is silenced *contextually*, so the quiet must
 * never reach storage. What's pinned here is exactly that separation — the effective
 * `sound` the app reads vs. the pref that survives the session — plus the two ways the
 * override ends (leaving the context, or the user overruling it). The UI end of it
 * (the watch game actually rendering no cues) is e2e/sound.spec.ts.
 */
function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

let storage: ReturnType<typeof fakeStorage>;

async function loadStore(seed: Record<string, string> = {}) {
  storage = fakeStorage(seed);
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  return import('../src/client/settings');
}

/** The stored pref, as written to the settings key — the thing that outlives the game. */
const persistedSound = () =>
  JSON.parse(storage.getItem('openblokus-settings') ?? 'null')?.sound ?? null;

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('contextual sound mute (P47)', () => {
  it('silences the game without touching the saved pref', async () => {
    const s = await loadStore();
    expect(s.getPrefs().sound).toBe(true);

    s.setSoundContextMute(true);
    expect(s.getPrefs().sound).toBe(false);
    expect(s.getPrefs().soundContextMuted).toBe(true);
    // Nothing was written: the override isn't a choice, so it leaves no trace.
    expect(persistedSound()).toBeNull();
  });

  it('hands the sound back when the context ends', async () => {
    const s = await loadStore();
    s.setSoundContextMute(true);
    s.setSoundContextMute(false);
    expect(s.getPrefs().sound).toBe(true);
    expect(s.getPrefs().soundContextMuted).toBe(false);
  });

  it('leaves a user who muted for real still muted after the context ends', async () => {
    const s = await loadStore({ 'openblokus-settings': JSON.stringify({ sound: false }) });
    s.setSoundContextMute(true);
    expect(s.getPrefs().sound).toBe(false);

    s.setSoundContextMute(false);
    expect(s.getPrefs().sound).toBe(false); // their pref, not the context's doing
  });

  it('lets an explicit un-mute overrule the context, pref already being on', async () => {
    const s = await loadStore();
    s.setSoundContextMute(true);

    s.setSound(true); // the toggle in the settings panel
    expect(s.getPrefs().sound).toBe(true);
    expect(s.getPrefs().soundContextMuted).toBe(false);
    // Releasing the override is not a pref edit either — there was nothing to change.
    expect(persistedSound()).toBeNull();
  });

  it('notifies subscribers when the override flips, and not when it re-asserts', async () => {
    const s = await loadStore();
    let calls = 0;
    const stop = s.subscribePrefs(() => calls++);

    s.setSoundContextMute(true);
    expect(calls).toBe(1);
    s.setSoundContextMute(true); // already silent — no new snapshot
    expect(calls).toBe(1);
    s.setSoundContextMute(false);
    expect(calls).toBe(2);
    stop();
  });

  it('keeps the snapshot identity stable so React can bail out of re-renders', async () => {
    const s = await loadStore();
    expect(s.getPrefs()).toBe(s.getPrefs());
    s.setSoundContextMute(true);
    const muted = s.getPrefs();
    expect(muted).toBe(s.getPrefs());
    expect(muted.volume).toBe(0.6); // everything else rides through untouched
  });
});
