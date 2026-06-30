/**
 * Headless self-play arena for CPU strategy research (pure — no React / bgio).
 *
 * Drives full games through the rules core so strategies can be benchmarked
 * head-to-head, the way cchung89/Blokus_Game_Solver runs 100-match tournaments.
 * Everything is seeded, so results are reproducible.
 */
import { COLOR_ORDER } from '../types';
import type { Color, GameMode, GameState, Placement, ScoringVariant } from '../types';
import { createInitialState } from '../modes';
import { resolveCells, pieceSize } from '../pieces';
import { applyPlacement } from '../placement';
import { generateLegalMoves, hasAnyMove } from '../moves';
import { finalScores } from '../scoring';
import { chooseMove, WEIGHTS } from './heuristic';
import type { Weights } from './heuristic';

/** A CPU strategy: pick a legal placement for `color`, or null if none. */
export type Strategy = (G: GameState, color: Color, rng: () => number) => Placement | null;

/** A named strategy that competes in a tournament. */
export interface Contestant {
  name: string;
  strategy: Strategy;
}

// --- Seeded RNG (mulberry32) — deterministic, JSON-state-free -------------

/** Returns a `() => number` in [0,1) seeded by `seed`. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a uniformly random element. */
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// --- Strategies -----------------------------------------------------------

/** Pure random legal move (their "random" baseline). */
export const randomStrategy: Strategy = (G, color, rng) => {
  const moves = generateLegalMoves(G, color);
  return moves.length ? pick(moves, rng) : null;
};

/** Biggest piece, random placement among the largest (their "simple greedy"). */
export const greedySizeStrategy: Strategy = (G, color, rng) => {
  const moves = generateLegalMoves(G, color);
  if (!moves.length) return null;
  let best = 0;
  for (const m of moves) best = Math.max(best, pieceSize(m.pieceId));
  const top = moves.filter((m) => pieceSize(m.pieceId) === best);
  return pick(top, rng);
};

/** The shipped weighted heuristic, optionally with custom weights. */
export function heuristicStrategy(weights: Weights = WEIGHTS): Strategy {
  return (G, color, rng) => chooseMove(G, color, rng, weights);
}

// --- Game driver ----------------------------------------------------------

/** Advance to the next non-stuck color (mirrors BlokusGame.advanceActiveColor). */
function advanceActiveColor(G: GameState): void {
  for (let step = 1; step <= COLOR_ORDER.length; step++) {
    const i = (G.activeColorIndex + step) % COLOR_ORDER.length;
    if (!G.colors[COLOR_ORDER[i]].stuck) {
      G.activeColorIndex = i;
      return;
    }
  }
}

function recomputeStuck(G: GameState): void {
  for (const c of COLOR_ORDER) G.colors[c].stuck = !hasAnyMove(G, c);
}

/**
 * Play one full game with a strategy assigned to each color. Returns the
 * final-scores payload (per-color scores, per-player totals, winners).
 */
export function playGame(
  byColor: Record<Color, Strategy>,
  opts: { mode?: GameMode; scoring?: ScoringVariant; rng?: () => number } = {},
): ReturnType<typeof finalScores> {
  const { mode = 4, scoring = 'basic', rng = Math.random } = opts;
  const G = createInitialState(mode, scoring);
  recomputeStuck(G);

  while (!COLOR_ORDER.every((c) => G.colors[c].stuck)) {
    const color = COLOR_ORDER[G.activeColorIndex];
    if (G.colors[color].stuck) {
      advanceActiveColor(G);
      continue;
    }
    const move = byColor[color](G, color, rng);
    if (!move) {
      // Strategy yielded nothing though a move exists: treat as stuck, skip.
      G.colors[color].stuck = true;
      advanceActiveColor(G);
      continue;
    }
    applyPlacement(G, color, move.pieceId, resolveCells(move));
    recomputeStuck(G);
    advanceActiveColor(G);
  }
  return finalScores(G);
}

// --- Tournament -----------------------------------------------------------

export interface TournamentResult {
  /** Wins credited to each contestant name (ties split evenly). */
  wins: Record<string, number>;
  /** Games each contestant participated in. */
  played: Record<string, number>;
  /** Win rate = wins / played. */
  winRate: Record<string, number>;
  games: number;
  ties: number;
}

/**
 * Run `games` matches among `contestants` (one per color → length must equal the
 * mode's color count: 4). Seat assignment rotates each game so first-move
 * advantage is shared evenly. Wins are credited by contestant name; ties split
 * the win 1/k across co-winners. Seeded by `seed` for reproducibility.
 */
export function runTournament(
  contestants: Contestant[],
  opts: { games?: number; mode?: GameMode; scoring?: ScoringVariant; seed?: number } = {},
): TournamentResult {
  const { games = 100, mode = 4, scoring = 'basic', seed = 1 } = opts;
  const n = COLOR_ORDER.length;
  if (contestants.length !== n) {
    throw new Error(`need ${n} contestants for mode ${mode}, got ${contestants.length}`);
  }

  const rng = mulberry32(seed);
  const wins: Record<string, number> = {};
  const played: Record<string, number> = {};
  let ties = 0;

  for (const c of contestants) {
    wins[c.name] ??= 0;
    played[c.name] ??= 0;
  }

  for (let g = 0; g < games; g++) {
    // Rotate which color each contestant occupies.
    const seatName: Record<Color, string> = {} as Record<Color, string>;
    const byColor: Record<Color, Strategy> = {} as Record<Color, Strategy>;
    contestants.forEach((c, i) => {
      const color = COLOR_ORDER[(i + g) % n];
      seatName[color] = c.name;
      byColor[color] = c.strategy;
    });
    for (const c of contestants) played[c.name] += 1;

    const { winners } = playGame(byColor, { mode, scoring, rng });
    // winners are playerIDs; in 4p each color is its own player ("0".."3").
    // Map winner playerIDs back to colors via owners, then to names.
    const winColors = COLOR_ORDER.filter(
      (color) => winners.includes(String(seatPosOf(color))),
    );
    if (winColors.length !== 1) ties += 1;
    const share = winColors.length ? 1 / winColors.length : 0;
    for (const color of winColors) wins[seatName[color]] += share;
  }

  const winRate: Record<string, number> = {};
  for (const name of Object.keys(wins)) {
    winRate[name] = played[name] ? wins[name] / played[name] : 0;
  }
  return { wins, played, winRate, games, ties };
}

/** In 4p each color owns its own playerID, equal to its turn-order index. */
function seatPosOf(color: Color): number {
  return COLOR_ORDER.indexOf(color);
}

// --- Multi-seed averaging -------------------------------------------------

export interface AveragedRow {
  name: string;
  /** Mean per-seat win rate across seeds. */
  meanRate: number;
  /** Sample standard deviation of the per-seat win rate. */
  stdRate: number;
  /** Mean share of *games* won (wins / games), summed over a name's seats. */
  meanGameShare: number;
}

export interface AveragedResult {
  rows: AveragedRow[];
  seeds: number;
  gamesPerSeed: number;
  meanTies: number;
}

/**
 * Run the tournament across `seeds` independent seeds (base..base+seeds-1) and
 * aggregate, so tuning decisions rest on a mean ± spread rather than a single
 * noisy table. Rows are sorted by mean win rate (desc).
 */
export function runTournamentSeeds(
  contestants: Contestant[],
  opts: {
    games?: number;
    mode?: GameMode;
    scoring?: ScoringVariant;
    seeds?: number;
    baseSeed?: number;
  } = {},
): AveragedResult {
  const { games = 100, mode = 4, scoring = 'basic', seeds = 10, baseSeed = 1 } = opts;
  const names = [...new Set(contestants.map((c) => c.name))];

  const rateSamples: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const shareSamples: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  let tieTotal = 0;

  for (let s = 0; s < seeds; s++) {
    const r = runTournament(contestants, { games, mode, scoring, seed: baseSeed + s });
    for (const n of names) {
      rateSamples[n].push(r.winRate[n]);
      shareSamples[n].push(r.wins[n] / r.games);
    }
    tieTotal += r.ties;
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const std = (xs: number[]) => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  };

  const rows = names
    .map((name) => ({
      name,
      meanRate: mean(rateSamples[name]),
      stdRate: std(rateSamples[name]),
      meanGameShare: mean(shareSamples[name]),
    }))
    .sort((a, b) => b.meanRate - a.meanRate);

  return { rows, seeds, gamesPerSeed: games, meanTies: tieTotal / seeds };
}
