/**
 * Shared reader for the pool round-robin's `.result` shard cache (P62).
 *
 * The shard format originates in AE21 (which built this harness and then closed
 * no-win); the cache and the tooling over it long outlived that experiment, so they
 * are named for what they do, not for the question that first needed them.
 *
 * Extracted from `pool-report.ts` so the human-readable pool report and the committed
 * ladder artifact (`ladder-build.ts`) are computed by the *same* code. Two copies of
 * this parser would be free to disagree, and a ladder that disagrees with the report
 * it was supposedly read off is exactly the drift P62 exists to prevent.
 *
 * A shard file holds `RESULT\t<a>_vs_<b>\t<wins>\t<games>` lines. Cells carry
 * independent n, so a champion-cell sweep at directional n pools cleanly with a
 * champion-free sweep at high n.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PooledCell {
  wins: number;
  games: number;
}

export interface PooledShards {
  /** Every member name seen in any shard. */
  names: string[];
  /** pooled[a][b] — summed across every batch of every dir. */
  pooled: Record<string, Record<string, PooledCell>>;
  /** Same data split for `bradleyTerryElo`, which takes wins and n separately. */
  wins: Record<string, Record<string, number>>;
  games: Record<string, Record<string, number>>;
  /** How many `.result` files contributed. */
  files: number;
}

/** Every `*.result` path under `dir`, recursing so champion sub-dirs pool too. */
export function resultFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...resultFiles(p));
    else if (e.name.endsWith('.result')) out.push(p);
  }
  return out;
}

/** Sum every shard under `dirs` into one pairwise matrix. */
export function poolShards(dirs: string[]): PooledShards {
  const pooled: Record<string, Record<string, PooledCell>> = {};
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

  return { names, pooled, wins, games, files };
}

/** 95% Wilson interval; fractional `w` (ties split) is fine — it enters only via p̂. */
export function wilson(w: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = w / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
