import type { MctsConfig } from '../../game/ai/mcts';

/** Offline-AI difficulty. Easy = heuristic bot; medium/hard = MCTS by time budget. */
export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Per-move MCTS time budgets (ms). Tunable — see docs/research/backlog/ai-engine.md (AE5). */
const BUDGET_MS: Record<Exclude<Difficulty, 'easy'>, number> = {
  medium: 500,
  hard: 2000,
};

/** MCTS config for a difficulty tier (full rollouts — the strongest axis, Run I). */
export function mctsConfigFor(difficulty: 'medium' | 'hard'): Partial<MctsConfig> {
  return {
    timeBudgetMs: BUDGET_MS[difficulty],
    minIterations: 8,
    rolloutDepth: 0,
    beam: 16,
  };
}
