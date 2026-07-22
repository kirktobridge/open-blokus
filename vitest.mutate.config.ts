import { defineConfig, mergeConfig, configDefaults } from 'vitest/config';
import base from './vite.config';

/**
 * Test set for mutation testing (npm run mutate). Extends the normal Vitest
 * config but drops the AI-simulation suites. Those tests (arena, mcts,
 * alphabeta, selfplay, duoAi, ai) exercise the rules-core hot path — moves,
 * board, placement, pieces, bitboard — millions of times per run; the full
 * suite is 18s, but under Stryker's `perTest` coverage instrumentation of those
 * hot files it balloons past the 5-min dry-run timeout. They're also poor
 * signal here: a mutant killed only by an arena sim isn't a meaningful
 * unit-level kill. The targeted rules tests (moves/placement/pieces/scoring/…)
 * are what should pin the core, and they stay.
 */
const AI_SIM_TESTS = [
  'tests/arena.test.ts',
  'tests/mcts.test.ts',
  'tests/alphabeta.test.ts',
  'tests/selfplay.test.ts',
  'tests/duoAi.test.ts',
  'tests/ai.test.ts',
];

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, ...AI_SIM_TESTS],
    },
  }),
);
