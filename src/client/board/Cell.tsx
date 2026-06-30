import type { Color } from '../../game/types';
import { COLOR_HEX, EMPTY_CELL, GRID_LINE, CELL_PX } from '../theme';

export function Cell({ value }: { value: Color | null }) {
  return (
    <div
      style={{
        width: CELL_PX,
        height: CELL_PX,
        background: value ? COLOR_HEX[value] : EMPTY_CELL,
        border: `1px solid ${GRID_LINE}`,
        boxSizing: 'border-box',
      }}
    />
  );
}
