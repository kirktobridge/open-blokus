/**
 * AE18 sub-item 1 bench: arena-driver throughput (games/s) with fast strategies,
 * isolating the playGame loop cost. Run new, `git stash` arena.ts, run for baseline.
 *   npx vite-node scripts/bench-driver.ts
 */
import { runTournament, heuristicStrategy, greedySizeStrategy, randomStrategy } from '../src/game/ai/arena';
const make = () => [
  { name: 'heuristic', strategy: heuristicStrategy() },
  { name: 'greedy', strategy: greedySizeStrategy },
  { name: 'random', strategy: randomStrategy },
  { name: 'greedy2', strategy: greedySizeStrategy },
];
const GAMES = 300;
// warmup
runTournament(make(), { games: 20, seed: 1 });
let best = Infinity;
for (let rep = 0; rep < 3; rep++) {
  const t0 = process.hrtime.bigint();
  runTournament(make(), { games: GAMES, seed: 1 });
  best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
}
console.log(`${GAMES} games, best-of-3: ${best.toFixed(0)}ms  (${(GAMES / best * 1000).toFixed(1)} games/s)`);
