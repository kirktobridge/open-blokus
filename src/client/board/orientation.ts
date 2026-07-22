import type { ByColor, Color } from '../../game/types';
import { ALL_COLORS } from '../../shared/constants';

/**
 * Clockwise quarter-turns that bring each color's home corner to the bottom-right
 * of the board view. The play screen orients to the local seat's color with this
 * (BlokusBoardView), and the post-game replay scrubber reuses it so a reviewed
 * game shows in the same orientation the player actually saw.
 */
export const TURNS_TO_BOTTOM_RIGHT: Record<Color, number> = {
  blue: 2,
  yellow: 1,
  red: 0,
  green: 3,
  // Duo's start cells are interior, so "home corner" is really "home half": black
  // starts upper-left of centre (like blue), white lower-right (like red).
  black: 2,
  white: 0,
};

/**
 * The color the local human played, read from a record's seat labels ("human"),
 * or undefined for an all-AI watch game (no human seat → no preferred orientation).
 * Picks the first human color if several are flagged (hot-seat / multi-color seats).
 *
 * Reads `ALL_COLORS` — every color any variant deals — rather than a variant's play
 * order, because a record's seat labels are all it has to go on: the variant isn't a
 * parameter here, and a Duo record's `black` seat must resolve as readily as a
 * Classic `blue` one.
 */
export function humanColor(seats: ByColor<string>): Color | undefined {
  return ALL_COLORS.find((c) => seats[c] === 'human');
}

/**
 * View orientation (P49) is a *coordinate* fact, not a CSS transform: the grid and
 * its frame always sit upright, and only the board's contents are re-indexed into
 * screen space. That keeps one pointer space — a click lands on the cell it looks
 * like it lands on, with no rotated hit-testing — and lets every grid-riding
 * overlay stay in board coordinates. The spin the rotate button plays is a
 * transient on top of this, not the thing that holds the orientation.
 *
 * `turns` counts clockwise quarter-turns of the contents; it is normalized here,
 * so callers may keep an unbounded, always-increasing count.
 */
export const normTurns = (turns: number): number => ((turns % 4) + 4) % 4;

/** Board cell → the screen cell it is drawn at. */
export function toScreenXY(x: number, y: number, turns: number, size: number): [number, number] {
  const n = size - 1;
  switch (normTurns(turns)) {
    case 1:
      return [n - y, x];
    case 2:
      return [n - x, n - y];
    case 3:
      return [y, n - x];
    default:
      return [x, y];
  }
}

/** Screen cell → the board cell drawn there. Inverse of {@link toScreenXY}. */
export function toBoardXY(sx: number, sy: number, turns: number, size: number): [number, number] {
  const n = size - 1;
  switch (normTurns(turns)) {
    case 1:
      return [sy, n - sx];
    case 2:
      return [n - sx, n - sy];
    case 3:
      return [n - sy, sx];
    default:
      return [sx, sy];
  }
}

/** Board index → screen index, for the layers that position by index. */
export function toScreenIndex(i: number, turns: number, size: number): number {
  const [sx, sy] = toScreenXY(i % size, Math.floor(i / size), turns, size);
  return sy * size + sx;
}

/** Re-index a board array into screen space (`out[screenIdx] = board[boardIdx]`). */
export function toScreenBoard<T>(board: T[], turns: number, size: number): T[] {
  if (normTurns(turns) === 0) return board;
  const out = new Array<T>(board.length);
  for (let i = 0; i < board.length; i++) out[toScreenIndex(i, turns, size)] = board[i];
  return out;
}
