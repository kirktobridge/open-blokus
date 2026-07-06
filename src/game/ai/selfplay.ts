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
import type { Color, GameState, PieceId, Placement, Rotation, ScoringVariant } from '../types';
import { createInitialState } from '../modes';
import { resolveCells } from '../pieces';
import { applyPlacement, isLegalPlacement } from '../placement';
import { generateLegalMoves } from '../moves';
import { playGame, type Strategy } from './arena';

export interface LoggedMove extends Placement {
  color: Color;
}

export interface GameRecord {
  /** RNG seed the game was played with — with `seats`, reproduces the game. */
  seed: number;
  /** Strategy name per color (provenance, e.g. "heur-e10"). */
  seats: Record<Color, string>;
  /** Every accepted move, in play order. */
  moves: LoggedMove[];
  /** Final per-color score (basic scoring: remaining squares, lower wins). */
  scores: Record<Color, number>;
  /** Winning color(s); ties keep all co-winners. */
  winners: Color[];
}

/** Play one seeded 4p game (basic scoring) and capture its record. */
export function playRecordedGame(
  byColor: Record<Color, Strategy>,
  seats: Record<Color, string>,
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
  return { seed, seats, moves, scores: result.colors, winners };
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
  scoring: ScoringVariant = 'basic',
): GameState {
  const G = createInitialState(4, scoring);
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

/** [colorIdx, pieceId, rotation, reflected(0|1), x, y] */
export type MoveTuple = [number, PieceId, Rotation, 0 | 1, number, number];

/** One JSONL line. Arrays are indexed by COLOR_ORDER position. */
export interface SerializedRecord {
  v: 1;
  seed: number;
  seats: string[];
  moves: MoveTuple[];
  scores: number[];
  winners: number[];
}

export function serializeRecord(r: GameRecord): SerializedRecord {
  return {
    v: 1,
    seed: r.seed,
    seats: COLOR_ORDER.map((c) => r.seats[c]),
    moves: r.moves.map((m) => [
      COLOR_ORDER.indexOf(m.color),
      m.pieceId,
      m.rotation,
      m.reflected ? 1 : 0,
      m.x,
      m.y,
    ]),
    scores: COLOR_ORDER.map((c) => r.scores[c]),
    winners: r.winners.map((c) => COLOR_ORDER.indexOf(c)),
  };
}

export function deserializeRecord(s: SerializedRecord): GameRecord {
  if (s.v !== 1) throw new Error(`unknown record version ${s.v}`);
  const byColor = <T>(xs: T[]): Record<Color, T> =>
    Object.fromEntries(COLOR_ORDER.map((c, i) => [c, xs[i]])) as Record<Color, T>;
  return {
    seed: s.seed,
    seats: byColor(s.seats),
    moves: s.moves.map(([ci, pieceId, rotation, refl, x, y]) => ({
      color: COLOR_ORDER[ci],
      pieceId,
      rotation,
      reflected: refl === 1,
      x,
      y,
    })),
    scores: byColor(s.scores),
    winners: s.winners.map((i) => COLOR_ORDER[i]),
  };
}
