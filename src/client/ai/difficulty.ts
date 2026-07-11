import type { MctsConfig } from '../../game/ai/mcts';
import type { BlitzSeconds } from '../blitz/blitz';

/**
 * Offline-AI difficulty. Easy = heuristic bot; medium/hard = MCTS on a per-move
 * time budget; extreme = MCTS with a fixed (large) iteration count and *no time
 * budget* — strongest, but moves can take tens of seconds early game.
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

type MctsTier = Exclude<Difficulty, 'easy'>;

/**
 * MCTS config per tier (full rollouts throughout — the strength driver, F6/Run I).
 *
 * `beam` must scale with the iteration budget or a tier breaks: at ~30 iters/move a
 * `beam=16` spreads ~2 rollouts over 16 children (noise) and the tier *loses* to
 * the heuristic (F8 / AE5). Rule of thumb `beam ≈ iters/6` while keeping ≥ ~5
 * rollouts/child. medium ≈ 30 iters → 6; hard ≈ 140 → 16.
 *
 * `extreme` uses `iterations` (no `timeBudgetMs`) so it searches a fixed amount
 * regardless of wall-clock — the strongest setting on the Run I curve, at the cost
 * of long early-game moves. Tunable — see docs/research/backlog/ai-engine.md (AE10).
 *
 * `rankRewardWeight: 0.25` shapes the reward with a rank-normalized placement term
 * (AE15 / F15): a losing bot fights for 2nd-vs-4th (better final placement/score)
 * at no measured cost to wins. Validated at truncated rollouts; here rollouts run
 * to terminal, where the rank term is the *true* final ranking — a stronger signal.
 */
const MCTS_TIERS: Record<MctsTier, Partial<MctsConfig>> = {
  medium: { timeBudgetMs: 500, beam: 6, rolloutDepth: 0, minIterations: 8, rankRewardWeight: 0.25 },
  hard: { timeBudgetMs: 2000, beam: 16, rolloutDepth: 0, minIterations: 8, rankRewardWeight: 0.25 },
  extreme: { iterations: 500, beam: 20, rolloutDepth: 0, minIterations: 8, rankRewardWeight: 0.25 },
};

export function mctsConfigFor(difficulty: MctsTier): Partial<MctsConfig> {
  return MCTS_TIERS[difficulty];
}

/**
 * Blitz bot pacing (P25). In blitz only the human is on a clock, so an instant bot
 * reply reads as the CPU sniping while you sweat. Floor each pace-able tier's
 * *visible* think-time to a jittered, human-plausible delay before it submits.
 *
 * This delays the submit, never the search — no tier's strength changes (the
 * ladder anchored by F14/F15 stays valid). The ranges are tuned against each
 * tier's own search cost (easy ≈ instant, medium ≈ 0.5 s, hard ≈ 2 s budget) so
 * total visible time stays human and rises with tier. `extreme` is excluded from
 * blitz entirely (see resolveExtremeForBlitz), so it never paces.
 */
const BLITZ_PACE_MS: Record<Exclude<Difficulty, 'extreme'>, [number, number]> = {
  easy: [1200, 2200],
  medium: [1000, 1800],
  hard: [300, 900],
};

/** A jittered per-move pacing delay in ms for `tier` under a blitz clock. */
export function blitzPaceMs(tier: Difficulty, rand: () => number = Math.random): number {
  if (tier === 'extreme') return 0; // excluded from blitz; never paced
  const [lo, hi] = BLITZ_PACE_MS[tier];
  return lo + Math.floor(rand() * (hi - lo + 1));
}

/**
 * Sanitize a setup so `extreme` never races a blitz clock (P25). Extreme has no
 * time budget (~12 s/move), already longer than a 5–10 s limit, so pacing can't
 * fix it — with blitz on, any extreme seat drops to `hard`. Returns the same
 * object reference when nothing changes (blitz off, or no extreme seats).
 */
export function resolveExtremeForBlitz(
  botDifficulties: Record<string, Difficulty>,
  blitzSeconds: BlitzSeconds,
): Record<string, Difficulty> {
  if (blitzSeconds == null) return botDifficulties;
  let changed = false;
  const next: Record<string, Difficulty> = {};
  for (const [seat, d] of Object.entries(botDifficulties)) {
    if (d === 'extreme') {
      next[seat] = 'hard';
      changed = true;
    } else {
      next[seat] = d;
    }
  }
  return changed ? next : botDifficulties;
}
