/**
 * Daily puzzle — seeded solitaire (product P14 M1).
 *
 * The same seed for everyone on a given calendar day produces the same mid-game
 * position: a fresh 4-player game self-played a fixed number of plies by the
 * shipped heuristic, then handed to the player as one color. The player fits as
 * many of that color's remaining pieces as they can; score = squares placed.
 *
 * Pure module — no React, no boardgame.io, no I/O. Everything is a deterministic
 * function of the date key, so any day's puzzle is regenerable from its string.
 */
import type { Color, GameState } from '../types';
import { COLOR_ORDER } from '../types';
import { createInitialState } from '../modes';
import { resolveCells } from '../pieces';
import { applyPlacement } from '../placement';
import { remainingSquares } from '../scoring';
import { heuristicStrategy, mulberry32 } from '../ai/arena';

/**
 * Plies of heuristic self-play before handoff (4 colors × ~5 pieces). Enough to
 * crowd the board into a real puzzle while leaving the player a full-ish hand.
 * Tunable — the M1 puzzle isn't difficulty-graded (that's a later milestone).
 */
export const PUZZLE_SETUP_PLIES = 20;

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
