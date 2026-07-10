/**
 * Daily puzzle — seeded contested solitaire (product P14 M1).
 *
 * The same seed for everyone on a given calendar day seeds a short opening
 * (a fresh 4-player game self-played a few plies by the shipped heuristic), then
 * hands one color to the player. Unlike a static packing puzzle, the opponents
 * keep playing: after each of the player's placements the other three colors each
 * answer with a heuristic move (see `advanceOpponents`), contesting corners and
 * lanes the way a real game does. The player fits as many of their color's pieces
 * as they can; score = squares they place (a personal best), so the number is
 * theirs regardless of who wins.
 *
 * Pure module — no React, no boardgame.io, no I/O. Everything is a deterministic
 * function of the date key + the rng passed in, so a day is regenerable/replayable.
 */
import { BOARD_SIZE } from '../../shared/constants';
import type { Color, GameState } from '../types';
import { COLOR_ORDER } from '../types';
import { createInitialState } from '../modes';
import { resolveCells } from '../pieces';
import { applyPlacement } from '../placement';
import { remainingSquares } from '../scoring';
import { heuristicStrategy, mulberry32 } from '../ai/arena';

/**
 * Plies of heuristic self-play before handoff (4 colors × ~2 pieces). Just enough
 * to make each day's opening distinct — the bulk of the game is then played live
 * under contest, so the player builds their own color rather than inheriting a
 * near-finished one. Tunable; M1 isn't difficulty-graded (that's a later milestone).
 */
export const PUZZLE_SETUP_PLIES = 8;

/** Heuristic policy the contesting opponents play (deterministic given its rng). */
const opponentStrategy = heuristicStrategy();

/** The color handed to the player. Blue opens, so its corner sits top-left. */
export const PUZZLE_COLOR: Color = 'blue';

export interface DailyPuzzle {
  /** Calendar day this puzzle belongs to, `YYYY-MM-DD`. */
  dateKey: string;
  /** 32-bit seed derived from `dateKey` — reproduces the self-play. */
  seed: number;
  /** The color the player continues solo. */
  playerColor: Color;
  /** Mid-game position at handoff; `activeColorIndex` points at `playerColor`. */
  state: GameState;
  /** Player-color squares still unplaced at handoff — the score ceiling. */
  ceiling: number;
}

/** Local calendar date as `YYYY-MM-DD` — the key for that day's puzzle. */
export function dailyDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Deterministic 32-bit seed from a date key (FNV-1a). */
export function seedFromDateKey(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build the puzzle for `dateKey` (defaults to today). Deterministic: the same key
 * always yields the same position. Self-plays all four colors with the heuristic,
 * then leaves `activeColorIndex` on `PUZZLE_COLOR` for the player to take over.
 */
export function generateDailyPuzzle(dateKey: string = dailyDateKey()): DailyPuzzle {
  const seed = seedFromDateKey(dateKey);
  const rng = mulberry32(seed);
  const play = heuristicStrategy();

  const state = createInitialState(4, 'basic');
  for (let ply = 0; ply < PUZZLE_SETUP_PLIES; ply++) {
    const color = COLOR_ORDER[state.activeColorIndex];
    const move = play(state, color, rng);
    // No color is stuck this early; if one ever were, skip its turn rather than end.
    if (move) applyPlacement(state, color, move.pieceId, resolveCells(move));
    state.activeColorIndex = (state.activeColorIndex + 1) % COLOR_ORDER.length;
  }

  // Hand the puzzle to the player's color and keep the turn pointed at it.
  state.activeColorIndex = COLOR_ORDER.indexOf(PUZZLE_COLOR);
  state.lastMove = [];

  return {
    dateKey,
    seed,
    playerColor: PUZZLE_COLOR,
    state,
    ceiling: remainingSquares(state.colors[PUZZLE_COLOR]),
  };
}

/**
 * Let each opponent color answer the player's last move, in turn order after
 * `playerColor`, one heuristic placement each (a color with no legal move is
 * skipped). Mutates `state` and returns the board indices the opponents filled —
 * the caller highlights them as "their replies." Deterministic given `rng`, so a
 * daily replays identically for a player who repeats their moves.
 */
export function advanceOpponents(
  state: GameState,
  playerColor: Color,
  rng: () => number,
): number[] {
  const start = COLOR_ORDER.indexOf(playerColor);
  const changed: number[] = [];
  for (let step = 1; step < COLOR_ORDER.length; step++) {
    const color = COLOR_ORDER[(start + step) % COLOR_ORDER.length];
    const move = opponentStrategy(state, color, rng);
    if (!move) continue;
    const cells = resolveCells(move);
    applyPlacement(state, color, move.pieceId, cells);
    for (const c of cells) changed.push(c.y * BOARD_SIZE + c.x);
  }
  return changed;
}

/** Squares the player has fit since handoff = ceiling − current remaining. */
export function cellsPlaced(puzzle: DailyPuzzle, current: GameState): number {
  return puzzle.ceiling - remainingSquares(current.colors[puzzle.playerColor]);
}

/** Pieces the player has fit since handoff. */
export function piecesPlaced(puzzle: DailyPuzzle, current: GameState): number {
  const before = puzzle.state.colors[puzzle.playerColor].remaining.length;
  return before - current.colors[puzzle.playerColor].remaining.length;
}

/**
 * Plain-text share blurb for a finished puzzle (M1). The Wordle-style emoji grid
 * is a separate feature (P26) that will slot in above this caption once shipped.
 */
export function dailyShareText(dateKey: string, cells: number, pieces: number): string {
  return `OpenBlokus Daily ${dateKey}\nFit ${cells} squares · ${pieces} pieces`;
}
