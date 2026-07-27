/**
 * Generate a committed Elo ladder artifact from the `.result` shard cache (P62).
 *
 * The counterpart to `ae21-pool.ts`: same shards, same Bradley-Terry fit, same Wilson
 * intervals (all via `lib/shards.ts` + `arena.ts`), but the output is the machine-
 * readable `src/game/ai/ladder/<variant>.json` that P61 reads and
 * `tests/ladder-artifact.test.ts` guards — rather than a table for a human.
 *
 * The artifact records the fingerprint of the pool it was fit from, so a later pool
 * edit without a recalibration fails CI instead of shipping stale ratings.
 *
 * Usage:
 *   vite-node scripts/experiments/ae21-ladder.ts <shard-dir> [<shard-dir> ...]
 *     [--variant=classic] [--pool=scripts/experiments/pool.json] [--out=<path>]
 *     [--source="AE21 Run W2 re-run (P62)"] [--check]
 *
 * `--check` prints what it would write and exits non-zero if that differs from the
 * artifact on disk — the recalibration driver's "did this actually change anything?"
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bradleyTerryElo } from '../../src/game/ai/arena';
import { poolFingerprint, type PoolFile } from '../../src/game/ai/ladder/hash';
import { poolShards, wilson } from './lib/shards';

const argv = process.argv.slice(2);
const dirs = argv.filter((a) => !a.startsWith('--'));
const flag = (name: string, fallback: string) =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

if (!dirs.length) {
  console.error('usage: vite-node ae21-ladder.ts <shard-dir> [...] [--variant=] [--pool=] [--out=]');
  process.exit(1);
}

const variant = flag('variant', 'classic');
const poolPath = flag('pool', 'scripts/experiments/pool.json');
const outPath = flag('out', `src/game/ai/ladder/${variant}.json`);
const source = flag('source', 'AE21 pool round-robin');
const check = argv.includes('--check');

const pool = JSON.parse(readFileSync(poolPath, 'utf8')) as PoolFile;
const { names, pooled, wins, games, files } = poolShards(dirs);

// Members present in the shards but not the pool file (or vice versa) mean the shard
// cache and pool.json have drifted — the artifact would misrepresent either way.
const poolNames = new Set(pool.members.map((m) => m.name));
const strays = names.filter((n) => !poolNames.has(n));
if (strays.length) {
  console.error(`shards contain members absent from ${poolPath}: ${strays.join(', ')}`);
  process.exit(1);
}
const unmeasured = pool.members.map((m) => m.name).filter((n) => !names.includes(n));
if (unmeasured.length) {
  console.error(`WARNING: pool members with no shard data (omitted from the ladder): ${unmeasured.join(', ')}`);
}

const elo = bradleyTerryElo(names, wins, games);
const ranking = [...names].sort((x, y) => elo[y] - elo[x]);

const cells = [];
for (const a of ranking) {
  for (const b of ranking) {
    const cell = pooled[a]?.[b];
    if (!cell || a === b || cell.games === 0) continue;
    const [lo, hi] = wilson(cell.wins, cell.games);
    cells.push({
      a,
      b,
      share: round(cell.wins / cell.games, 4),
      wins: round(cell.wins, 4),
      games: cell.games,
      ci: [round(lo, 4), round(hi, 4)] as [number, number],
    });
  }
}

const artifact = {
  schema: 1 as const,
  variant,
  pool: {
    file: poolPath,
    fingerprint: poolFingerprint(pool),
    members: pool.members.map((m) => m.name),
  },
  provenance: {
    generated: new Date().toISOString().slice(0, 10),
    source,
    shardDirs: dirs,
    batchFiles: files,
  },
  fit: { method: 'bradley-terry-mm', centeredOn: 1500, prior: 0.5 },
  elo: Object.fromEntries(ranking.map((n) => [n, Math.round(elo[n])])),
  ranking,
  anchors: {
    champion: pool.members.find((m) => m.tags?.champion)?.name,
    incumbent: pool.members.find((m) => m.tags?.incumbent)?.name,
  },
  cells,
};

/** Fixed-precision rounding keeps the committed JSON diffable across regenerations. */
function round(x: number, dp: number): number {
  return Number(x.toFixed(dp));
}

const json = JSON.stringify(artifact, null, 2) + '\n';

if (check) {
  let existing = '';
  try {
    existing = readFileSync(outPath, 'utf8');
  } catch {
    console.error(`no artifact at ${outPath}`);
    process.exit(1);
  }
  // `provenance.generated` moves on every run; compare everything else.
  const strip = (s: string) => s.replace(/"generated": "[^"]*",?\n/, '');
  if (strip(existing) === strip(json)) {
    console.log(`${outPath} is up to date (${files} batch files, ${names.length} members)`);
    process.exit(0);
  }
  console.error(`${outPath} differs from the shards — rerun without --check to regenerate`);
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);

console.log(`wrote ${outPath}  (${files} batch files, ${names.length} members, ${cells.length} cells)`);
console.log(`  pool fingerprint ${artifact.pool.fingerprint}`);
for (const n of ranking) {
  const vsInc = artifact.anchors.incumbent ? pooled[n]?.[artifact.anchors.incumbent] : undefined;
  const share = vsInc ? `  vs incumbent ${((vsInc.wins / vsInc.games) * 100).toFixed(1)}% (n=${vsInc.games})` : '';
  console.log(`  ${n.padEnd(14)} ${String(artifact.elo[n]).padStart(5)}${share}`);
}
