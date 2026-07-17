import type { Color } from '../../game/types';
import { CELL_PX, PIECE_VAR } from '../theme';

export type PreviewState = 'none' | 'legal' | 'illegal';

export function Cell({
  value,
  preview,
  staged = false,
  startHint = false,
  previewColor,
  lastMove = false,
  testId,
  label,
  onEnter,
  onClick,
}: {
  value: Color | null;
  preview: PreviewState;
  staged?: boolean;
  /** Marks the active color's starting corner before its first move. */
  startHint?: boolean;
  previewColor: Color;
  lastMove?: boolean;
  testId?: string;
  label?: string;
  onEnter?: () => void;
  onClick?: () => void;
}) {
  // A resting cell paints nothing at all: MatLayer draws the molded board
  // (well + lattice + studs) underneath, and the translucent PlacedLayer finish
  // supplies the piece color on top, so the mold ghosts through the recessed
  // windows (board-through-plastic). Preview/hint branches still color.
  let background = 'transparent';
  let opacity = 1;
  if (preview === 'legal') {
    background = PIECE_VAR[previewColor];
    opacity = staged ? 0.85 : 0.55;
  } else if (preview === 'illegal') {
    background = '#ef4444';
    opacity = staged ? 0.85 : 0.55;
  }

  // Corner marker: only when empty and not currently under a preview.
  const showHint = startHint && preview === 'none' && !value;

  return (
    <div
      data-testid={testId}
      data-value={value ?? ''}
      data-lastmove={lastMove}
      data-starthint={showHint}
      role={onClick ? 'button' : undefined}
      aria-label={label}
      onMouseEnter={onEnter}
      onClick={onClick}
      style={{
        width: CELL_PX,
        height: CELL_PX,
        background: showHint ? PIECE_VAR[previewColor] : background,
        opacity: showHint ? 0.3 : opacity,
        // Transparent, not absent: the mat's lattice shows through here, and
        // keeping the border keeps every cell's box geometry exactly as it was.
        border: '1px solid transparent',
        boxShadow: staged
          ? 'inset 0 0 0 2px var(--outline-strong)'
          : showHint
            ? `inset 0 0 0 2px ${PIECE_VAR[previewColor]}`
            : lastMove
              ? 'inset 0 0 0 3px var(--brass)'
              : undefined,
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
      }}
    />
  );
}
