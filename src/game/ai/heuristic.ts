import { BOARD_SIZE, idx, inBounds, orthoNeighbors, diagNeighbors } from '../board';
import { resolveCells } from '../pieces';
import { generateLegalMoves } from '../moves';
import type { Cell, Color, GameState, Placement } from '../types';

/** Tunable heuristic weights. Larger pieces dominate; mobility (frontier) next. */
export interface Weights {
  size: number; // prefer playing big pieces (size 1..5 → 10..50)
  frontier: number; // each new corner-attach point gained
  center: number; // mild early pull toward the board center
  block: number; // deny opponents a corner we sit diagonally next to
}

/** Default weights used by the shipped offline bot. */
export const WEIGHTS: Weights = {
  size: 10,
  frontier: 3,
  center: 1,
  block: 2,
};

const CENTER = (BOARD_SIZE - 1) / 2;

/** Empty diagonal cells that stay legal future attach points after this placement. */
function newFrontier(G: GameState, color: Color, cells: Cell[]): number {
  const placed = new Set(cells.map((c) => idx(c.x, c.y)));
  const isSameColor = (x: number, y: number) =>
    inBounds(x, y) && (placed.has(idx(x, y)) || G.board[idx(x, y)] === color);

  const frontier = new Set<number>();
  for (const c of cells) {
    for (const d of diagNeighbors(c)) {
      if (!inBounds(d.x, d.y)) continue;
      const di = idx(d.x, d.y);
      if (placed.has(di) || G.board[di] !== null) continue; // must be empty
      // An attach point can't be orthogonally adjacent to our own color.
      if (orthoNeighbors(d).some((n) => isSameColor(n.x, n.y))) continue;
      frontier.add(di);
    }
  }
  return frontier.size;
}

/** How many of our placed cells sit diagonally next to an opponent (deny their corner). */
function opponentCornersDenied(G: GameState, color: Color, cells: Cell[]): number {
  let n = 0;
  for (const c of cells) {
    const denies = diagNeighbors(c).some((d) => {
      if (!inBounds(d.x, d.y)) return false;
      const v = G.board[idx(d.x, d.y)];
      return v !== null && v !== color;
    });
    if (denies) n++;
  }
  return n;
}

/** Higher when the piece sits closer to the center (mild). */
function centerScore(cells: Cell[]): number {
  const avg =
    cells.reduce((s, c) => s + Math.abs(c.x - CENTER) + Math.abs(c.y - CENTER), 0) /
    cells.length;
  return -avg;
}

/** Heuristic value of a single placement for `color` (higher is better). */
export function scorePlacement(
  G: GameState,
  color: Color,
  placement: Placement,
  weights: Weights = WEIGHTS,
): number {
  const cells = resolveCells(placement);
  return (
    cells.length * weights.size +
    newFrontier(G, color, cells) * weights.frontier +
    centerScore(cells) * weights.center +
    opponentCornersDenied(G, color, cells) * weights.block
  );
}

/**
 * Pick the highest-scoring legal placement for `color`. Ties are broken with `rng`
 * (default deterministic: first tie). Returns null only if there are no legal moves.
 */
export function chooseMove(
  G: GameState,
  color: Color,
  rng: () => number = () => 0,
  weights: Weights = WEIGHTS,
): Placement | null {
  const moves = generateLegalMoves(G, color);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let best: Placement[] = [];
  for (const m of moves) {
    const s = scorePlacement(G, color, m, weights);
    if (s > bestScore) {
      bestScore = s;
      best = [m];
    } else if (s === bestScore) {
      best.push(m);
    }
  }
  return best[Math.floor(rng() * best.length)] ?? best[0];
}
