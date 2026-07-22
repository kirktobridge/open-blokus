import type { GameState } from '../game/types';
import { tunedFor, type Tuned, type VariantDeltas } from './tuning';

/**
 * Standing-signal thresholds (P55) — the sibling registry to `EVENT_THRESHOLDS`.
 *
 * A *standing signal* is a pure predicate over one `GameState`, recomputed each turn
 * and shown as a quiet overlay: no `(prev, cur)` crossing, no TTL, no sound cue. That
 * is what keeps them out of `EVENT_IDS` (P44's ruling, restated in EVENTS.md), and it
 * is also why their thresholds went unregistered until now — the events registry's
 * charter covered only events, so these were feel-tuned in the file that used them,
 * with no doc mirror and no recorded variant scope. Same magnitudes, same variant
 * sensitivity, so: same treatment.
 */
export const SIGNAL_THRESHOLDS = {
  /**
   * An incursion needs an opponent to be able to thread a piece of at least this many
   * squares onto one of your open corners. A single-square nub poking a corner is a
   * scratch, not a threat worth flagging. Analogous to `cut`'s `CUT_MIN_LOSS`:
   * magnitude, tuned by feel.
   */
  INCURSION_MIN_PIECE: 3,
} as const;

export type SignalThresholds = Tuned<typeof SIGNAL_THRESHOLDS>;

/**
 * Per-variant deltas — **deliberately empty**. `INCURSION_MIN_PIECE` is a piece-size
 * bar, and the 21 shapes are identical in both variants (GAME_SPEC_DUO §1), so the
 * board it sits on doesn't move it: what a "real piece" is doesn't change. Unlike
 * `CUT_MIN_LOSS`, which counts *frontier* cells and therefore scales with the board.
 * Empty is a claim here, not an omission — the registry test fails if the doc's
 * deltas table and this table disagree in either direction.
 */
export const SIGNAL_THRESHOLD_DELTAS: VariantDeltas<typeof SIGNAL_THRESHOLDS> = {};

/** The standing-signal thresholds this game's variant plays under. */
export const signalThresholdsFor = (G: GameState): SignalThresholds =>
  tunedFor(SIGNAL_THRESHOLDS, SIGNAL_THRESHOLD_DELTAS, G);
