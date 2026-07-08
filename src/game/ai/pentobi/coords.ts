/**
 * Coordinate + move mapping between our engine and Pentobi's GTP dialect (AE19).
 *
 * Pentobi uses Go-style board points: columns `a`..`t` (a = x0 .. t = x19, no
 * skipped letter) and rows `1`..`20` counting from the BOTTOM. Our engine is
 * (x, y) with y counting from the top. So the transform is:
 *   x = column - 'a'          y = 20 - row
 * Verified against Pentobi's forced first moves: blue→a20 (0,0), yellow→t20
 * (19,0), red→t1 (19,19), green→a1 (0,19) — identical to our CORNERS map.
 *
 * A Pentobi move is just the comma-separated set of points a piece occupies
 * (no piece id / rotation), which matches our cell-set model. We recover our
 * canonical Placement by matching the point set against `generateLegalMoves` —
 * that lookup doubles as replay-verification (a Pentobi move with no legal
 * counterpart in our rules core is a mapping/rules bug and throws).
 */
import type { Cell, Color, GameState, Placement } from '../../types';
import { resolveCells } from '../../pieces';
import { generateLegalMoves } from '../../moves';

const A = 'a'.charCodeAt(0);

/** Our cell → Pentobi point string (e.g. {x:2,y:2} → "c18"). */
export function cellToPoint(c: Cell): string {
  return String.fromCharCode(A + c.x) + String(20 - c.y);
}

/** Pentobi point string → our cell (e.g. "c18" → {x:2,y:2}). */
export function pointToCell(p: string): Cell {
  const m = /^([a-t])(\d{1,2})$/.exec(p.trim().toLowerCase());
  if (!m) throw new Error(`unparseable pentobi point: "${p}"`);
  const x = m[1].charCodeAt(0) - A;
  const y = 20 - Number(m[2]);
  if (x < 0 || x > 19 || y < 0 || y > 19) throw new Error(`pentobi point out of range: "${p}"`);
  return { x, y };
}

/** Our placement → Pentobi move string (comma-separated occupied points). */
export function placementToMove(p: Placement): string {
  return resolveCells(p).map(cellToPoint).join(',');
}

/** Order-independent key for a cell set, so two placements can be compared. */
function cellSetKey(cells: Cell[]): string {
  return cells
    .map((c) => c.y * 20 + c.x)
    .sort((a, b) => a - b)
    .join(',');
}

/** True if a GTP move token is Pentobi's "no legal move" sentinel. */
export function isPass(move: string): boolean {
  return move.trim().toLowerCase() === 'pass';
}

/**
 * Pentobi move string → our canonical Placement, found by matching the occupied
 * cells against our legal moves for `color`. Throws if no legal move matches —
 * that is the replay-verification gate (M-style: a corrupt bridge fails loud,
 * it does not silently score a bogus game). Callers handle `isPass` before this.
 */
export function moveToPlacement(G: GameState, color: Color, move: string): Placement {
  const key = cellSetKey(move.split(',').map(pointToCell));
  for (const m of generateLegalMoves(G, color)) {
    if (cellSetKey(resolveCells(m)) === key) return m;
  }
  throw new Error(
    `Pentobi move "${move}" for ${color} has no legal counterpart in our rules core (mapping/rules bug)`,
  );
}
