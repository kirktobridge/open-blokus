import type { Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';
import { Cell } from './Cell';

export interface BoardPreview {
  /** Set of "x,y" keys that the previewed piece would occupy. */
  cells: Set<string>;
  /** Whether the previewed placement is legal. */
  legal: boolean;
}

/** 20×20 board. `board` is row-major (index = y * BOARD_SIZE + x). */
export function Board({
  board,
  activeColor,
  preview,
  lastMove,
  onCellEnter,
  onCellClick,
  onLeave,
}: {
  board: (Color | null)[];
  activeColor: Color;
  preview?: BoardPreview;
  lastMove?: number[];
  onCellEnter?: (x: number, y: number) => void;
  onCellClick?: (x: number, y: number) => void;
  onLeave?: () => void;
}) {
  const lastMoveSet = lastMove ? new Set(lastMove) : undefined;
  return (
    <div
      onMouseLeave={onLeave}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_PX}px)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_PX}px)`,
        width: BOARD_SIZE * CELL_PX,
      }}
    >
      {board.map((value, i) => {
        const x = i % BOARD_SIZE;
        const y = Math.floor(i / BOARD_SIZE);
        const inPreview = preview?.cells.has(`${x},${y}`) ?? false;
        const state = inPreview ? (preview!.legal ? 'legal' : 'illegal') : 'none';
        return (
          <Cell
            key={i}
            value={value}
            preview={state}
            previewColor={activeColor}
            lastMove={lastMoveSet?.has(i) ?? false}
            testId={`cell-${x}-${y}`}
            label={`cell ${x},${y}${value ? ` ${value}` : ' empty'}`}
            onEnter={onCellEnter ? () => onCellEnter(x, y) : undefined}
            onClick={onCellClick ? () => onCellClick(x, y) : undefined}
          />
        );
      })}
    </div>
  );
}
