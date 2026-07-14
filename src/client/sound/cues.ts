import { EVENT_IDS, type EventId } from '../drama';

/**
 * The sound palette (P7) — pure data, no Web Audio.
 *
 * Every cue is *synthesised*, not sampled: a handful of short oscillator tones (plus
 * an optional noise burst for the wooden body of a click-clack). That's a deliberate
 * choice, not a shortcut — the nostalgic register we want (MIDI/Flash-era blips: square
 * waves, tiny pitch glides, three-note stingers) is exactly what a couple of oscillators
 * make, and it keeps the whole palette a few hundred bytes with no assets to fetch, no
 * licence, and nothing to fail offline.
 *
 * This module is the source of truth for *what a cue sounds like*; `engine.ts` only
 * knows how to render one, and `useGameSound.ts` only knows when to fire one. Cue ids
 * cover P32's four events 1:1 (enforced below and by tests/sound-cues.test.ts) plus the
 * three non-event moments: piece pickup, piece placement, blitz final-seconds tick.
 */

/** Oscillator shapes we use. Square/triangle carry the era; sine is for soft ticks. */
export type Wave = 'square' | 'triangle' | 'sine' | 'sawtooth';

/** One synthesised voice inside a cue. Times are seconds relative to the cue's start. */
export interface Tone {
  wave: Wave;
  /** Starting pitch (Hz). */
  freq: number;
  /** Glide target (Hz); absent = a flat note. The glide is what sells "thud"/"whoop". */
  freqEnd?: number;
  start: number;
  dur: number;
  /** Peak gain, 0–1, before the master volume. */
  gain: number;
}

/**
 * A filtered noise burst — the percussive *body* of a cue (plastic-on-board clack).
 * Oscillators alone read as a beep; the noise is what makes a placement feel physical.
 */
export interface Noise {
  start: number;
  dur: number;
  gain: number;
  /** Low-pass cutoff (Hz): high = sharp click, low = dull wooden knock. */
  cutoff: number;
}

export interface Cue {
  /** What this cue is for; also the settings-panel preview label. */
  label: string;
  tones: Tone[];
  noise?: Noise;
  /**
   * True when the cue's pitch scales with the piece size (placement only) — a monomino
   * ticks, a pentomino thumps. `pitchFor` supplies the multiplier.
   */
  sized?: boolean;
}

/** Non-event moments that also make a sound. */
export const UI_CUE_IDS = ['select', 'place', 'blitz-tick'] as const;
export type UiCueId = (typeof UI_CUE_IDS)[number];

/** Every cue the game can play: P32's event vocabulary + the UI moments. */
export type CueId = EventId | UiCueId;
export const CUE_IDS: readonly CueId[] = [...EVENT_IDS, ...UI_CUE_IDS];

export const CUES: Record<CueId, Cue> = {
  /** Piece lifted off the tray — the "click" half of the click-clack. */
  select: {
    label: 'Pick up',
    tones: [{ wave: 'square', freq: 880, freqEnd: 1046, start: 0, dur: 0.045, gain: 0.1 }],
    noise: { start: 0, dur: 0.02, gain: 0.05, cutoff: 5200 },
  },

  /** Piece hits the board — the "clack". Pitch drops as the piece gets bigger. */
  place: {
    label: 'Place a piece',
    sized: true,
    tones: [
      { wave: 'square', freq: 523, freqEnd: 392, start: 0, dur: 0.05, gain: 0.14 },
      { wave: 'triangle', freq: 196, freqEnd: 147, start: 0.01, dur: 0.11, gain: 0.2 },
    ],
    noise: { start: 0, dur: 0.05, gain: 0.16, cutoff: 2600 },
  },

  /** A color is walled off: a heavy descending thud, the darkest cue in the set. */
  cut: {
    label: 'Cut off',
    tones: [
      { wave: 'sawtooth', freq: 220, freqEnd: 62, start: 0, dur: 0.3, gain: 0.16 },
      { wave: 'triangle', freq: 110, freqEnd: 55, start: 0.02, dur: 0.34, gain: 0.22 },
    ],
    noise: { start: 0, dur: 0.13, gain: 0.14, cutoff: 900 },
  },

  /** Running out of room: a two-note minor drop — a warning, not a verdict. */
  cramped: {
    label: 'Running out of room',
    tones: [
      { wave: 'square', freq: 659, start: 0, dur: 0.09, gain: 0.1 },
      { wave: 'square', freq: 494, start: 0.1, dur: 0.13, gain: 0.1 },
    ],
  },

  /** A color is finished: the little three-note "you're done" stinger of the era. */
  'out-of-moves': {
    label: 'Out of moves',
    tones: [
      { wave: 'square', freq: 523, start: 0, dur: 0.11, gain: 0.11 },
      { wave: 'square', freq: 415, start: 0.12, dur: 0.11, gain: 0.11 },
      { wave: 'square', freq: 330, start: 0.24, dur: 0.22, gain: 0.12 },
    ],
  },

  /** Final rounds: a rising fanfare — this one lifts, because the end is a thrill. */
  endgame: {
    label: 'Final rounds',
    tones: [
      { wave: 'triangle', freq: 392, start: 0, dur: 0.12, gain: 0.12 },
      { wave: 'triangle', freq: 523, start: 0.11, dur: 0.12, gain: 0.12 },
      { wave: 'triangle', freq: 659, start: 0.22, dur: 0.26, gain: 0.14 },
      { wave: 'sine', freq: 784, start: 0.24, dur: 0.28, gain: 0.08 },
    ],
  },

  /** Blitz, final seconds (P24's reserved seat): a dry clock tick, once a second. */
  'blitz-tick': {
    label: 'Blitz countdown',
    tones: [{ wave: 'sine', freq: 1320, start: 0, dur: 0.035, gain: 0.09 }],
    noise: { start: 0, dur: 0.012, gain: 0.06, cutoff: 7000 },
  },
};

/**
 * Pitch multiplier for a placement of `size` squares (1–5): a monomino lands a fifth
 * up, a pentomino a fourth down, so the tray's whole range of pieces is audible in the
 * clack. Clamped, so a size outside the rules can't detune the cue into a squeak.
 */
export function pitchFor(size: number): number {
  // `Math.max` propagates NaN, so a non-finite size has to be caught before the clamp.
  const n = Number.isFinite(size) ? size : 5;
  const clamped = Math.min(5, Math.max(1, n));
  return 1.32 - 0.11 * clamped;
}

/** Longest a cue can ring for (seconds) — used to schedule the voices' teardown. */
export function cueDuration(cue: Cue): number {
  const ends = cue.tones.map((t) => t.start + t.dur);
  if (cue.noise) ends.push(cue.noise.start + cue.noise.dur);
  return Math.max(...ends);
}
