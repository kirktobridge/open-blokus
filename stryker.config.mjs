// Mutation testing for the pure rules core. Stryker sandboxes each mutant in
// its own temp copy and runs the Vitest suite against it — there is no in-place
// git write/revert loop, so a botched revert can't contaminate later mutants
// (the failure class that motivated adopting this over a hand-rolled script).
//
// Scope is deliberately the deterministic rules core (src/game/*, puzzle/) and
// NOT src/game/ai/** — the AI subtree is stochastic (MCTS) and holds CLI entry
// points with no unit coverage, so it would produce noise, not signal. Widen
// `mutate` once a target has tests that pin it down.
//
// Config is read from vite.config.ts automatically by the vitest runner.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  // Mutation runs use a trimmed test set that excludes the AI-simulation suites
  // — they hammer the instrumented rules-core hot path and blow past the
  // dry-run timeout. See vitest.mutate.config.ts for the why.
  vitest: { configFile: 'vitest.mutate.config.ts' },
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  mutate: [
    'src/game/*.ts',
    'src/game/puzzle/*.ts',
    '!src/game/index.ts',
    '!src/game/types.ts',
  ],
};
