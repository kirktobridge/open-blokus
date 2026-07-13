import type { CSSProperties } from 'react';
import type { Color, PieceId } from '../../game/types';
import { PIECES } from '../../game/pieces';
import { PIECE_VAR, THUMB_PX } from '../theme';

/** Dashed outline used for a placed (spent) piece, per the study-table design. */
const PLACED_DASH = '#c8b997';
/** Beveled-plastic finish for an available hand piece cell. */
const CELL_BEVEL =
  'inset 0 1px 0 rgba(255,255,255,.4), inset 0 -1px 0 rgba(0,0,0,.28), 0 1px 1px rgba(0,0,0,.3)';

/**
 * A small static rendering of a piece's base shape.
 *
 * `hand` (default) is the interactive tray piece: filled + beveled when
 * available, a dashed ghost when placed, a recessed ring when selected.
 * `micro` is the tiny, non-interactive opponent-inventory silhouette. Micro
 * thumbs are decorative, so they omit the `piece-<color>-<id>` test id to avoid
 * colliding with the interactive hand (which owns those ids).
 */
export function PieceThumb({
  pieceId,
  color,
  placed,
  selected = false,
  onClick,
  cellPx = THUMB_PX,
  micro = false,
}: {
  pieceId: PieceId;
  color: Color;
  placed: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Square size in px per cell. */
  cellPx?: number;
  /** Tiny decorative variant (opponent inventory): no test id, thinner styling. */
  micro?: boolean;
}) {
  const cells = PIECES[pieceId];
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  const filled = new Set(cells.map((c) => `${c.x},${c.y}`));

  const squares = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = filled.has(`${x},${y}`);
      let cellStyle: CSSProperties = {
        width: cellPx,
        height: cellPx,
        boxSizing: 'border-box',
      };
      if (on) {
        if (placed) {
          cellStyle = {
            ...cellStyle,
            background: 'transparent',
            border: `${micro ? 1 : 1.5}px dashed ${PLACED_DASH}`,
            borderRadius: 2,
          };
        } else if (micro) {
          cellStyle = {
            ...cellStyle,
            background: PIECE_VAR[color],
            border: '1px solid rgba(0,0,0,.32)',
          };
        } else {
          cellStyle = {
            ...cellStyle,
            background: PIECE_VAR[color],
            borderRadius: 2,
            boxShadow: CELL_BEVEL,
          };
        }
      } else {
        cellStyle.background = 'transparent';
      }
      squares.push(<div key={`${x},${y}`} style={cellStyle} />);
    }
  }

  return (
    <div
      title={micro ? undefined : pieceId}
      data-testid={micro ? undefined : `piece-${color}-${pieceId}`}
      data-placed={placed}
      role={onClick ? 'button' : undefined}
      aria-label={
        micro ? undefined : `${color} piece ${pieceId}${placed ? ' (placed)' : ''}${selected ? ' (selected)' : ''}`
      }
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${w}, ${cellPx}px)`,
        gap: micro ? 0 : 1,
        opacity: placed ? (micro ? 0.75 : 0.8) : 1,
        cursor: onClick ? 'pointer' : 'default',
        padding: micro ? 0 : 3,
        borderRadius: 6,
        background: selected ? 'var(--well)' : 'transparent',
        boxShadow: selected ? 'inset 0 1px 3px rgba(0,0,0,.25), 0 0 0 2px #3468cf' : 'none',
      }}
    >
      {squares}
    </div>
  );
}
