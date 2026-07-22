import { BOARD_SIZE } from '../shared/constants';
import type { Cell } from './types';

export { BOARD_SIZE };

/**
 * Flat-array index for a cell. Index = y * size + x.
 *
 * `size` is **required**: it defaulted to Classic until P20 M2b, and a Duo-aware
 * caller that omitted it indexed a 196-cell board as if it were 400 — reading
 * `undefined`, which `!== null`, so out-of-range cells reported as *occupied*.
 * Nothing goes red for that; making the argument mandatory is what makes it
 * impossible. Pass `boardSizeOf(G)`.
 */
export const idx = (x: number, y: number, size: number): number => y * size + x;

/** Inverse of idx(): flat index → cell. `size` is required, as for `idx`. */
export const xy = (i: number, size: number): Cell => ({
  x: i % size,
  y: Math.floor(i / size),
});

/** True if (x, y) is on the board. `size` is required, as for `idx`. */
export const inBounds = (x: number, y: number, size: number): boolean =>
  x >= 0 && x < size && y >= 0 && y < size;

/** The four edge-sharing (orthogonal) neighbors of a cell. */
export const orthoNeighbors = ({ x, y }: Cell): Cell[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

/** The four corner-sharing (diagonal) neighbors of a cell. */
export const diagNeighbors = ({ x, y }: Cell): Cell[] => [
  { x: x + 1, y: y + 1 },
  { x: x + 1, y: y - 1 },
  { x: x - 1, y: y + 1 },
  { x: x - 1, y: y - 1 },
];
