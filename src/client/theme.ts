import type { Color } from '../game/types';

/** Display colors for each Blokus color. */
export const COLOR_HEX: Record<Color, string> = {
  blue: '#2563eb',
  yellow: '#eab308',
  red: '#dc2626',
  green: '#16a34a',
};

// Neutral UI surfaces resolve from CSS vars (see theme.css) so dark mode flips
// them without re-render. Piece colors above stay identical across schemes.
export const EMPTY_CELL = 'var(--empty-cell)';
export const GRID_LINE = 'var(--grid-line)';
export const PLACED_PIECE = 'var(--placed-piece)';

/** Board cell size in pixels. */
export const CELL_PX = 24;
/** Piece-thumbnail square size in pixels. */
export const THUMB_PX = 12;
