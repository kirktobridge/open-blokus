import type { Color, PieceId } from '../../game/types';
import { PIECES } from '../../game/pieces';
import { PLACED_PIECE, THUMB_PX } from '../theme';
import type { PaletteColors } from '../palettes';

/** A small static rendering of a piece's base shape. Dimmed when placed. */
export function PieceThumb({
  pieceId,
  color,
  colors,
  placed,
  selected = false,
  onClick,
}: {
  pieceId: PieceId;
  color: Color;
  colors: PaletteColors;
  placed: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const cells = PIECES[pieceId];
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  const filled = new Set(cells.map((c) => `${c.x},${c.y}`));

  const squares = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = filled.has(`${x},${y}`);
      squares.push(
        <div
          key={`${x},${y}`}
          style={{
            width: THUMB_PX,
            height: THUMB_PX,
            background: on ? (placed ? PLACED_PIECE : colors[color]) : 'transparent',
            border: on ? '1px solid var(--cell-outline)' : 'none',
            boxSizing: 'border-box',
          }}
        />,
      );
    }
  }

  return (
    <div
      title={pieceId}
      data-testid={`piece-${color}-${pieceId}`}
      data-placed={placed}
      role={onClick ? 'button' : undefined}
      aria-label={`${color} piece ${pieceId}${placed ? ' (placed)' : ''}${selected ? ' (selected)' : ''}`}
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${w}, ${THUMB_PX}px)`,
        opacity: placed ? 0.4 : 1,
        cursor: onClick ? 'pointer' : 'default',
        outline: selected ? '2px solid var(--outline-strong)' : 'none',
        outlineOffset: 2,
        padding: 2,
      }}
    >
      {squares}
    </div>
  );
}
