import type { Cell, Color } from '../../game/types';
import { CELL_PX, PIECE_VAR } from '../theme';

/** One color's attach-points that a placement just destroyed (P32 `cut`). */
export interface CutMark {
  id: number;
  /** The victim — the marks are drawn in its color: "these were *your* corners". */
  color: Color;
  cells: Cell[];
}

/**
 * Brief scars on the corners a cut just took away (P32 M2). Per-cell markers, not a
 * silhouette outline — lost corners are scattered points, not one connected blob, so
 * this follows the LegalMoveHints overlay pattern rather than P31's last-move ring.
 * Drop it inside the board's `position: relative` grid; it aligns to the same CELL_PX
 * cells and is pointer-through. Marks live as long as the cut beat that carries them
 * (the hook's TTL), and `ob-cut-mark` fades them out over that window — under reduced
 * motion the CSS drops the animation and they simply hold, then vanish.
 */
export function CutMarks({ marks }: { marks: CutMark[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      {marks.map((m) =>
        m.cells.map((c) => (
          <div
            key={`${m.id}:${c.y * 20 + c.x}`}
            data-testid="cut-mark"
            className="ob-cut-mark"
            style={{
              position: 'absolute',
              left: c.x * CELL_PX,
              top: c.y * CELL_PX,
              width: CELL_PX,
              height: CELL_PX,
              boxSizing: 'border-box',
              borderRadius: 4,
              background: `color-mix(in srgb, ${PIECE_VAR[m.color]} 30%, transparent)`,
              boxShadow: `inset 0 0 0 2px ${PIECE_VAR[m.color]}`,
            }}
          />
        )),
      )}
    </div>
  );
}
