/**
 * Self-play game records — training data for AE4 (learned eval).
 *
 * A GameRecord is one arena game as its move list + outcome. Records are tiny
 * (~70 moves/game), so datasets store cheaply, and *any* position is
 * regenerable by replaying the moves through the rules core. Pure module: no
 * React, no boardgame.io, no I/O — the dump CLI lives in
 * scripts/selfplay-dump.ts.
 */
import { COLOR_ORDER } from '../types';
import type {
  ByColor,
  Color,
  GameMode,
  GameState,
  PieceId,
  Placement,
  Rotation,
  ScoringVariant,
  Variant,
} from '../types';
import { VARIANTS, createInitialState } from '../modes';
import { resolveCells } from '../pieces';
import { applyPlacement, isLegalPlacement } from '../placement';
import { generateLegalMoves } from '../moves';
import { playGame, type Strategy } from './arena';

export interface LoggedMove extends Placement {
  color: Color;
}

/**
 * Optional provenance for records captured from real app games (vs. self-play).
 * Ignored by replay — pure metadata for browsing/filtering the log.
 */
export interface RecordMeta {
  /** Where the record came from, e.g. "vs-ai". Self-play omits this. */
  src?: string;
  /** Wall-clock ms when the game ended (Date.now()). */
  endedAt?: number;
}

export interface GameRecord {
  /** RNG seed the game was played with — with `seats`, reproduces a self-play
   * game. App-captured games set 0 (the move list is the source of truth). */
  seed: number;
  /** Player mode (2/3/4). The move list alone is mode-agnostic; replay needs it. */
  mode: GameMode;
  /** Scoring variant the game was played under. */
  scoring: ScoringVariant;
  /**
   * Which rule set the game was played under. Required, not optional: `mode: 2`
   * already means Classic-two-humans, so without this a Duo record is
   * indistinguishable from a Classic one and replays onto the wrong board.
   */
  variant: Variant;
  /** Strategy/owner label per color (provenance, e.g. "heur-e10", "human", "hard"). */
  seats: ByColor<string>;
  /** Every accepted move, in play order. */
  moves: LoggedMove[];
  /** Final per-color score (basic scoring: remaining squares, lower wins). */
  scores: ByColor<number>;
  /** Winning color(s); ties keep all co-winners. */
  winners: Color[];
  /** Optional app-capture provenance; absent for self-play records. */
  meta?: RecordMeta;
}

/** Play one seeded 4p game (basic scoring) and capture its record. */
export function playRecordedGame(
  byColor: ByColor<Strategy>,
  seats: ByColor<string>,
  seed: number,
  rng: () => number,
): GameRecord {
  const moves: LoggedMove[] = [];
  const result = playGame(byColor, {
    rng,
    onMove: (color, move) => moves.push({ color, ...move }),
  });
  // 4p: winner playerIDs equal the color's turn-order index (arena seatPosOf).
  const winners = COLOR_ORDER.filter((c) =>
    result.winners.includes(String(COLOR_ORDER.indexOf(c))),
  );
  return { seed, mode: 4, scoring: 'basic', variant: 'classic', seats, moves, scores: result.colors, winners };
}

/**
 * Replay a move list through the rules core, validating every move. Calls
 * `onPosition` with the state *before* each move (that's the training sample:
 * position → eventual outcome). Returns the final state. Throws on an illegal
 * move — a corrupt record must never silently produce training data.
 */
export function replayGame(
  moves: LoggedMove[],
  onPosition?: (G: GameState, next: LoggedMove, ply: number) => void,
  mode: GameMode = 4,
  scoring: ScoringVariant = 'basic',
  variant: Variant = 'classic',
): GameState {
  const G = createInitialState(mode, scoring, variant);
  moves.forEach((m, ply) => {
    const cells = resolveCells(m);
    if (!isLegalPlacement(G, m.color, m.pieceId, cells)) {
      throw new Error(
        `illegal replayed move at ply ${ply}: ${m.color} ${m.pieceId} r${m.rotation}${m.reflected ? 'f' : ''} @(${m.x},${m.y})`,
      );
    }
    onPosition?.(G, m, ply);
    applyPlacement(G, m.color, m.pieceId, cells);
  });
  return G;
}

/**
 * With probability `eps`, play a uniformly random legal move instead of the
 * base strategy — exploration noise so self-play games don't collapse onto a
 * few near-deterministic lines.
 */
export function epsilonStrategy(base: Strategy, eps: number): Strategy {
  return (G, color, rng) => {
    if (rng() < eps) {
      const moves = generateLegalMoves(G, color);
      return moves.length ? moves[Math.floor(rng() * moves.length)] : null;
    }
    return base(G, color, rng);
  };
}

// --- JSONL serialization ----------------------------------------------------

/** [colorIdx, pieceId, rotation, reflected(0|1), x, y] — colorIdx indexes the
 * record's variant play-color list (`VARIANTS[variant].playColors`). */
export type MoveTuple = [number, PieceId, Rotation, 0 | 1, number, number];

/**
 * One JSONL line. Arrays are indexed by the variant's play-color position — for
 * Classic that is COLOR_ORDER, so v3 Classic lines are byte-identical to v2.
 *
 * v1 (legacy self-play dumps) has no `mode`/`scoring`/`meta` — those games are
 * all 4-player basic, so deserialize fills those defaults. v2 carries the game
 * header (mode + scoring), letting one format hold self-play *and* real app
 * games (2/3/4-player, either scoring). v3 adds `variant`: v1/v2 read as
 * `classic`, which they all are by construction.
 */
export interface SerializedRecord {
  v: 1 | 2 | 3;
  seed: number;
  /** v2+ only; v1 implies 4. */
  mode?: GameMode;
  /** v2+ only; v1 implies 'basic'. */
  scoring?: ScoringVariant;
  /** v3 only; v1/v2 imply 'classic'. */
  variant?: Variant;
  seats: string[];
  moves: MoveTuple[];
  scores: number[];
  winners: number[];
  /** v2 only; app-capture provenance. */
  meta?: RecordMeta;
}

export function serializeRecord(r: GameRecord): SerializedRecord {
  const play = VARIANTS[r.variant].playColors;
  return {
    v: 3,
    seed: r.seed,
    mode: r.mode,
    scoring: r.scoring,
    variant: r.variant,
    seats: play.map((c) => r.seats[c] ?? ''),
    moves: r.moves.map((m) => [
      play.indexOf(m.color),
      m.pieceId,
      m.rotation,
      m.reflected ? 1 : 0,
      m.x,
      m.y,
    ]),
    scores: play.map((c) => r.scores[c] ?? 0),
    winners: r.winners.map((c) => play.indexOf(c)),
    ...(r.meta ? { meta: r.meta } : {}),
  };
}

export function deserializeRecord(s: SerializedRecord): GameRecord {
  if (s.v !== 1 && s.v !== 2 && s.v !== 3) throw new Error(`unknown record version ${s.v}`);
  const variant: Variant = s.variant ?? 'classic';
  const play = VARIANTS[variant].playColors;
  const byColor = <T>(xs: T[]): ByColor<T> =>
    Object.fromEntries(play.map((c, i) => [c, xs[i]])) as ByColor<T>;
  return {
    seed: s.seed,
    mode: s.mode ?? 4,
    scoring: s.scoring ?? 'basic',
    variant,
    seats: byColor(s.seats),
    moves: s.moves.map(([ci, pieceId, rotation, refl, x, y]) => ({
      color: play[ci],
      pieceId,
      rotation,
      reflected: refl === 1,
      x,
      y,
    })),
    scores: byColor(s.scores),
    winners: s.winners.map((i) => play[i]),
    ...(s.meta ? { meta: s.meta } : {}),
  };
}
