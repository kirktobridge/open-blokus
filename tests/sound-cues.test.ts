import { describe, it, expect } from 'vitest';
import { EVENT_IDS } from '../src/client/drama';
import { CUES, CUE_IDS, UI_CUE_IDS, cueDuration, pitchFor } from '../src/client/sound/cues';
import { clampVolume } from '../src/client/settings';

/**
 * P7's half of the registry contract (the other half is events-registry.test.ts):
 * sound coverage must not silently lag the event vocabulary. Every event P32 can
 * detect has to have a cue, and every cue has to be something we can actually render —
 * so adding an event without a sound, or shipping a cue with a zero-length note, fails
 * CI rather than going out as silence.
 */

describe('cue registry ↔ event vocabulary', () => {
  it('gives every event id a cue, and invents no orphan event cue', () => {
    const eventCues = CUE_IDS.filter((id) => !(UI_CUE_IDS as readonly string[]).includes(id));
    expect([...eventCues].sort()).toEqual([...EVENT_IDS].sort());
  });

  it('covers the non-event moments P7 scoped: pickup, placement, blitz tick', () => {
    expect([...UI_CUE_IDS].sort()).toEqual(['blitz-tick', 'place', 'select']);
  });

  it('defines a cue for every id it enumerates', () => {
    for (const id of CUE_IDS) expect(CUES[id], `no cue for ${id}`).toBeDefined();
  });
});

describe('cue specs are renderable', () => {
  it('has at least one voice per cue, with audible, non-negative timings', () => {
    for (const id of CUE_IDS) {
      const cue = CUES[id];
      expect(cue.tones.length, `${id} has no tones`).toBeGreaterThan(0);
      for (const t of cue.tones) {
        expect(t.start, `${id} tone starts before the cue`).toBeGreaterThanOrEqual(0);
        expect(t.dur, `${id} tone is silent`).toBeGreaterThan(0);
        expect(t.gain).toBeGreaterThan(0);
        expect(t.gain).toBeLessThanOrEqual(1);
        expect(t.freq).toBeGreaterThan(0);
        if (t.freqEnd !== undefined) expect(t.freqEnd).toBeGreaterThan(0);
      }
      if (cue.noise) {
        expect(cue.noise.dur).toBeGreaterThan(0);
        expect(cue.noise.gain).toBeGreaterThan(0);
        expect(cue.noise.cutoff).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every cue short enough to sit inside a turn (< 1s)', () => {
    for (const id of CUE_IDS) {
      expect(cueDuration(CUES[id]), `${id} rings too long`).toBeLessThan(1);
      expect(cueDuration(CUES[id])).toBeGreaterThan(0);
    }
  });

  it('only the placement cue scales with piece size', () => {
    expect(CUES.place.sized).toBe(true);
    for (const id of CUE_IDS.filter((c) => c !== 'place')) expect(CUES[id].sized).toBeFalsy();
  });
});

describe('pitchFor — bigger piece, deeper thunk', () => {
  it('falls monotonically from monomino to pentomino', () => {
    const pitches = [1, 2, 3, 4, 5].map(pitchFor);
    for (let i = 1; i < pitches.length; i++) expect(pitches[i]).toBeLessThan(pitches[i - 1]);
  });

  it('stays in a musical range — never a squeak or subsonic', () => {
    for (const size of [1, 2, 3, 4, 5]) {
      expect(pitchFor(size)).toBeGreaterThan(0.5);
      expect(pitchFor(size)).toBeLessThan(2);
    }
  });

  it('clamps sizes outside the rules rather than detuning', () => {
    expect(pitchFor(0)).toBe(pitchFor(1));
    expect(pitchFor(99)).toBe(pitchFor(5));
    expect(pitchFor(NaN)).toBe(pitchFor(5)); // non-finite → the pentomino default, not NaN
  });
});

describe('volume pref', () => {
  it('clamps to 0–1 and survives garbage from storage', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume(NaN)).toBe(0.6);
  });
});
