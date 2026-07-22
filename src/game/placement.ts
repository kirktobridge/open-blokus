import { idx, inBounds, orthoNeighbors, diagNeighbors } from './board';
import { boardSizeOf, colorStateOf, startCellOf } from './modes';
import type { Cell, Color, GameState, PieceId } from './types';

/**
 * Whether placing `pieceId` for `color` at the given absolute `cells` is legal.
 * Enforces all five rules of GAME_SPEC §4. `cells` must already be resolved from
 * the piece's canonical shape (see resolveCells).
 */
export function isLegalPlacement(
  G: GameState,
  color: Color,
  pieceId: PieceId,
  cells: Cell[],
): boolean {
  const cs = colorStateOf(G, color);
  const N = boardSizeOf(G);

  // 1. Available.
  if (!cs.remaining.includes(pieceId)) return false;

  // 2. In bounds, and 3. Empty.
  for (const c of cells) {
    if (!inBounds(c.x, c.y, N)) return false;
    if (G.board[idx(c.x, c.y, N)] !== null) return false;
  }

  // 5. No edge contact with the same color.
  for (const c of cells) {
    for (const n of orthoNeighbors(c)) {
      if (inBounds(n.x, n.y, N) && G.board[idx(n.x, n.y, N)] === color) return false;
    }
  }

  // 4. First-move / start-cell rule.
  if (!cs.hasStarted) {
    const start = startCellOf(G, color);
    return cells.some((c) => c.x === start.x && c.y === start.y);
  }
  for (const c of cells) {
    for (const n of diagNeighbors(c)) {
      if (inBounds(n.x, n.y, N) && G.board[idx(n.x, n.y, N)] === color) return true;
    }
  }
  return false;
}

/**
 * Apply a placement to G (mutates — immer-friendly). Assumes legality was already
 * checked. Paints the board, removes the piece from `remaining`, records it as
 * `lastPlaced`, and marks the color as started.
 */
export function applyPlacement(
  G: GameState,
  color: Color,
  pieceId: PieceId,
  cells: Cell[],
): void {
  const indices = cells.map((c) => idx(c.x, c.y, boardSizeOf(G)));
  for (const i of indices) G.board[i] = color;
  G.lastMove = indices;
  const cs = colorStateOf(G, color);
  cs.remaining = cs.remaining.filter((p) => p !== pieceId);
  cs.lastPlaced = pieceId;
  cs.hasStarted = true;
}
