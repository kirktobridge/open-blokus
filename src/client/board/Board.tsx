import { useEffect, useMemo, useRef } from 'react';
import type { Cell as CellCoord, Color } from '../../game/types';
import { CELL_PX } from '../theme';
import { Cell } from './Cell';
import { MatLayer } from './MatLayer';
import { PlacedLayer } from './PlacedLayer';
import { LegalMoveHints, type Hint } from '../advisor/LegalMoveHints';
import { CutMarks, type CutMark } from './CutMarks';
import { normTurns, toBoardXY, toScreenBoard, toScreenIndex, toScreenXY } from './orientation';

export interface BoardPreview {
  /** Set of "x,y" keys that the previewed piece would occupy. */
  cells: Set<string>;
  /** Whether the previewed placement is legal. */
  legal: boolean;
  /** Whether the piece is locked (staged) awaiting submit. */
  staged: boolean;
}

/** The playing grid. `board` is row-major and square, so its length is the only
 *  statement of the variant's size (400 Classic, 196 Duo) — nothing here defaults. */
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
  turns = 0,
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
  /**
   * Clockwise quarter-turns to view the board's *contents* through (P49). The grid
   * itself never turns: cells are laid out in screen order and the contents are
   * re-indexed into it, so the props above — and the `(x, y)` handed back by
   * `onCellEnter`/`onCellClick` — all stay in board coordinates whatever the view.
   */
  turns?: number;
}) {
  const t = normTurns(turns);
  const n = Math.round(Math.sqrt(board.length));
  const lastMoveSet = lastMove ? new Set(lastMove) : undefined;
  const ref = useRef<HTMLDivElement>(null);

  // Board indices under the current preview — the placed-piece finish skips
  // these so live placement feedback (esp. illegal over an occupied cell) shows.
  const previewIdx = preview
    ? new Set(
        [...preview.cells].map((k) => {
          const [x, y] = k.split(',').map(Number);
          return toScreenIndex(y * n + x, t, n);
        }),
      )
    : undefined;

  // The index-positioned layers (piece finish, hints, cut marks) draw straight
  // into the grid, so they get screen-space copies of their board-space inputs.
  const screenBoard = useMemo(() => toScreenBoard(board, t, n), [board, t, n]);
  const screenLastMove = useMemo(
    () => (t === 0 ? lastMove : lastMove?.map((i) => toScreenIndex(i, t, n))),
    [lastMove, t, n],
  );
  const screenHints = useMemo(
    () =>
      t === 0
        ? hints
        : hints?.map((h) => ({ ...h, cells: h.cells.map((i) => toScreenIndex(i, t, n)) })),
    [hints, t, n],
  );
  const screenCutMarks = useMemo(
    () =>
      t === 0
        ? cutMarks
        : cutMarks?.map((m) => ({
            ...m,
            cells: m.cells.map((c) => {
              const [x, y] = toScreenXY(c.x, c.y, t, n);
              return { x, y };
            }),
          })),
    [cutMarks, t, n],
  );

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
        gridTemplateColumns: `repeat(${n}, ${CELL_PX}px)`,
        gridTemplateRows: `repeat(${n}, ${CELL_PX}px)`,
        width: n * CELL_PX,
      }}
    >
      <MatLayer cells={n} />
      {/* Laid out in screen order (so the DOM never reshuffles on a view turn),
          but every cell keeps the identity — value, test id, callbacks — of the
          board cell it shows. */}
      {board.map((_, si) => {
        const [x, y] = toBoardXY(si % n, Math.floor(si / n), t, n);
        const i = y * n + x;
        const value = board[i];
        const inPreview = preview?.cells.has(`${x},${y}`) ?? false;
        const state = inPreview ? (preview!.legal ? 'legal' : 'illegal') : 'none';
        return (
          <Cell
            key={si}
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
        board={screenBoard}
        previewCells={previewIdx}
        lastMove={screenLastMove}
        glowColors={glowColors}
        settleId={lastMove?.join(',')}
      />
      {screenHints && screenHints.length > 0 && <LegalMoveHints hints={screenHints} cells={n} />}
      {screenCutMarks && screenCutMarks.length > 0 && <CutMarks marks={screenCutMarks} />}
    </div>
  );
}
