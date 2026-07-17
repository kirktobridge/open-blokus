import { useEffect, useRef } from 'react';
import type { Cell as CellCoord, Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';
import { Cell } from './Cell';
import { MatLayer } from './MatLayer';
import { PlacedLayer } from './PlacedLayer';
import { LegalMoveHints, type Hint } from '../advisor/LegalMoveHints';
import { CutMarks, type CutMark } from './CutMarks';

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
  startHint,
  onCellEnter,
  onCellClick,
  onLeave,
  onRotate,
  onFlip,
  glowColors,
  hints,
  cutMarks,
}: {
  board: (Color | null)[];
  activeColor: Color;
  preview?: BoardPreview;
  lastMove?: number[];
  /** Active color's starting corner to highlight before its first move. */
  startHint?: CellCoord;
  onCellEnter?: (x: number, y: number) => void;
  onCellClick?: (x: number, y: number) => void;
  onLeave?: () => void;
  /** Mouse-wheel over the board rotates the piece being placed. */
  onRotate?: (dir: 1 | -1) => void;
  /** Right-click over the board flips the piece being placed. */
  onFlip?: () => void;
  /** Colors whose pieces glow — the game-over winner reveal (P16). */
  glowColors?: Color[];
  /** Advisor overlay markers — legal-placement hints (P3 R1). Display-only. */
  hints?: Hint[];
  /** Corners a `cut` just destroyed, marked briefly (P32). Display-only. */
  cutMarks?: CutMark[];
}) {
  const lastMoveSet = lastMove ? new Set(lastMove) : undefined;
  const ref = useRef<HTMLDivElement>(null);

  // Board indices under the current preview — the placed-piece finish skips
  // these so live placement feedback (esp. illegal over an occupied cell) shows.
  const previewIdx = preview
    ? new Set(
        [...preview.cells].map((k) => {
          const [x, y] = k.split(',').map(Number);
          return y * BOARD_SIZE + x;
        }),
      )
    : undefined;

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
        position: 'relative',
        // Own the stacking context so MatLayer's negative z-index sits under the
        // cells but can't escape below the board frame behind us.
        isolation: 'isolate',
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_PX}px)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_PX}px)`,
        width: BOARD_SIZE * CELL_PX,
      }}
    >
      <MatLayer />
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
            startHint={startHint?.x === x && startHint?.y === y}
            previewColor={activeColor}
            lastMove={lastMoveSet?.has(i) ?? false}
            testId={`cell-${x}-${y}`}
            label={`cell ${x},${y}${value ? ` ${value}` : ' empty'}`}
            onEnter={onCellEnter ? () => onCellEnter(x, y) : undefined}
            onClick={onCellClick ? () => onCellClick(x, y) : undefined}
          />
        );
      })}
      <PlacedLayer
        board={board}
        previewCells={previewIdx}
        lastMove={lastMove}
        glowColors={glowColors}
      />
      {hints && hints.length > 0 && <LegalMoveHints hints={hints} />}
      {cutMarks && cutMarks.length > 0 && <CutMarks marks={cutMarks} />}
    </div>
  );
}
