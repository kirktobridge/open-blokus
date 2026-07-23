import type { CSSProperties } from 'react';
import type { Color, PieceId } from '../../game/types';
import { PIECES } from '../../game/pieces';
import { PIECE_VAR, THUMB_PX, TILE_FINISH, tileVar, type TileFinish } from '../theme';

/** Dashed outline for a placed (spent) piece — the themed ghost line (`--placed-piece`)
 *  so it reads on any mat, per the study-table design. */
const PLACED_DASH = 'var(--placed-piece)';

/**
 * Molded-tile finish for an available hand piece cell — the tray-scale echo of
 * PlacedLayer's board finish (frame bevel light top-left / dark bottom-right, a
 * contact shadow, a top-left glint). Done in box-shadow rather than SVG: these
 * are 13px cells and there are 21 thumbs per hand, so the board's per-cell
 * pattern machinery would be a poor trade at this size.
 *
 * Every amplitude forks by value class through `tileVar` / `TILE_FINISH` — the
 * same `--tile-*` tokens the board's PlacedLayer uses (P59). `tileVar` returns a
 * `var()` string, so it drops into the alpha slot of an `rgba()` or a `border`
 * unchanged; a white glyph leans on the dark side (`-light`) and a black one on
 * the light side (`-dark`) instead of each clipping into its near-mono body.
 */
function cellMold(finish: TileFinish): string {
  const hi = tileVar('--tile-hi', finish);
  const lo = tileVar('--tile-lo', finish);
  return [
    `inset 0 1.5px 0 rgba(255,255,255,${hi})`,
    `inset 1.5px 0 0 rgba(255,255,255,${hi})`,
    `inset 0 -1.5px 0 rgba(0,0,0,${lo})`,
    `inset -1.5px 0 0 rgba(0,0,0,${lo})`,
    `0 1px 1.5px rgba(0,0,0,${tileVar('--tile-shadow', finish)})`,
  ].join(', ');
}
/** The window's glint, matching the board tile's top-left lamp — its hue forks
 *  with the theme's `--tile-glint` (warm on the light themes). */
function cellGlint(finish: TileFinish): string {
  const glint = tileVar('--tile-glint', finish);
  return `radial-gradient(circle at 36% 28%, color-mix(in srgb, ${glint} 38%, transparent), transparent 62%)`;
}
/** The darker dye edge around a piece footprint (PlacedLayer's photo edge), which
 *  is what actually makes a near-mono glyph read against its seat card: for white
 *  it mixes toward black, for black (`-dark`) toward white. Mirrors PlacedLayer. */
function dyeEdge(color: Color, finish: TileFinish): string {
  return `color-mix(in srgb, ${PIECE_VAR[color]}, ${tileVar('--tile-dye-mix', finish)} ${tileVar('--tile-dye', finish)})`;
}

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
  unplayable = false,
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
  /** Advisor: this still-held piece has no legal move *this turn* — wash it red (P39). */
  unplayable?: boolean;
}) {
  const cells = PIECES[pieceId];
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  const filled = new Set(cells.map((c) => `${c.x},${c.y}`));
  const finish = TILE_FINISH[color];

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
        } else if (unplayable) {
          // A still-held piece with no legal move this turn: a flat red wash, no
          // glint/mold, so it reads as "can't play now" over any owner color (P39).
          cellStyle = {
            ...cellStyle,
            background: 'var(--unplayable)',
            border: micro ? '1px solid rgba(0,0,0,.3)' : undefined,
            borderRadius: micro ? 0 : 2.5,
          };
        } else if (micro) {
          cellStyle = {
            ...cellStyle,
            background: PIECE_VAR[color],
            // The micro cell's only definition is this edge; a fixed dark line
            // vanished on the black seat's dark card, so it forks to the dye
            // edge (light for black, dark for white) like the board (P59).
            border: `1px solid ${dyeEdge(color, finish)}`,
          };
        } else {
          cellStyle = {
            ...cellStyle,
            background: PIECE_VAR[color],
            backgroundImage: cellGlint(finish),
            borderRadius: 2.5,
            // Dye edge below the bevel so a near-white tile keeps a visible
            // outline on a pale card even where the light bevel washes out (P59).
            border: `1px solid ${dyeEdge(color, finish)}`,
            boxShadow: cellMold(finish),
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
      data-unplayable={unplayable || undefined}
      role={onClick ? 'button' : undefined}
      aria-label={
        micro
          ? undefined
          : `${color} piece ${pieceId}${placed ? ' (placed)' : ''}${unplayable ? ' (no legal move this turn)' : ''}${selected ? ' (selected)' : ''}`
      }
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${w}, ${cellPx}px)`,
        gap: micro ? 0 : 1,
        opacity: placed ? (micro ? 0.75 : 0.8) : unplayable ? 0.9 : 1,
        cursor: onClick ? 'pointer' : 'default',
        padding: micro ? 0 : 3,
        borderRadius: 6,
        // Selecting lifts the piece out of its tray compartment: a panel-toned
        // backing that reads above the `--well` floor, plus a cast shadow. (An
        // inset well here would now vanish — the compartment is `--well` too.)
        background: selected ? 'var(--pnl)' : 'transparent',
        boxShadow: selected ? '0 2px 6px rgba(0,0,0,.3), 0 0 0 2px #3468cf' : 'none',
      }}
    >
      {squares}
    </div>
  );
}
