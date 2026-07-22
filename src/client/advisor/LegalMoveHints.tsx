import { CELL_PX } from '../theme';

/** Visual tone of a placement hint. */
export type HintTone = 'legal' | 'illegal' | 'suboptimal' | 'anchor' | 'threat';

export interface Hint {
  id: string;
  /** Board indices to highlight — a piece footprint, or a single open corner. */
  cells: number[];
  tone: HintTone;
  /** Override the tone with a specific color (e.g. the active player's own color,
   *  so legal-move hints read as "where *your* piece fits"). Any CSS color,
   *  including a `var(--piece-*)` so it re-tints with the theme. */
  color?: string;
  /** How each cell is drawn. `fill` (default) shades the whole cell — the "reach"
   *  read. `pip` puts a single small centred square on it instead, for a sparse
   *  layer that sits *over* a fill without becoming a second wash of colour (P50's
   *  anchor marks): guidance, not chrome. Square, not round — every mark on this
   *  board is a square, and a lone circle reads as foreign UI chrome. */
  mark?: 'fill' | 'pip';
}

const TONE: Record<HintTone, { fill: string; ring: string }> = {
  legal: { fill: 'rgba(34, 197, 94, 0.30)', ring: '#16a34a' },
  illegal: { fill: 'rgba(239, 68, 68, 0.30)', ring: '#ef4444' },
  suboptimal: { fill: 'rgba(234, 179, 8, 0.28)', ring: '#d4a017' },
  anchor: { fill: 'rgba(52, 104, 207, 0.22)', ring: '#3468cf' },
  // Incursion advisor (P44): a warning orange, distinct from `illegal`'s red — an
  // at-risk corner is a threat to weigh, not a rejected move.
  threat: { fill: 'rgba(249, 115, 22, 0.26)', ring: '#f97316' },
};

/** A `pip`'s side as a fraction of the cell, the corner rounding that matches the
 *  board's tiles, and the soft halo that lifts it off whatever it's drawn over.
 *  Small enough that a board full of anchor marks still reads as a scatter of
 *  points, not a second overlay. */
const PIP_SCALE = 0.3;
const PIP_RADIUS_PX = 1;
const PIP_HALO_PX = 2;

/** Fill + ring for a hint: the color override when given (the color at ~23% for
 *  the fill — mixed in CSS, so a var() override needs no resolution here), else
 *  the tone palette. */
function hintStyle(h: Hint): { fill: string; ring: string } {
  if (h.color) {
    return { fill: `color-mix(in srgb, ${h.color} 23%, transparent)`, ring: h.color };
  }
  return TONE[h.tone];
}

/**
 * Overlay that marks candidate placements on the board — the shared "show legal
 * placements" surface behind the P3 advisor (R1) and the P4 tutorial. Drop it as
 * a sibling of `Board` inside a `position: relative`, board-sized container; it
 * aligns to the same CELL_PX grid. When `onPick` is given, each hint's cells are
 * clickable and report the hint id.
 */
export function LegalMoveHints({
  hints,
  cells,
  onPick,
  pulse = false,
}: {
  hints: Hint[];
  /** The board's side length — hint indices are `y * cells + x`. */
  cells: number;
  onPick?: (id: string) => void;
  /** Gently pulse the markers to draw the eye (used for the tutorial). */
  pulse?: boolean;
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      {hints.map((h) =>
        h.cells.map((ci) => {
          const x = ci % cells;
          const y = (ci / cells) | 0;
          const t = hintStyle(h);
          const pip = h.mark === 'pip';
          const size = pip ? Math.round(CELL_PX * PIP_SCALE) : CELL_PX;
          const inset = (CELL_PX - size) / 2;
          return (
            <div
              key={`${h.id}:${ci}`}
              data-testid={`hint-${h.id}`}
              className={pulse ? 'ob-hint-pulse' : undefined}
              onClick={onPick ? () => onPick(h.id) : undefined}
              style={{
                position: 'absolute',
                left: x * CELL_PX + inset,
                top: y * CELL_PX + inset,
                width: size,
                height: size,
                boxSizing: 'border-box',
                // A pip is solid and small; a fill is a wash with a ring.
                background: pip ? t.ring : t.fill,
                boxShadow: pip
                  ? `0 0 0 1px rgba(0, 0, 0, 0.28), 0 0 0 ${PIP_HALO_PX}px ${t.fill}`
                  : `inset 0 0 0 2px ${t.ring}`,
                borderRadius: pip ? PIP_RADIUS_PX : 4,
                cursor: onPick ? 'pointer' : 'default',
                pointerEvents: onPick ? 'auto' : 'none',
              }}
            />
          );
        }),
      )}
    </div>
  );
}
