import { BOARD_SIZE, idx, inBounds, diagNeighbors, orthoNeighbors } from '../../game/board';
import { generateLegalMoves } from '../../game/moves';
import { applyPlacement } from '../../game/placement';
import { resolveCells } from '../../game/pieces';
import type { Color, GameState, PieceId, Placement } from '../../game/types';

/**
 * Client-side placement insight shared by the P3 mid-game advisor (R1 "show legal
 * placements") and the P4 tutorial. Pure — reads GameState, no React — and leans
 * on the rules core (`generateLegalMoves`, `applyPlacement`) so it can never drift
 * from what the engine actually allows.
 */

export interface LegalOption {
  placement: Placement;
  /** Absolute board indices the placement covers. */
  cells: number[];
}

/** Absolute board indices a placement covers. */
export function placementCells(placement: Placement): number[] {
  return resolveCells(placement).map((c) => idx(c.x, c.y));
}

/** Legal placements for `color`, optionally limited to a single piece. */
export function legalMovesForPiece(
  G: GameState,
  color: Color,
  pieceId?: PieceId,
): LegalOption[] {
  return generateLegalMoves(G, color)
    .filter((p) => pieceId == null || p.pieceId === pieceId)
    .map((placement) => ({ placement, cells: placementCells(placement) }));
}

/**
 * A color's open "corners": empty cells diagonally adjacent to one of its pieces
 * but not orthogonally adjacent to any (an orthogonally-adjacent cell can never be
 * covered — that's the edge-touch rule). These are exactly the cells a next piece
 * can legally hook onto, so their count is a plain-language measure of how much
 * room the color has to grow.
 */
export function expansionAnchors(G: GameState, color: Color): number[] {
  const anchors = new Set<number>();
  for (let i = 0; i < G.board.length; i++) {
    if (G.board[i] !== color) continue;
    const x = i % BOARD_SIZE;
    const y = (i / BOARD_SIZE) | 0;
    for (const d of diagNeighbors({ x, y })) {
      if (!inBounds(d.x, d.y)) continue;
      const di = idx(d.x, d.y);
      if (G.board[di] !== null) continue;
      if (orthoNeighbors(d).some((n) => inBounds(n.x, n.y) && G.board[idx(n.x, n.y)] === color)) {
        continue;
      }
      anchors.add(di);
    }
  }
  return [...anchors];
}

/**
 * How many open corners `color` would have after making `placement` — the
 * "expansion lanes preserved" metric the tutorial uses to contrast a cramped move
 * against one that keeps the position open. Higher is roomier.
 */
export function anchorsAfter(G: GameState, color: Color, placement: Placement): number {
  const next = structuredClone(G) as GameState;
  applyPlacement(next, color, placement.pieceId, resolveCells(placement));
  return expansionAnchors(next, color).length;
}
