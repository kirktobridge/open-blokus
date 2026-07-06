import type { CSSProperties } from 'react';
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
export const CELL_PX = 30;
/** Piece-thumbnail square size in pixels. */
export const THUMB_PX = 12;

/** Study-table typography. Resolved from CSS vars (theme.css) so the Settings
 *  panel can retune them live via a token override with no re-render. */
export const FONT_UI = 'var(--font-ui)';
export const FONT_MONO = 'var(--font-mono)';

/** The warm-take piece hexes the redesign renders with; a slightly warmer Classic. */
export const WARM_BLUE = '#3468cf';

/** Warm pill styling for docked (top-bar) chip triggers. */
export const DOCK_CHIP: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: 12.5,
  fontWeight: 500,
  border: '1px solid var(--top-bd)',
  background: 'var(--top-bg)',
  color: 'var(--top-ink)',
  borderRadius: 999,
  padding: '6px 13px',
  cursor: 'pointer',
};

/** Square-ish variant of DOCK_CHIP for icon-only triggers. */
export const ICON_CHIP: CSSProperties = {
  ...DOCK_CHIP,
  padding: '7px 9px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Plain (non-docked) icon button, for floating triggers on other screens. */
export const ICON_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '5px 7px',
  cursor: 'pointer',
};
