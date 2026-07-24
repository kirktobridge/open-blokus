/**
 * AE19 runner: our strategies vs Pentobi over GTP, seed-averaged.
 *
 *   npm run arena:pentobi -- --config=scripts/experiments/ae19-<tier>-L<level>.json
 *   [--games=N] [--seeds=K] [--baseSeed=S] [--bin=/path/to/pentobi-gtp]
 *   [--variant=duo]   # or "variant":"duo" in the config; default classic (AE29)
 *
 * The Pentobi binary is NOT in the repo (GPL, built from source — see the AE19
 * log run). Locate it via `--bin=`, the `PENTOBI_GTP` env var, or the default
 * `~/.local/share/pentobi-gtp/pentobi-gtp`. Config schema:
 *   { "title", "seats": [ {kind:"pentobi",name,level} | {kind:"local",name,strategy,options} ] }
 * with strategy ∈ random|greedy-size|heuristic|mcts. Prints a seed-averaged table
 * and, for each name, the pooled `wins/games` to feed straight into stats.py.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  randomStrategy,
  greedySizeStrategy,
  heuristicStrategy,
  type Strategy,
} from '../arena';
import { mctsStrategy, type MctsConfig } from '../mcts';
import { WEIGHTS, type Weights } from '../heuristic';
import type { Variant } from '../../types';
import { runVsPentobi, type Seat } from './arena';

interface SeatConfig {
  kind: 'local' | 'pentobi';
  name: string;
  level?: number; // pentobi
  strategy?: 'random' | 'greedy-size' | 'heuristic' | 'mcts'; // local
  options?: Record<string, unknown>;
}
interface ExperimentConfig {
  title: string;
  seats: SeatConfig[];
  variant?: Variant;
  games?: number;
  seeds?: number;
  baseSeed?: number;
  threads?: number;
}

function flag(name: string): string | undefined {
  const f = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return f?.slice(name.length + 3);
}

function buildLocalStrategy(seat: SeatConfig): Strategy {
  switch (seat.strategy) {
    case 'random':
      return randomStrategy;
    case 'greedy-size':
      return greedySizeStrategy;
    case 'heuristic':
      return heuristicStrategy(
        seat.options ? { ...WEIGHTS, ...(seat.options as Partial<Weights>) } : WEIGHTS,
      );
    case 'mcts':
      return mctsStrategy((seat.options ?? {}) as Partial<MctsConfig>);
    default:
      throw new Error(`local seat "${seat.name}" needs a strategy`);
  }
}

function toSeat(seat: SeatConfig, levelOverride?: number): Seat {
  if (seat.kind === 'pentobi') {
    const level = levelOverride ?? seat.level;
    if (typeof level !== 'number') throw new Error(`pentobi seat "${seat.name}" needs a level`);
    // Reflect the override in the name so the table/stats read correctly.
    const name = levelOverride !== undefined ? seat.name.replace(/L\d+/, `L${level}`) : seat.name;
    return { kind: 'pentobi', name, level };
  }
  return { kind: 'local', name: seat.name, strategy: buildLocalStrategy(seat) };
}

// --- Seed-averaged stats (mean ± sample std of per-seat game-share) ----------
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

async function main(): Promise<void> {
  const configPath = flag('config');
  if (!configPath) throw new Error('pass --config=scripts/experiments/<id>.json');
  const cfg = JSON.parse(readFileSync(configPath, 'utf8')) as ExperimentConfig;

  const games = Number(flag('games') ?? cfg.games ?? 60);
  const seeds = Number(flag('seeds') ?? cfg.seeds ?? 4);
  const baseSeed = Number(flag('baseSeed') ?? cfg.baseSeed ?? 1);
  const threads = Number(flag('threads') ?? cfg.threads ?? 1);
  const variant = (flag('variant') ?? cfg.variant ?? 'classic') as Variant;
  const binPath =
    flag('bin') ?? process.env.PENTOBI_GTP ?? join(homedir(), '.local/share/pentobi-gtp/pentobi-gtp');

  const levelOverride = flag('level') !== undefined ? Number(flag('level')) : undefined;
  const seats = cfg.seats.map((s) => toSeat(s, levelOverride));
  const names = [...new Set(seats.map((s) => s.name))];

  // Per-seed samples of each name's game-share (wins / games — a *team* share
  // that nulls at (its seats)/(total seats): 50% in the AE19 2v2 and in the AE29
  // Duo 1v1. Pool wins over all seeds and pair against total games for stats.py's
  // 50/50 test.
  const shareSamples: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const totalWins: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
  const totalGames = games * seeds;
  const seatsPerName: Record<string, number> = Object.fromEntries(
    names.map((n) => [n, seats.filter((s) => s.name === n).length]),
  );
  let tieTotal = 0;

  for (let s = 0; s < seeds; s++) {
    const r = await runVsPentobi(seats, { games, seed: baseSeed + s, binPath, threads, variant });
    for (const n of names) {
      shareSamples[n].push(r.wins[n] / r.games);
      totalWins[n] += r.wins[n];
    }
    tieTotal += r.ties;
    process.stderr.write(`  seed ${baseSeed + s} done (${games} games)\n`);
  }

  const rows = names
    .map((name) => ({
      name,
      seats: seatsPerName[name],
      meanShare: mean(shareSamples[name]),
      stdShare: std(shareSamples[name]),
      wins: totalWins[name],
    }))
    .sort((a, b) => b.meanShare - a.meanShare);

  console.log(
    `\n${cfg.title}  (${seeds}×${games} games, base seed ${baseSeed}, threads ${threads}, mean ties/seed ${(
      tieTotal / seeds
    ).toFixed(1)})`,
  );
  for (const row of rows) {
    const bar = '█'.repeat(Math.round(row.meanShare * 40));
    console.log(
      `  ${row.name.padEnd(16)} (${row.seats} seats) game-share ${(row.meanShare * 100)
        .toFixed(1)
        .padStart(5)}% ±${(row.stdShare * 100).toFixed(1).padStart(4)}  ` +
        `(pooled ${row.wins.toFixed(1)}/${totalGames})  ${bar}`,
    );
  }
  console.log(`\nstats.py (pooled team wins / total games — null = seats/${seats.length}):`);
  for (const row of rows) {
    console.log(
      `  ${row.name}: python3 .claude/skills/research/stats.py ${row.wins.toFixed(1)} ${totalGames}`,
    );
  }
  // Machine-parseable line so a sweep orchestrator can pool seed-batch processes.
  for (const row of rows) {
    console.log(`RESULT\t${row.name}\t${row.wins.toFixed(3)}\t${totalGames}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
