import type { MctsConfig } from '../../game/ai/mcts';

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
