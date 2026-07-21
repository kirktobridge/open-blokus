import { BOARD_SIZE } from '../shared/constants';
import type { Cell } from './types';

export { BOARD_SIZE };

/**
 * Flat-array index for a cell. Index = y * size + x.
 *
 * `size` defaults to Classic so the ~70 existing Classic-only call sites stay
 * unchanged; variant-aware callers (the rules core) pass `boardSizeOf(G)`.
 */
export const idx = (x: number, y: number, size: number = BOARD_SIZE): number => y * size + x;

/** Inverse of idx(): flat index → cell. */
export const xy = (i: number, size: number = BOARD_SIZE): Cell => ({
  x: i % size,
  y: Math.floor(i / size),
});

/** True if (x, y) is on the board. */
export const inBounds = (x: number, y: number, size: number = BOARD_SIZE): boolean =>
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
