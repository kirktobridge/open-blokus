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
import { colorStateOf, createInitialState } from '../modes';
import { resolveCells } from '../pieces';
import { applyPlacement } from '../placement';
import { remainingSquares } from '../scoring';
import { emojiBoard } from '../share';
import { heuristicStrategy, mulberry32 } from '../ai/arena';

/**
 * Plies of heuristic self-play before handoff (4 colors × ~11 pieces). A deep
 * mid-game: corners and lanes are largely committed, so the player inherits a
 * crowded board and squeezes their remaining pieces into the gaps under live
 * contest. Tunable; M1 isn't difficulty-graded (that's a later milestone).
 */
export const PUZZLE_SETUP_PLIES = 44;

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
    ceiling: remainingSquares(colorStateOf(state, PUZZLE_COLOR)),
  };
}

/** The opponents, in the turn order they answer after `playerColor`. */
export function opponentOrder(playerColor: Color): Color[] {
  const start = COLOR_ORDER.indexOf(playerColor);
  const order: Color[] = [];
  for (let step = 1; step < COLOR_ORDER.length; step++) {
    order.push(COLOR_ORDER[(start + step) % COLOR_ORDER.length]);
  }
  return order;
}

/**
 * Play one heuristic placement for `color` (no-op if it has no legal move).
 * Mutates `state`; returns the board indices it filled — the caller highlights
 * them as "their reply." Deterministic given `rng`. Splitting one opponent per
 * call lets the UI reveal replies one at a time (paced) while the rng stream
 * stays identical to answering them all at once (`advanceOpponents`).
 */
export function stepOpponent(state: GameState, color: Color, rng: () => number): number[] {
  const move = opponentStrategy(state, color, rng);
  if (!move) return [];
  const cells = resolveCells(move);
  applyPlacement(state, color, move.pieceId, cells);
  return cells.map((c) => c.y * BOARD_SIZE + c.x);
}

/**
 * Let each opponent color answer the player's last move, in turn order after
 * `playerColor`, one heuristic placement each. Mutates `state` and returns all
 * the board indices the opponents filled. Deterministic given `rng`, so a daily
 * replays identically for a player who repeats their moves.
 */
export function advanceOpponents(
  state: GameState,
  playerColor: Color,
  rng: () => number,
): number[] {
  const changed: number[] = [];
  for (const color of opponentOrder(playerColor)) {
    changed.push(...stepOpponent(state, color, rng));
  }
  return changed;
}

/** Squares the player has fit since handoff = ceiling − current remaining. */
export function cellsPlaced(puzzle: DailyPuzzle, current: GameState): number {
  return puzzle.ceiling - remainingSquares(colorStateOf(current, puzzle.playerColor));
}

/** Pieces the player has fit since handoff. */
export function piecesPlaced(puzzle: DailyPuzzle, current: GameState): number {
  const before = colorStateOf(puzzle.state, puzzle.playerColor).remaining.length;
  return before - colorStateOf(current, puzzle.playerColor).remaining.length;
}

/**
 * Share blurb for a finished puzzle: caption lines, then the contested board as
 * the Wordle-style emoji grid (P26) — the same renderer the game-over summary uses.
 */
export function dailyShareText(
  dateKey: string,
  cells: number,
  pieces: number,
  current: GameState,
): string {
  return `OpenBlokus Daily ${dateKey}\nFit ${cells} squares · ${pieces} pieces\n\n${emojiBoard(current)}`;
}
