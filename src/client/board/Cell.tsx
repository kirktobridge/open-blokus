import type { Color } from '../../game/types';
import { COLOR_HEX, EMPTY_CELL, GRID_LINE, CELL_PX } from '../theme';

export type PreviewState = 'none' | 'legal' | 'illegal';

export function Cell({
  value,
  preview,
  previewColor,
  lastMove = false,
  testId,
  label,
  onEnter,
  onClick,
}: {
  value: Color | null;
  preview: PreviewState;
  previewColor: Color;
  lastMove?: boolean;
  testId?: string;
  label?: string;
  onEnter?: () => void;
  onClick?: () => void;
}) {
  let background = value ? COLOR_HEX[value] : EMPTY_CELL;
  let opacity = 1;
  if (preview === 'legal') {
    background = COLOR_HEX[previewColor];
    opacity = 0.55;
  } else if (preview === 'illegal') {
    background = '#ef4444';
    opacity = 0.55;
  }

  return (
    <div
      data-testid={testId}
      data-value={value ?? ''}
      data-lastmove={lastMove}
      role={onClick ? 'button' : undefined}
      aria-label={label}
      onMouseEnter={onEnter}
      onClick={onClick}
      style={{
        width: CELL_PX,
        height: CELL_PX,
        background,
        opacity,
        border: `1px solid ${GRID_LINE}`,
        boxShadow: lastMove ? 'inset 0 0 0 3px var(--last-move-ring)' : undefined,
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
      }}
    />
  );
}
