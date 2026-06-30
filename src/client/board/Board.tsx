import type { Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';
import { Cell } from './Cell';

/** Read-only 20×20 board. `board` is row-major (index = y * BOARD_SIZE + x). */
export function Board({ board }: { board: (Color | null)[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_PX}px)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_PX}px)`,
        width: BOARD_SIZE * CELL_PX,
      }}
    >
      {board.map((value, i) => (
        <Cell key={i} value={value} />
      ))}
    </div>
  );
}
