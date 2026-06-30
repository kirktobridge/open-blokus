import type { Color } from '../game/types';

/** Display colors for each Blokus color. */
export const COLOR_HEX: Record<Color, string> = {
  blue: '#2563eb',
  yellow: '#eab308',
  red: '#dc2626',
  green: '#16a34a',
};

export const EMPTY_CELL = '#f3f4f6';
export const GRID_LINE = '#d1d5db';
export const PLACED_PIECE = '#e5e7eb';

/** Board cell size in pixels. */
export const CELL_PX = 24;
/** Piece-thumbnail square size in pixels. */
export const THUMB_PX = 12;
