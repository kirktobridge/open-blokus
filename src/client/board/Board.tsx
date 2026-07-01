import { useEffect, useRef } from 'react';
import type { Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';
import { usePaletteColors } from '../palettes';
import { Cell } from './Cell';

export interface BoardPreview {
  /** Set of "x,y" keys that the previewed piece would occupy. */
  cells: Set<string>;
  /** Whether the previewed placement is legal. */
  legal: boolean;
  /** Whether the piece is locked (staged) awaiting submit. */
  staged: boolean;
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
  onRotate,
  onFlip,
}: {
  board: (Color | null)[];
  activeColor: Color;
  preview?: BoardPreview;
  lastMove?: number[];
  onCellEnter?: (x: number, y: number) => void;
  onCellClick?: (x: number, y: number) => void;
  onLeave?: () => void;
  /** Mouse-wheel over the board rotates the piece being placed. */
  onRotate?: (dir: 1 | -1) => void;
  /** Right-click over the board flips the piece being placed. */
  onFlip?: () => void;
}) {
  const lastMoveSet = lastMove ? new Set(lastMove) : undefined;
  const colors = usePaletteColors();
  const ref = useRef<HTMLDivElement>(null);

  // React attaches wheel listeners as passive, so preventDefault (to stop the
  // page scrolling while rotating) needs a native non-passive listener.
  useEffect(() => {
    const el = ref.current;
    if (!el || !onRotate) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onRotate(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onRotate]);

  return (
    <div
      ref={ref}
      data-staged={preview?.staged ?? false}
      onMouseLeave={onLeave}
      onContextMenu={
        onFlip
          ? (e) => {
              e.preventDefault();
              onFlip();
            }
          : undefined
      }
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
            staged={inPreview && (preview?.staged ?? false)}
            previewColor={activeColor}
            colors={colors}
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
