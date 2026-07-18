import type { CSSProperties } from 'react';
import type { Color } from '../game/types';

/** CSS custom property holding each Blokus color — a token like any other, so a
 *  theme (built-in or user fork) owns the piece colors too. The classic hexes
 *  live in theme.css (every built-in seeds the same ones); nothing duplicates
 *  them here. */
export const PIECE_TOKEN: Record<Color, string> = {
  blue: '--piece-blue',
  yellow: '--piece-yellow',
  red: '--piece-red',
  green: '--piece-green',
};

/** How every piece is painted: `var(--piece-blue)` &c. Drop-in for a hex. */
export const PIECE_VAR: Record<Color, string> = {
  blue: 'var(--piece-blue)',
  yellow: 'var(--piece-yellow)',
  red: 'var(--piece-red)',
  green: 'var(--piece-green)',
};

// Neutral UI surfaces resolve from CSS vars (see theme.css) so dark mode flips
// them without re-render.
export const EMPTY_CELL = 'var(--empty-cell)';
export const GRID_LINE = 'var(--grid-line)';
export const PLACED_PIECE = 'var(--placed-piece)';

/** Board cell size in pixels. */
export const CELL_PX = 30;
/** Piece-thumbnail square size in pixels. */
export const THUMB_PX = 12;

/**
 * Width of the center "board dock" column. In play the action bar (`Controls`) is
 * wider than the board, so the column is wider than the frame and the flanking
 * columns (player cards, right rail) sit out to clear it. The review table pins
 * its board column to the same value so those side columns — and the board — land
 * in the exact same place in play and review (the board is centered within it in
 * both). Widest under-board element must fit here; it overhangs symmetrically if
 * not, so a small mismatch never shifts the side columns.
 */
export const DOCK_COLUMN_W = 736;

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

/** Resting card surface — panel fill, hairline border, soft (non-modal) lift.
 *  The lift is a token (`--pnl-shadow` + `--pnl-inset`) so dark mode can carry a
 *  heavier shadow that actually reads on the lamplight ground (P28). */
export const PANEL: CSSProperties = {
  background: 'var(--pnl)',
  color: 'var(--ink)',
  border: '1px solid var(--pnl-bd)',
  borderRadius: 14,
  boxShadow: 'var(--pnl-shadow), var(--pnl-inset)',
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

/** Ghost button — the third tier below SECONDARY, for demoted actions (Customize,
 *  tutorial link, Refresh, Join-by-ID) so the page carries exactly one primary and
 *  a clear step-down of emphasis (P28). No fill or border; reads as a text action. */
export const GHOST_BTN: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: '6px 8px',
  fontFamily: FONT_UI,
  fontWeight: 600,
  fontSize: 13.5,
  color: 'var(--mut)',
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
