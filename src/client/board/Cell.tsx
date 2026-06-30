import type { Color } from '../../game/types';
import { COLOR_HEX, EMPTY_CELL, GRID_LINE, CELL_PX } from '../theme';

export type PreviewState = 'none' | 'legal' | 'illegal';

export function Cell({
  value,
  preview,
  previewColor,
  testId,
  onEnter,
  onClick,
}: {
  value: Color | null;
  preview: PreviewState;
  previewColor: Color;
  testId?: string;
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
      onMouseEnter={onEnter}
      onClick={onClick}
      style={{
        width: CELL_PX,
        height: CELL_PX,
        background,
        opacity,
        border: `1px solid ${GRID_LINE}`,
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
      }}
    />
  );
}
