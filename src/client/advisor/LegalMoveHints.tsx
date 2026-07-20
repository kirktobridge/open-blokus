import { BOARD_SIZE } from '../../shared/constants';
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
  onPick,
  pulse = false,
}: {
  hints: Hint[];
  onPick?: (id: string) => void;
  /** Gently pulse the markers to draw the eye (used for the tutorial). */
  pulse?: boolean;
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      {hints.map((h) =>
        h.cells.map((ci) => {
          const x = ci % BOARD_SIZE;
          const y = (ci / BOARD_SIZE) | 0;
          const t = hintStyle(h);
          return (
            <div
              key={`${h.id}:${ci}`}
              data-testid={`hint-${h.id}`}
              className={pulse ? 'ob-hint-pulse' : undefined}
              onClick={onPick ? () => onPick(h.id) : undefined}
              style={{
                position: 'absolute',
                left: x * CELL_PX,
                top: y * CELL_PX,
                width: CELL_PX,
                height: CELL_PX,
                boxSizing: 'border-box',
                background: t.fill,
                boxShadow: `inset 0 0 0 2px ${t.ring}`,
                borderRadius: 4,
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
