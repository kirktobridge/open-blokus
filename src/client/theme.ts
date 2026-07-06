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

/* Study-table surface recipes shared by the home screen (and reusable by any
 * resting panel). Same token vocabulary as the game screen — `--pnl` card on the
 * `--table-bg` backdrop, `--well` inset rows, `WARM_BLUE` primary — so the lobby
 * reads as the same room as the board. GameOverModal keeps its heavier modal
 * shadow (it's an overlay dialog); these are for in-flow cards. */

/** Resting card surface — panel fill, hairline border, soft (non-modal) lift. */
export const PANEL: CSSProperties = {
  background: 'var(--pnl)',
  color: 'var(--ink)',
  border: '1px solid var(--pnl-bd)',
  borderRadius: 14,
  boxShadow: '0 10px 28px rgba(15, 9, 3, 0.18)',
  fontFamily: FONT_UI,
};

/** Primary call-to-action pill (warm blue), matching the ActionDock PLAY MOVE. */
export const PRIMARY_BTN: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '11px 20px',
  fontFamily: FONT_UI,
  fontWeight: 700,
  fontSize: 15,
  background: WARM_BLUE,
  color: '#fff',
  cursor: 'pointer',
};

/** Secondary button — well fill inside the panel border. */
export const SECONDARY_BTN: CSSProperties = {
  borderRadius: 10,
  padding: '9px 16px',
  fontFamily: FONT_UI,
  fontWeight: 600,
  border: '1px solid var(--pnl-bd)',
  background: 'var(--well)',
  color: 'var(--ink)',
  cursor: 'pointer',
};

/** Styled native control (select / text input) that reads on the panel. */
export const FIELD: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: 14,
  color: 'var(--ink)',
  background: 'var(--pnl)',
  border: '1px solid var(--pnl-bd)',
  borderRadius: 8,
  padding: '6px 9px',
  cursor: 'pointer',
};

/** Inset row inside a panel — the `--well` chip used for list/config rows. */
export const WELL_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  background: 'var(--well)',
  borderRadius: 8,
  padding: '8px 11px',
};
