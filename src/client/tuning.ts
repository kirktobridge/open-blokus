import type { GameState, Variant } from '../game/types';
import { variantOf } from '../game/modes';

/**
 * Variant-tuned thresholds (P55): the shared axis behind every feel-tuned number
 * the signal layer reads.
 *
 * A threshold like `CUT_MIN_LOSS` is a *magnitude*, and magnitudes don't survive a
 * change of board size or opponent count — the bar that makes a vocabulary speak on
 * a 20×20 four-colour game chatters on a 14×14 two-colour one (measured, P54). So a
 * threshold set is declared once as its Classic values plus a per-variant table of
 * **only what changes**, the same delta discipline GAME_SPEC_DUO.md and EVENTS.md
 * use. A variant with no entry plays at the Classic bars *deliberately*, and the
 * registry test makes that a documented claim rather than an oversight.
 */

/**
 * `T` with its numeric literals widened. Threshold sets are declared `as const` so
 * the doc-mirror test can read exact values; without widening, a delta could not
 * hold a value different from the literal the base declared.
 */
export type Tuned<T> = { readonly [K in keyof T]: T[K] extends number ? number : T[K] };

/** Per-variant overrides of a threshold set — only the keys that differ. */
export type VariantDeltas<T> = Partial<Record<Variant, Partial<Tuned<T>>>>;

/** The thresholds this game's variant plays under: Classic base + its variant's deltas. */
export function tunedFor<T extends object>(
  base: T,
  deltas: VariantDeltas<T>,
  G: GameState,
): Tuned<T> {
  return { ...(base as unknown as Tuned<T>), ...deltas[variantOf(G)] };
}
