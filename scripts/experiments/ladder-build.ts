/**
 * Generate a committed Elo ladder artifact from the `.result` shard cache (P62).
 *
 * The counterpart to `pool-report.ts`: same shards, same Bradley-Terry fit, same Wilson
 * intervals (all via `lib/shards.ts` + `arena.ts`), but the output is the machine-
 * readable `src/game/ai/ladder/<variant>.json` that P61 reads and
 * `tests/ladder-artifact.test.ts` guards — rather than a table for a human.
 *
 * The artifact records the fingerprint of the pool it was fit from, so a later pool
 * edit without a recalibration fails CI instead of shipping stale ratings.
 *
 * Usage:
 *   vite-node scripts/experiments/ladder-build.ts <shard-dir> [<shard-dir> ...]
 *     [--variant=classic] [--pool=scripts/experiments/pool.json] [--out=<path>]
 *     [--source="AE21 Run W2 re-run (P62)"] [--anchor=heuristic] [--anchor-elo=1549]
 *     [--check]
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
  console.error('usage: vite-node ladder-build.ts <shard-dir> [...] [--variant=] [--pool=] [--out=]');
  process.exit(1);
}

const variant = flag('variant', 'classic');
const poolPath = flag('pool', 'scripts/experiments/pool.json');
const outPath = flag('out', `src/game/ai/ladder/${variant}.json`);
// Must default to something STABLE: `npm run ladder` has to be idempotent, or --check
// reports a spurious diff and stops being usable as a CI guard. One-off context (why a
// particular re-run happened) belongs in the commit message and the research log, not
// in a field that changes every time someone regenerates.
const source = flag('source', 'pool round-robin over pool.json (pool-sweep.sh + pool-champion.sh shards)');
const check = argv.includes('--check');

// The published scale's zero point (P61). BT fixes only rating differences, so this
// is a convention, not a measurement — and the convention has to be a *member*, not
// the pool mean, or adding a bot republishes every tier's rating in the difficulty
// picker without any tier having changed.
//
// Deliberately NOT read from pool.json's `incumbent` tag: `ladder/hash.ts` leaves tags
// out of the fingerprint precisely because re-designating an anchor "moves no rating" —
// true under mean-centering, false here. A tag that could silently shift every rating
// past a staleness guard that ignores it is the drift this artifact exists to stop.
// `tests/ladder-artifact.test.ts` holds the value below.
const anchorMember = flag('anchor', 'heuristic');
const anchorElo = Number(flag('anchor-elo', '1549'));

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
// A member the shards never played would be silently missing from the ladder, and a
// missing rating reads exactly like a member that doesn't exist. Refuse rather than
// warn: a warning scrolls past in a 6-hour sweep's output, and the resulting artifact
// looks complete. `--allow-partial` is for deliberately building against a subset.
const unmeasured = pool.members.map((m) => m.name).filter((n) => !names.includes(n));
if (unmeasured.length && !argv.includes('--allow-partial')) {
  console.error(`error: no shard data for pool member(s): ${unmeasured.join(', ')}`);
  console.error('The ladder would omit them entirely. Run the missing pairs, or pass');
  console.error('--allow-partial if a subset ladder is genuinely what you want.');
  process.exit(1);
}
if (unmeasured.length) {
  console.error(`WARNING (--allow-partial): omitting unmeasured member(s): ${unmeasured.join(', ')}`);
}

const anchor = { member: anchorMember, elo: anchorElo };
const elo = bradleyTerryElo(names, wins, games, { anchor });
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
  schema: 2 as const,
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
  fit: { method: 'bradley-terry-mm', anchor, prior: 0.5 },
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
