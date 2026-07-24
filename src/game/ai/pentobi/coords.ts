/**
 * Coordinate + move mapping between our engine and Pentobi's GTP dialect (AE19,
 * variant-parameterized in AE29).
 *
 * Pentobi uses Go-style board points: columns `a`.. (a = x0, no skipped letter)
 * and rows `1`..`N` counting from the BOTTOM of an N×N board. Our engine is
 * (x, y) with y counting from the top. So the transform is:
 *   x = column - 'a'          y = size - row
 * Verified against Pentobi's forced first moves — Classic (size 20): blue→a20
 * (0,0), yellow→t20 (19,0), red→t1 (19,19), green→a1 (0,19), our CORNERS map; Duo
 * (size 14): black→e10 (4,4), white→j5 (9,9), our DUO_START_CELLS.
 *
 * `size` is a required parameter, never a Classic default — reading the wrong
 * board size is the P55 bug class, and the variant-sensitive tree bans the
 * `BOARD_SIZE` constant precisely so this stays a caller-supplied value.
 *
 * A Pentobi move is just the comma-separated set of points a piece occupies
 * (no piece id / rotation), which matches our cell-set model. We recover our
 * canonical Placement by matching the point set against `generateLegalMoves` —
 * that lookup doubles as replay-verification (a Pentobi move with no legal
 * counterpart in our rules core is a mapping/rules bug and throws).
 */
import type { Cell, Color, GameState, Placement } from '../../types';
import { boardSizeOf } from '../../modes';
import { resolveCells } from '../../pieces';
import { generateLegalMoves } from '../../moves';

const A = 'a'.charCodeAt(0);

/** Our cell → Pentobi point string on an `size`×`size` board (e.g. {x:2,y:2}@20 → "c18"). */
export function cellToPoint(c: Cell, size: number): string {
  return String.fromCharCode(A + c.x) + String(size - c.y);
}

/** Pentobi point string → our cell on an `size`×`size` board (e.g. "c18"@20 → {x:2,y:2}). */
export function pointToCell(p: string, size: number): Cell {
  const m = /^([a-z])(\d{1,2})$/.exec(p.trim().toLowerCase());
  if (!m) throw new Error(`unparseable pentobi point: "${p}"`);
  const x = m[1].charCodeAt(0) - A;
  const y = size - Number(m[2]);
  if (x < 0 || x >= size || y < 0 || y >= size) {
    throw new Error(`pentobi point out of range for size ${size}: "${p}"`);
  }
  return { x, y };
}

/** Our placement → Pentobi move string (comma-separated occupied points). */
export function placementToMove(p: Placement, size: number): string {
  return resolveCells(p).map((c) => cellToPoint(c, size)).join(',');
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
 * Board size is read from `G` (variant-aware), never assumed Classic.
 */
export function moveToPlacement(G: GameState, color: Color, move: string): Placement {
  const size = boardSizeOf(G);
  const key = cellSetKey(move.split(',').map((p) => pointToCell(p, size)));
  for (const m of generateLegalMoves(G, color)) {
    if (cellSetKey(resolveCells(m)) === key) return m;
  }
  throw new Error(
    `Pentobi move "${move}" for ${color} has no legal counterpart in our rules core (mapping/rules bug)`,
  );
}
