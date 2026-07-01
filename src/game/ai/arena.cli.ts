/**
 * CPU-strategy benchmark runner.  `npm run arena [games] [seeds] [baseSeed]`
 *
 * Each table averages over `seeds` independent seeds and reports mean ± std of
 * the per-seat win rate, so noise (which once made frontier=6 look good on a
 * single seed but not across seeds) can't mislead a tuning call.
 */
import {
  runTournamentSeeds,
  randomStrategy,
  greedySizeStrategy,
  heuristicStrategy,
  type Contestant,
} from './arena';
import { alphaBetaStrategy } from './alphabeta';
import { mctsStrategy } from './mcts';
import { WEIGHTS, type Weights } from './heuristic';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const games = Number(args[0] ?? 100);
const seeds = Number(args[1] ?? 8);
const baseSeed = Number(args[2] ?? 1);

function table(
  title: string,
  contestants: Contestant[],
  g: number = games,
  s: number = seeds,
): void {
  const r = runTournamentSeeds(contestants, { games: g, seeds: s, baseSeed });
  console.log(
    `\n${title}  (${s}×${g} games, base seed ${baseSeed}, mean ties ${r.meanTies.toFixed(1)})`,
  );
  for (const row of r.rows) {
    const bar = '█'.repeat(Math.round(row.meanRate * 40));
    console.log(
      `  ${row.name.padEnd(18)} ${(row.meanRate * 100).toFixed(1).padStart(5)}% ` +
        `±${(row.stdRate * 100).toFixed(1).padStart(4)}  ` +
        `game-share ${(row.meanGameShare * 100).toFixed(0).padStart(3)}%  ${bar}`,
    );
  }
}

const variant = (over: Partial<Weights>): Weights => ({ ...WEIGHTS, ...over });

// 1. Baselines: random vs size-greedy vs full heuristic.
table('Baselines', [
  { name: 'random', strategy: randomStrategy },
  { name: 'greedy-size', strategy: greedySizeStrategy },
  { name: 'heuristic', strategy: heuristicStrategy() },
  { name: 'greedy-size#2', strategy: greedySizeStrategy },
]);

// 2. Heuristic vs size-greedy head-to-head (2 seats each).
table('Heuristic vs greedy-size', [
  { name: 'heuristic', strategy: heuristicStrategy() },
  { name: 'greedy-size', strategy: greedySizeStrategy },
  { name: 'heuristic', strategy: heuristicStrategy() },
  { name: 'greedy-size', strategy: greedySizeStrategy },
]);

// 3. Weight ablation: does each term earn its keep vs the full heuristic?
table('Weight ablation', [
  { name: 'full', strategy: heuristicStrategy(WEIGHTS) },
  { name: 'no-block', strategy: heuristicStrategy(variant({ block: 0 })) },
  { name: 'no-center', strategy: heuristicStrategy(variant({ center: 0 })) },
  { name: 'no-frontier', strategy: heuristicStrategy(variant({ frontier: 0 })) },
]);

// 4. Frontier emphasis sweep.
table('Frontier weight sweep', [
  { name: 'frontier-1', strategy: heuristicStrategy(variant({ frontier: 1 })) },
  { name: 'frontier-3', strategy: heuristicStrategy(variant({ frontier: 3 })) },
  { name: 'frontier-6', strategy: heuristicStrategy(variant({ frontier: 6 })) },
  { name: 'frontier-10', strategy: heuristicStrategy(variant({ frontier: 10 })) },
]);

// 5. Alpha-beta vs heuristic — opt-in (`--ab`), it's ~4s/game so games are capped.
if (flags.has('--ab')) {
  const abGames = Math.min(games, 16);
  const abSeeds = Math.min(seeds, 4);
  table(
    'Alpha-beta vs heuristic (slow)',
    [
      { name: 'alphabeta-d2', strategy: alphaBetaStrategy({ depth: 2, beam: 8 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
      { name: 'alphabeta-d2', strategy: alphaBetaStrategy({ depth: 2, beam: 8 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
    ],
    abGames,
    abSeeds,
  );
}

// 6. MCTS vs heuristic — opt-in (`--mcts`), very slow (seconds/move) so games
// and seeds are capped hard. Tune iterations/rolloutDepth here for Run H.
if (flags.has('--mcts')) {
  const mctsGames = Math.min(games, 8);
  const mctsSeeds = Math.min(seeds, 3);
  table(
    'MCTS vs heuristic (very slow)',
    [
      { name: 'mcts', strategy: mctsStrategy({ iterations: 150, rolloutDepth: 12 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
      { name: 'mcts', strategy: mctsStrategy({ iterations: 150, rolloutDepth: 12 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
    ],
    mctsGames,
    mctsSeeds,
  );
}
