import { idx, inBounds, orthoNeighbors, diagNeighbors } from './board';
import { CORNERS } from './modes';
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
  const cs = G.colors[color];

  // 1. Available.
  if (!cs.remaining.includes(pieceId)) return false;

  // 2. In bounds, and 3. Empty.
  for (const c of cells) {
    if (!inBounds(c.x, c.y)) return false;
    if (G.board[idx(c.x, c.y)] !== null) return false;
  }

  // 5. No edge contact with the same color.
  for (const c of cells) {
    for (const n of orthoNeighbors(c)) {
      if (inBounds(n.x, n.y) && G.board[idx(n.x, n.y)] === color) return false;
    }
  }

  // 4. First-move / corner rule.
  if (!cs.hasStarted) {
    const corner = CORNERS[color];
    return cells.some((c) => c.x === corner.x && c.y === corner.y);
  }
  for (const c of cells) {
    for (const n of diagNeighbors(c)) {
      if (inBounds(n.x, n.y) && G.board[idx(n.x, n.y)] === color) return true;
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
  for (const c of cells) G.board[idx(c.x, c.y)] = color;
  const cs = G.colors[color];
  cs.remaining = cs.remaining.filter((p) => p !== pieceId);
  cs.lastPlaced = pieceId;
  cs.hasStarted = true;
}
