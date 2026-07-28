/**
 * Headless self-play arena for CPU strategy research (pure — no React / bgio).
 *
 * Drives full games through the rules core so strategies can be benchmarked
 * head-to-head, the way cchung89/Blokus_Game_Solver runs 100-match tournaments.
 * Everything is seeded, so results are reproducible.
 */
import type {
  ByColor,
  Color,
  GameMode,
  GameState,
  Placement,
  ScoringVariant,
  Variant,
} from '../types';
import { VARIANTS, colorStateOf, createInitialState, ownersFor, playColorsOf } from '../modes';
import { resolveCells, pieceSize } from '../pieces';
import { applyPlacement } from '../placement';
import { generateLegalMoves } from '../moves';
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

/**
 * Advance to the next non-stuck color (mirrors BlokusGame.advanceActiveColor).
 * Walks the *variant's* playing set, so a Duo game rotates over two colors and
 * never reaches for a color it was never dealt.
 */
function advanceActiveColor(G: GameState): void {
  const play = playColorsOf(G);
  for (let step = 1; step <= play.length; step++) {
    const i = (G.activeColorIndex + step) % play.length;
    if (!colorStateOf(G, play[i]).stuck) {
      G.activeColorIndex = i;
      return;
    }
  }
}

/**
 * Play one full game with a strategy assigned to each color. Returns the
 * final-scores payload (per-color scores, per-player totals, winners).
 */
export function playGame(
  byColor: ByColor<Strategy>,
  opts: {
    variant?: Variant;
    mode?: GameMode;
    scoring?: ScoringVariant;
    rng?: () => number;
    /** Called for every accepted move, in play order (self-play logging). */
    onMove?: (color: Color, move: Placement) => void;
  } = {},
): ReturnType<typeof finalScores> {
  const { variant = 'classic', scoring = 'basic', rng = Math.random, onMove } = opts;
  // Default to the variant's fullest table (Classic 4p, Duo 2p) rather than a
  // literal 4, which Duo doesn't support at all.
  const { mode = maxMode(variant) } = opts;
  const G = createInitialState(mode, scoring, variant);
  const play = playColorsOf(G);

  // Lazy stuck detection (AE18): no per-move `recomputeStuck` (= `hasAnyMove` ×4,
  // the expensive full-scan case). A color is discovered stuck only when its
  // strategy returns null. This is byte-identical to the eager driver because
  // (a) faithful strategies return null iff no legal move exists and draw no rng
  // on that path, and (b) legality is monotone — the board only fills, so a stuck
  // color stays stuck. The eager driver's proactive marking only ever *skipped*
  // that color's turn (a zero-rng no-op); here the strategy is called once more
  // and returns null, leaving the rng stream and the played moves identical.
  let live = play.length; // colors not yet known-stuck
  while (live > 0) {
    const color = play[G.activeColorIndex];
    const strategy = byColor[color];
    if (!strategy) throw new Error(`no strategy seated for ${color}`);
    const move = strategy(G, color, rng);
    if (move) {
      onMove?.(color, move);
      applyPlacement(G, color, move.pieceId, resolveCells(move));
    } else {
      colorStateOf(G, color).stuck = true;
      live--;
    }
    advanceActiveColor(G);
  }
  return finalScores(G);
}

// --- Tournament -----------------------------------------------------------

/** Total squares one color owns across all 21 pieces (sum of sizes). */
const TOTAL_SQUARES = 89;

/** The variant's fullest seating — Classic 4p, Duo 2p. */
const maxMode = (variant: Variant): GameMode =>
  VARIANTS[variant].modes.reduce((a, b) => (b > a ? b : a));

/**
 * Squares a color still holds, recovered from its final score. Under `basic` the
 * score *is* the remaining count; under `advanced` (which Duo forces) it is
 * `-remaining`, or a positive all-placed bonus meaning nothing is left.
 */
const remainingFrom = (score: number, scoring: ScoringVariant): number =>
  scoring === 'basic' ? score : Math.max(0, -score);

export interface TournamentResult {
  /** Wins credited to each contestant name (ties split evenly). */
  wins: Record<string, number>;
  /** Games each contestant participated in. */
  played: Record<string, number>;
  /** Win rate = wins / played. */
  winRate: Record<string, number>;
  /**
   * Summed final placement (rank, ties averaged; 1 = best) over each name's seats
   * (AE15). Mean placement = placement / played. Ranking is by final score in the
   * scoring variant's own direction, so it agrees with the winner order under both
   * `basic` (lower is better) and `advanced` (higher is better, bonuses included).
   */
  placement: Record<string, number>;
  /** Summed final placed squares (89 − remaining) over each name's seats (AE15). */
  placedSquares: Record<string, number>;
  games: number;
  ties: number;
}

/**
 * Run `games` matches among `contestants` — one per color, so the list length must
 * equal the variant's play-color count (Classic 4, Duo 2). Seat assignment rotates
 * each game so first-move advantage is shared evenly. Wins are credited by
 * contestant name; ties split the win 1/k across co-winners. Seeded by `seed`.
 */
export function runTournament(
  contestants: Contestant[],
  opts: {
    games?: number;
    variant?: Variant;
    mode?: GameMode;
    scoring?: ScoringVariant;
    seed?: number;
  } = {},
): TournamentResult {
  const { games = 100, variant = 'classic', scoring = 'basic', seed = 1 } = opts;
  const { mode = maxMode(variant) } = opts;
  const play = VARIANTS[variant].playColors;
  const n = play.length;
  if (contestants.length !== n) {
    throw new Error(
      `need ${n} contestants for ${variant} mode ${mode}, got ${contestants.length}`,
    );
  }
  // Colors map to human playerIDs per the variant/mode seating, which is what
  // `finalScores` reports winners as — Duo is black='0'/white='1', not a
  // COLOR_ORDER position.
  const owners = ownersFor(mode, variant);
  const effectiveScoring = VARIANTS[variant].scoring ?? scoring;

  const rng = mulberry32(seed);
  const wins: Record<string, number> = {};
  const played: Record<string, number> = {};
  const placement: Record<string, number> = {};
  const placedSquares: Record<string, number> = {};
  let ties = 0;

  for (const c of contestants) {
    wins[c.name] ??= 0;
    played[c.name] ??= 0;
    placement[c.name] ??= 0;
    placedSquares[c.name] ??= 0;
  }

  for (let g = 0; g < games; g++) {
    // Rotate which color each contestant occupies.
    const seatName: Record<Color, string> = {} as Record<Color, string>;
    const byColor: ByColor<Strategy> = {};
    contestants.forEach((c, i) => {
      const color = play[(i + g) % n];
      seatName[color] = c.name;
      byColor[color] = c.strategy;
    });
    for (const c of contestants) played[c.name] += 1;

    const { winners, colors } = playGame(byColor, { variant, mode, scoring, rng });
    // winners are playerIDs; map them back to colors via the seating, then to names.
    const winColors = play.filter((color) => winners.includes(String(owners[color])));
    if (winColors.length !== 1) ties += 1;
    const share = winColors.length ? 1 / winColors.length : 0;
    for (const color of winColors) wins[seatName[color]] += share;

    // Placement + placed-squares readouts (AE15). Rank by final score in the
    // scoring variant's own direction so it agrees with the winner order; placed
    // squares are recovered separately, since under `advanced` the score carries
    // all-placed bonuses and is not a remaining-square count. Ties averaged:
    // rank = 1 + strictly-better + (tied − 1)/2.
    const scores = play.map((color) => colors[color] ?? 0);
    const better = (a: number, b: number) =>
      effectiveScoring === 'basic' ? a < b : a > b;
    play.forEach((color, i) => {
      let ahead = 0;
      let tied = 0;
      for (const s of scores) {
        if (better(s, scores[i])) ahead++;
        else if (s === scores[i]) tied++;
      }
      placement[seatName[color]] += 1 + ahead + (tied - 1) / 2;
      placedSquares[seatName[color]] +=
        TOTAL_SQUARES - remainingFrom(scores[i], effectiveScoring);
    });
  }

  const winRate: Record<string, number> = {};
  for (const name of Object.keys(wins)) {
    winRate[name] = played[name] ? wins[name] / played[name] : 0;
  }
  return { wins, played, winRate, placement, placedSquares, games, ties };
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
  /** Mean final placement (rank, 1 = best) across seeds (AE15). */
  meanPlacement: number;
  /** Sample std of the per-seed mean placement (AE15). */
  stdPlacement: number;
  /** Mean final placed squares (89 − remaining) across seeds (AE15). */
  meanPlacedSquares: number;
  /** Sample std of the per-seed mean placed squares (AE15). */
  stdPlacedSquares: number;
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
    variant?: Variant;
    mode?: GameMode;
    scoring?: ScoringVariant;
    seeds?: number;
    baseSeed?: number;
  } = {},
): AveragedResult {
  const { games = 100, variant = 'classic', scoring = 'basic', seeds = 10, baseSeed = 1 } = opts;
  const { mode = maxMode(variant) } = opts;
  const names = [...new Set(contestants.map((c) => c.name))];

  const rateSamples: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const shareSamples: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const placementSamples: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const placedSamples: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  let tieTotal = 0;

  for (let s = 0; s < seeds; s++) {
    const r = runTournament(contestants, {
      games,
      variant,
      mode,
      scoring,
      seed: baseSeed + s,
    });
    for (const n of names) {
      rateSamples[n].push(r.winRate[n]);
      shareSamples[n].push(r.wins[n] / r.games);
      placementSamples[n].push(r.played[n] ? r.placement[n] / r.played[n] : 0);
      placedSamples[n].push(r.played[n] ? r.placedSquares[n] / r.played[n] : 0);
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
      meanPlacement: mean(placementSamples[name]),
      stdPlacement: std(placementSamples[name]),
      meanPlacedSquares: mean(placedSamples[name]),
      stdPlacedSquares: std(placedSamples[name]),
    }))
    .sort((a, b) => b.meanRate - a.meanRate);

  return { rows, seeds, gamesPerSeed: games, meanTies: tieTotal / seeds };
}

// --- Round-robin population play (AE21) ------------------------------------
//
// Head-to-head-vs-the-incumbent judges a bot on one yardstick; population play
// judges it against a diverse *pool* so convention-brittle strengths (beats one
// opponent, folds against off-distribution play — the 4p kingmaker caveat) show
// up. Every unordered pair plays a mirrored match (2 seats each on Classic, 1
// each on Duo), filling a pairwise game-share matrix; a Bradley-Terry fit turns
// that matrix into a single Elo per member — the pool ranking. The frozen pool
// is versioned in scripts/experiments/pool.json; its top entry is the champion,
// the latency-unbounded strength ceiling P13's shippable tiers are measured against.

/** One member of the frozen evaluation pool. */
export interface PoolMember extends Contestant {
  /** Marks the versioned champion (top of pool.json) and/or the shipped incumbent. */
  tags?: { champion?: boolean; incumbent?: boolean };
}

/** A single pairwise cell of the round-robin matrix. */
export interface PairResult {
  /** Row member's mean game-share vs the column member (fractional wins / games). */
  share: number;
  /** Fractional games the row member won (ties split), summed over its seats. */
  wins: number;
  /** Games behind this cell (games × seeds). Wilson CIs are computed from wins/n. */
  games: number;
}

export interface RoundRobinResult {
  names: string[];
  /** matrix[a][b] = a's head-to-head result vs b (undefined on the diagonal). */
  matrix: Record<string, Record<string, PairResult>>;
  /** Bradley-Terry Elo per member, centered on 1500; sorted desc as `ranking`. */
  elo: Record<string, number>;
  /** Member names ordered by Elo (pool ranking), strongest first. */
  ranking: string[];
  gamesPerPair: number;
  seedsPerPair: number;
}

/**
 * Fit Bradley-Terry strengths to a pairwise win matrix by MM iteration
 * (Hunter 2004), then map to the Elo scale. `wins[i][j]` is i's fractional wins
 * over j across `n[i][j]` games. A small `prior` win/loss on every realized
 * pairing keeps a member that goes 0% (random) or 100% off ±∞ — standard BT
 * regularization.
 *
 * BT identifies only rating *differences*; the absolute level is a free constant
 * fixed by convention. Two are offered, and which one you want depends on whether
 * the numbers get published:
 *
 * - **Default (mean 1500)** — right for an ad-hoc report, where the pool *is* the
 *   frame of reference and nothing outlives the run.
 * - **`anchor`** — pins one member to a stated rating. Adding a member then can't
 *   move a rating whose pairwise results didn't change, which mean-centering does
 *   (a weak newcomer lowers the mean, so every incumbent's number rises to
 *   compensate). The committed ladder artifact uses this, because it publishes to
 *   the difficulty picker and a number that drifts for invisible reasons is worse
 *   than no number (P61).
 */
export function bradleyTerryElo(
  names: string[],
  wins: Record<string, Record<string, number>>,
  n: Record<string, Record<string, number>>,
  opts: { prior?: number; iterations?: number; anchor?: { member: string; elo: number } } = {},
): Record<string, number> {
  const { prior = 0.5, iterations = 1000, anchor } = opts;
  // An anchor naming a member that isn't in the fit would silently fall back to
  // mean-centering while the artifact still claimed to be anchored — the exact
  // "published number moved for an invisible reason" failure the anchor exists to
  // prevent. Refuse instead.
  if (anchor && !names.includes(anchor.member)) {
    throw new Error(`anchor member "${anchor.member}" is not in the pool: ${names.join(', ')}`);
  }
  const p: Record<string, number> = Object.fromEntries(names.map((name) => [name, 1]));
  // Total (regularized) wins per member — fixed across iterations.
  const W: Record<string, number> = Object.fromEntries(names.map((name) => [name, 0]));
  for (const i of names) {
    for (const j of names) {
      if (i === j || n[i]?.[j] == null) continue;
      W[i] += (wins[i]?.[j] ?? 0) + prior;
    }
  }
  for (let it = 0; it < iterations; it++) {
    const next: Record<string, number> = {};
    for (const i of names) {
      let denom = 0;
      for (const j of names) {
        if (i === j || n[i]?.[j] == null) continue;
        const games = n[i][j] + 2 * prior; // both regularization games count
        denom += games / (p[i] + p[j]);
      }
      next[i] = denom > 0 ? W[i] / denom : p[i];
    }
    // Normalize to geometric mean 1 for numerical stability.
    const logMean =
      names.reduce((a, name) => a + Math.log(next[name]), 0) / names.length;
    const g = Math.exp(logMean);
    for (const name of names) p[name] = next[name] / g;
  }
  // BT strength → Elo (400/ln10 per e-fold). The shift is the free constant above.
  const scale = 400 / Math.LN10;
  const raw = Object.fromEntries(names.map((name) => [name, scale * Math.log(p[name])]));
  const shift = anchor
    ? anchor.elo - raw[anchor.member]
    : 1500 - names.reduce((a, name) => a + raw[name], 0) / names.length;
  return Object.fromEntries(names.map((name) => [name, raw[name] + shift]));
}

/**
 * Round-robin every unordered pair of `members` and fit pool Elo. Each pair plays
 * a mirrored, seed-averaged match — the two members cycle to fill the variant's
 * seats (2 each on Classic, 1 each on Duo) — reusing `runTournament` so the
 * per-game seat rotation, tie-splitting and scoring stay identical to every other
 * arena table. Deterministic for a fixed `baseSeed`.
 */
export function runRoundRobin(
  members: PoolMember[],
  opts: {
    games?: number;
    seeds?: number;
    baseSeed?: number;
    variant?: Variant;
    mode?: GameMode;
    scoring?: ScoringVariant;
    prior?: number;
  } = {},
): RoundRobinResult {
  const { games = 100, seeds = 4, baseSeed = 1, variant = 'classic', prior = 0.5 } = opts;
  const names = members.map((m) => m.name);
  if (new Set(names).size !== names.length) {
    throw new Error('pool members must have distinct names');
  }
  const seats = VARIANTS[variant].playColors.length;
  const matrix: Record<string, Record<string, PairResult>> = Object.fromEntries(
    names.map((name) => [name, {}]),
  );
  const wins: Record<string, Record<string, number>> = Object.fromEntries(
    names.map((name) => [name, {}]),
  );
  const n: Record<string, Record<string, number>> = Object.fromEntries(
    names.map((name) => [name, {}]),
  );
  const gamesPerPair = games * seeds;

  for (let a = 0; a < members.length; a++) {
    for (let b = a + 1; b < members.length; b++) {
      const [ma, mb] = [members[a], members[b]];
      // Cycle the pair to fill the table: [a,b,a,b] on Classic, [a,b] on Duo.
      const contestants: Contestant[] = Array.from({ length: seats }, (_, k) =>
        k % 2 === 0 ? ma : mb,
      );
      const r = runTournamentSeeds(contestants, {
        games,
        seeds,
        baseSeed,
        variant,
        mode: opts.mode,
        scoring: opts.scoring,
      });
      const share = Object.fromEntries(r.rows.map((row) => [row.name, row.meanGameShare]));
      const sa = share[ma.name] ?? 0;
      const sb = share[mb.name] ?? 0;
      matrix[ma.name][mb.name] = { share: sa, wins: sa * gamesPerPair, games: gamesPerPair };
      matrix[mb.name][ma.name] = { share: sb, wins: sb * gamesPerPair, games: gamesPerPair };
      wins[ma.name][mb.name] = sa * gamesPerPair;
      wins[mb.name][ma.name] = sb * gamesPerPair;
      n[ma.name][mb.name] = gamesPerPair;
      n[mb.name][ma.name] = gamesPerPair;
    }
  }

  const elo = bradleyTerryElo(names, wins, n, { prior });
  const ranking = [...names].sort((x, y) => elo[y] - elo[x]);
  return { names, matrix, elo, ranking, gamesPerPair, seedsPerPair: seeds };
}
