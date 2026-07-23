/**
 * Pool AE21 round-robin shards → pairwise matrix → Bradley-Terry Elo + Wilson CIs.
 *
 * Reads every `*.result` file under the given dir(s) (see ae21-sweep.sh), sums each
 * ordered pairing's fractional wins and games across batches, refits pool Elo with the
 * same `bradleyTerryElo` the live CLI uses, and prints the Elo-ordered game-share matrix
 * with a per-cell 95% Wilson CI. Cells carry independent n, so a champion-cell sweep at
 * directional n pools cleanly with a champion-free sweep at high n.
 *
 * Usage: vite-node scripts/experiments/ae21-pool.ts <dir> [<dir> ...]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bradleyTerryElo } from '../../src/game/ai/arena';

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('usage: vite-node ae21-pool.ts <dir> [<dir> ...]');
  process.exit(1);
}

/** Every `*.result` path under `dir`, recursing so champion sub-dirs pool too. */
function resultFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...resultFiles(p));
    else if (e.name.endsWith('.result')) out.push(p);
  }
  return out;
}

// pooled[a][b] = { wins, games } summed across every batch of every dir.
const pooled: Record<string, Record<string, { wins: number; games: number }>> = {};
const seen = new Set<string>();
let files = 0;

for (const dir of dirs) {
  for (const path of resultFiles(dir)) {
    files++;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.startsWith('RESULT')) continue;
      const [, key, wins, games] = line.split('\t');
      const sep = key.indexOf('_vs_');
      const a = key.slice(0, sep);
      const b = key.slice(sep + 4);
      seen.add(a);
      seen.add(b);
      (pooled[a] ??= {})[b] ??= { wins: 0, games: 0 };
      pooled[a][b].wins += Number(wins);
      pooled[a][b].games += Number(games);
    }
  }
}

const names = [...seen];
const wins: Record<string, Record<string, number>> = {};
const games: Record<string, Record<string, number>> = {};
for (const a of names) {
  wins[a] = {};
  games[a] = {};
  for (const b of names) {
    const cell = pooled[a]?.[b];
    if (cell && cell.games > 0) {
      wins[a][b] = cell.wins;
      games[a][b] = cell.games;
    }
  }
}

const elo = bradleyTerryElo(names, wins, games);
const order = [...names].sort((x, y) => elo[y] - elo[x]);

// 95% Wilson interval; fractional `w` (ties split) is fine — it enters only via p̂.
function wilson(w: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = w / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

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
