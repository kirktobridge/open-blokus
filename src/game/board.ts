import { BOARD_SIZE } from '../shared/constants';
import type { Cell } from './types';

export { BOARD_SIZE };

/** Flat-array index for a cell. Index = y * BOARD_SIZE + x. */
export const idx = (x: number, y: number): number => y * BOARD_SIZE + x;

/** Inverse of idx(): flat index → cell. */
export const xy = (i: number): Cell => ({ x: i % BOARD_SIZE, y: Math.floor(i / BOARD_SIZE) });

/** True if (x, y) is on the board. */
export const inBounds = (x: number, y: number): boolean =>
  x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

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
