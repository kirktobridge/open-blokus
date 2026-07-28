/**
 * Difficulty tiers as *measured strength* (P61) — the player-facing read of P62's
 * committed Elo ladder.
 *
 * The picker showed four opaque words; the arena has known for a while roughly how
 * far apart they actually are. This maps each shipped tier onto the pool member that
 * stands for it and hands back its rating.
 *
 * Two things this module refuses to paper over:
 *
 * 1. **Ratings never cross variants** (M6). A rating means nothing outside the
 *    `(variant × pool)` it was fit on, so Duo is `undefined` — *unrated*, not
 *    "the Classic number until we know better." There is no Duo pool yet.
 * 2. **Only two of the four mappings are exact.** `easy` and `extreme` match a pool
 *    member config-for-config, so their ratings describe the bot you actually play.
 *    `medium`/`hard` are *time-budget* searches (500 ms / 2000 ms) standing in for
 *    *fixed-iteration* pool members — chosen so the pool reproduces across machines.
 *    How many iterations your machine fits into the budget is your machine's business,
 *    so those two ratings are indicative and say so (`exact: false`).
 */
import type { Variant } from '../../game/types';
import { CLASSIC_LADDER, eloOf, type LadderArtifact } from '../../game/ai/ladder';
import type { Difficulty } from './difficulty';

/** Where a tier's rating comes from, and how literally to take it. */
export interface TierRating {
  /** The pool member the tier is rated through. */
  member: string;
  elo: number;
  /**
   * True when the pool member's search config *is* the shipped tier's. False means
   * the member only approximates it — present the number as indicative.
   */
  exact: boolean;
}

/**
 * Tier → pool member. `tests/ratings.test.ts` holds every row against `pool.json`
 * and `difficulty.ts` — including *why* the inexact ones are inexact — so retuning a
 * tier can't quietly leave it wearing its old rating.
 */
export const TIER_MEMBERS: Record<Difficulty, { member: string; exact: boolean }> = {
  easy: { member: 'heuristic', exact: true },
  medium: { member: 'mcts-30', exact: false },
  hard: { member: 'mcts-150', exact: false },
  extreme: { member: 'champion', exact: true },
};

/** The ladder for a variant, or `undefined` where no pool has been measured. */
export function ladderFor(variant: Variant): LadderArtifact | undefined {
  return variant === 'classic' ? CLASSIC_LADDER : undefined;
}

/** A tier's rating in `variant`, or `undefined` when that variant has no ladder. */
export function tierRating(variant: Variant, tier: Difficulty): TierRating | undefined {
  const ladder = ladderFor(variant);
  if (!ladder) return undefined;
  const { member, exact } = TIER_MEMBERS[tier];
  const elo = eloOf(ladder, member);
  return elo === undefined ? undefined : { member, elo, exact };
}

/**
 * The rating as it appears next to a tier name — `1549`, or `≈1683` where the
 * mapping is approximate. `undefined` when the variant is unrated, so callers fall
 * back to the bare tier name rather than rendering an empty rating.
 */
export function formatTierRating(variant: Variant, tier: Difficulty): string | undefined {
  const r = tierRating(variant, tier);
  return r && `${r.exact ? '' : '≈'}${r.elo}`;
}
