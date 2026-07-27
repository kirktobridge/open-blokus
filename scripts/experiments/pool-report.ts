/**
 * Human-readable pool report: round-robin shards → pairwise matrix → Bradley-Terry
 * Elo + Wilson CIs.
 *
 * Reads every `*.result` file under the given dir(s) (see pool-sweep.sh), sums each
 * ordered pairing's fractional wins and games across batches, refits pool Elo with the
 * same `bradleyTerryElo` the live CLI uses, and prints the Elo-ordered game-share matrix
 * with a per-cell 95% Wilson CI. Cells carry independent n, so a champion-cell sweep at
 * directional n pools cleanly with a champion-free sweep at high n.
 *
 * Shard reading and the Wilson interval live in `lib/shards.ts`, shared with
 * `ladder-build.ts` so the committed artifact and this report can't drift apart (P62).
 *
 * Usage: vite-node scripts/experiments/pool-report.ts <dir> [<dir> ...]
 */
import { bradleyTerryElo } from '../../src/game/ai/arena';
import { poolShards, wilson } from './lib/shards';

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('usage: vite-node pool-report.ts <dir> [<dir> ...]');
  process.exit(1);
}

const { names, pooled, wins, games, files } = poolShards(dirs);

const elo = bradleyTerryElo(names, wins, games);
const order = [...names].sort((x, y) => elo[y] - elo[x]);

const pct = (x: number) => (x * 100).toFixed(0).padStart(3) + '%';

console.log(`\nAE21 pooled round-robin  (${files} batch files, ${names.length} members)`);
const head = order.map((nm) => nm.slice(0, 7).padStart(8)).join('');
console.log(`  ${''.padEnd(14)}${head}`);
for (const a of order) {
  const row = order
    .map((b) => (a === b ? '    —   ' : pct(pooled[a]?.[b] ? pooled[a][b].wins / pooled[a][b].games : 0).padStart(8)))
    .join('');
  console.log(`  ${a.padEnd(14)}${row}`);
}

console.log(`\n  Pool Elo (Bradley-Terry, centered 1500) + head-to-head-vs-incumbent:`);
for (const nm of order) {
  console.log(`  ${nm.padEnd(14)} ${elo[nm].toFixed(0).padStart(5)}`);
}

console.log(`\n  Per-cell game-share with 95% Wilson CI (row vs col):`);
for (const a of order) {
  for (const b of order) {
    const cell = pooled[a]?.[b];
    if (!cell || a === b) continue;
    const p = cell.wins / cell.games;
    const [lo, hi] = wilson(cell.wins, cell.games);
    console.log(
      `  ${(a + ' vs ' + b).padEnd(30)} ${(p * 100).toFixed(1).padStart(5)}%  ` +
        `[${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]  n=${cell.games}`,
    );
  }
}
