import { BOARD_SIZE, idx, inBounds, diagNeighbors, orthoNeighbors } from '../../game/board';
import { anchorCells, generateLegalMoves } from '../../game/moves';
import { applyPlacement } from '../../game/placement';
import { resolveCells } from '../../game/pieces';
import { attachPoints } from '../../game/ai/alphabeta';
import { COLOR_ORDER } from '../../game/types';
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
 * Every distinct board cell that *some* legal placement of `pieceId` would cover
 * — the "where can this piece go" set the P3 R1 advisor highlights. Derived from
 * `generateLegalMoves`, so it's exactly the engine's legal reach for that piece.
 */
export function legalTargetCells(G: GameState, color: Color, pieceId: PieceId): number[] {
  return moveOptionCells(G, color, pieceId).targets;
}

/** The two layers the Move Options overlay draws: reach, and the corners it hooks. */
export interface MoveOptionCells {
  /** Every cell some legal placement of the piece would cover — its reach. */
  targets: number[];
  /** The subset of `targets` that are anchors — the diagonal contacts (or, on the
   *  first move, the start corner) that *make* those placements legal. Never empty
   *  when `targets` isn't: the engine only enumerates anchor-hooked placements. */
  anchors: number[];
}

/**
 * Move Options in one sweep (P50): the piece's reach *and* the anchors underneath
 * it. Anchors are the strategic unit — the footprint is only their consequence —
 * so the overlay marks them separately, but a second `generateLegalMoves` pass
 * would double the advisor's per-hover cost. Both fall out of one enumeration,
 * intersected with the rules core's own `anchorCells` (not the client's
 * `expansionAnchors` room metric) so the marks can't disagree with what the
 * engine actually hooks onto — including the pre-start case, where the single
 * anchor is the color's start corner.
 */
export function moveOptionCells(
  G: GameState,
  color: Color,
  pieceId: PieceId,
): MoveOptionCells {
  const open = new Set(anchorCells(G, color));
  const targets = new Set<number>();
  const anchors = new Set<number>();
  for (const opt of legalMovesForPiece(G, color, pieceId)) {
    for (const c of opt.cells) {
      targets.add(c);
      if (open.has(c)) anchors.add(c);
    }
  }
  return { targets: [...targets], anchors: [...anchors] };
}

/**
 * The color's still-held pieces that have *zero* legal placements on the current
 * board — pieces it can't play *this turn* (P39). Placeability is per-turn, not
 * permanent: opening a new corner (its own next move, sometimes an opponent's)
 * can unlock a piece that had nowhere to go, so this is "unplayable now," never
 * "dead forever." Derived from `generateLegalMoves`, the same enumeration the
 * P3 R1 / P34 advisor uses, so the read is exactly the engine's legal reach. An
 * eliminated color (no legal move for any piece) returns *all* its remaining
 * pieces — every one is unplayable — so the whole inventory shades.
 */
export function unplayablePieces(G: GameState, color: Color): PieceId[] {
  const remaining = G.colors[color].remaining;
  if (remaining.length === 0) return [];
  const alive = new Set<PieceId>();
  for (const p of generateLegalMoves(G, color)) alive.add(p.pieceId);
  return remaining.filter((id) => !alive.has(id));
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

/** One color's live "room": its label and open-corner count. */
export interface RoomEntry {
  color: Color;
  /** Open corner attach-points — how much room the color has left to grow. */
  room: number;
}

/**
 * Per-color "room" — open corner attach-points — sorted roomiest-first, for the
 * opt-in live mobility meter (P34 M2). Reads the *same* frontier signal as M1's
 * recap chart and P32's cut detectors (`attachPoints`, the shared computation),
 * so the live meter can never disagree with the post-game timeline. Before a
 * color's first move its lone starting corner counts as 1 (matching M1's ply-0).
 */
export function roomReadout(G: GameState): RoomEntry[] {
  return COLOR_ORDER.map((color) => ({ color, room: attachPoints(G, color) })).sort(
    (a, b) => b.room - a.room,
  );
}
