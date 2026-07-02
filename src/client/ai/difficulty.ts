import type { MctsConfig } from '../../game/ai/mcts';

/** Offline-AI difficulty. Easy = heuristic bot; medium/hard = MCTS by time budget. */
export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Per-move MCTS time budgets (ms). Tunable — see docs/research/backlog/ai-engine.md (AE10). */
const BUDGET_MS: Record<Exclude<Difficulty, 'easy'>, number> = {
  medium: 500,
  hard: 2000,
};

/**
 * Per-tier action-pruning beam. Must scale with the (small, phase-varying)
 * iteration budget or the low tier breaks: at ~30 iters/move a `beam=16` spreads
 * ~2 rollouts over 16 children (noise) and medium *loses* to the heuristic — see
 * F8 / AE5. Rule of thumb `beam ≈ iters/6`; medium ≈ 30 iters → 6, hard ≈ 140 → 16.
 */
const BEAM: Record<Exclude<Difficulty, 'easy'>, number> = {
  medium: 6,
  hard: 16,
};

/** MCTS config for a difficulty tier (full rollouts — the strongest axis, Run I). */
export function mctsConfigFor(difficulty: 'medium' | 'hard'): Partial<MctsConfig> {
  return {
    timeBudgetMs: BUDGET_MS[difficulty],
    minIterations: 8,
    rolloutDepth: 0,
    beam: BEAM[difficulty],
  };
}
