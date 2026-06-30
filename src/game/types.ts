import { COLORS } from '../shared/constants';

/** One of the four Blokus colors. The array order is the canonical turn order. */
export type Color = (typeof COLORS)[number];

/** Canonical color / turn order: blue → yellow → red → green. */
export const COLOR_ORDER: readonly Color[] = COLORS;

/**
 * All 21 piece identifiers, grouped by size (1, 2, 3, 4, 5 squares).
 * See GAME_SPEC §2 for the shapes.
 */
export const PIECE_IDS = [
  'I1',
  'I2',
  'I3', 'V3',
  'I4', 'O4', 'T4', 'L4', 'S4',
  'F5', 'I5', 'L5', 'N5', 'P5', 'T5', 'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5',
] as const;

export type PieceId = (typeof PIECE_IDS)[number];

/** A board cell / piece-square coordinate. x = column (0..19), y = row (0..19). */
export interface Cell {
  x: number;
  y: number;
}

/** Number of 90° clockwise rotations applied to a piece. */
export type Rotation = 0 | 1 | 2 | 3;

/**
 * A concrete placement request. The engine resolves this to absolute board cells
 * via resolveCells() — clients never send raw cell lists (anti-cheat, see ARCHITECTURE §5).
 */
export interface Placement {
  pieceId: PieceId;
  rotation: Rotation;
  /** Mirror the piece (across the vertical axis) before rotating. */
  reflected: boolean;
  /** Translation applied to the normalized, oriented piece. */
  x: number;
  y: number;
}
