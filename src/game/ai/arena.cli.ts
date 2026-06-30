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
import { WEIGHTS, type Weights } from './heuristic';

const games = Number(process.argv[2] ?? 100);
const seeds = Number(process.argv[3] ?? 8);
const baseSeed = Number(process.argv[4] ?? 1);

function table(title: string, contestants: Contestant[]): void {
  const r = runTournamentSeeds(contestants, { games, seeds, baseSeed });
  console.log(
    `\n${title}  (${seeds}×${games} games, base seed ${baseSeed}, mean ties ${r.meanTies.toFixed(1)})`,
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
