import { idx, inBounds, diagNeighbors } from './board';
import { boardSizeOf, colorStateOf, startCellOf } from './modes';
import { resolveCells, cellsKey } from './pieces';
import { buildBitBoards, bbLegal } from './bitboard';
import type { Cell, Color, GameState, PieceId, Placement, Rotation } from './types';

interface Transform {
  rotation: Rotation;
  reflected: boolean;
  /** Normalized oriented cells (min x = min y = 0). */
  cells: Cell[];
  width: number;
  height: number;
}

const transformCache = new Map<PieceId, Transform[]>();

/**
 * The distinct (rotation, reflected) transforms of a piece, each with its
 * normalized cells and bounding box. Deduplicated so symmetric pieces don't
 * generate duplicate placements.
 */
function transformsFor(pieceId: PieceId): Transform[] {
  const cached = transformCache.get(pieceId);
  if (cached) return cached;

  const seen = new Map<string, Transform>();
  for (const reflected of [false, true]) {
    for (const rotation of [0, 1, 2, 3] as const) {
      const cells = resolveCells({ pieceId, rotation, reflected, x: 0, y: 0 });
      const k = cellsKey(cells);
      if (!seen.has(k)) {
        const width = Math.max(...cells.map((c) => c.x)) + 1;
        const height = Math.max(...cells.map((c) => c.y)) + 1;
        seen.set(k, { rotation, reflected, cells, width, height });
      }
    }
  }

  const result = [...seen.values()];
  transformCache.set(pieceId, result);
  return result;
}

/**
 * The empty "anchor" cells that a legal placement for `color` must cover: every
 * legal placement after the first move touches a cell diagonally adjacent to the
 * color's own pieces, and the first move must cover the color's start corner. So
 * candidate placements only need to be tried where a piece-cell lands on an
 * anchor — a small set — rather than over the whole board. Returned as flat
 * board indices.
 */
export function anchorCells(G: GameState, color: Color): number[] {
  const N = boardSizeOf(G);
  if (!colorStateOf(G, color).hasStarted) {
    const start = startCellOf(G, color);
    const ci = idx(start.x, start.y, N);
    return G.board[ci] === null ? [ci] : [];
  }
  const anchors = new Set<number>();
  for (let i = 0; i < G.board.length; i++) {
    if (G.board[i] !== color) continue;
    const x = i % N;
    const y = (i / N) | 0;
    for (const d of diagNeighbors({ x, y })) {
      if (inBounds(d.x, d.y, N)) {
        const di = idx(d.x, d.y, N);
        if (G.board[di] === null) anchors.add(di);
      }
    }
  }
  return [...anchors];
}

/**
 * Visit each unique candidate placement offset for `color` — one per (piece,
 * transform, anchor-aligned position) — deduped per transform. `visit` returns
 * true to stop early. This is the shared anchor-restricted enumeration behind
 * both generateLegalMoves and hasAnyMove.
 */
function eachCandidate(
  G: GameState,
  color: Color,
  visit: (pieceId: PieceId, t: Transform, ox: number, oy: number) => boolean,
): void {
  const N = boardSizeOf(G);
  const anchors = anchorCells(G, color);
  if (anchors.length === 0) return;
  for (const pieceId of colorStateOf(G, color).remaining) {
    for (const t of transformsFor(pieceId)) {
      const seen = new Set<number>();
      for (const anchorIdx of anchors) {
        const ax = anchorIdx % N;
        const ay = (anchorIdx / N) | 0;
        for (const c of t.cells) {
          const ox = ax - c.x;
          const oy = ay - c.y;
          if (ox < 0 || oy < 0 || ox > N - t.width || oy > N - t.height) continue;
          const key = oy * N + ox;
          if (seen.has(key)) continue;
          seen.add(key);
          if (visit(pieceId, t, ox, oy)) return;
        }
      }
    }
  }
}

/**
 * All legal placements for `color`. Output is identical (same set and same order:
 * piece → transform → y → x) to a full-board scan, but only positions anchored to
 * the color's frontier are tested.
 */
export function generateLegalMoves(G: GameState, color: Color): Placement[] {
  const moves: Placement[] = [];
  const N = boardSizeOf(G);
  const anchors = anchorCells(G, color);
  if (anchors.length === 0) return moves;
  // Build bitboards once and amortize the fast legality test over every candidate
  // (AE9) — same output as the isLegalPlacement scan, no per-cell allocation.
  const bb = buildBitBoards(G);
  const hasStarted = colorStateOf(G, color).hasStarted;
  const start = startCellOf(G, color);
  for (const pieceId of colorStateOf(G, color).remaining) {
    for (const t of transformsFor(pieceId)) {
      const offsets: Cell[] = [];
      const seen = new Set<number>();
      for (const anchorIdx of anchors) {
        const ax = anchorIdx % N;
        const ay = (anchorIdx / N) | 0;
        for (const c of t.cells) {
          const ox = ax - c.x;
          const oy = ay - c.y;
          if (ox < 0 || oy < 0 || ox > N - t.width || oy > N - t.height) continue;
          const key = oy * N + ox;
          if (seen.has(key)) continue;
          seen.add(key);
          const cells = t.cells.map((cc) => ({ x: cc.x + ox, y: cc.y + oy }));
          if (bbLegal(bb, color, cells, hasStarted, start)) offsets.push({ x: ox, y: oy });
        }
      }
      // Emit in (y, x) order to match the old full-scan ordering exactly.
      offsets.sort((a, b) => a.y - b.y || a.x - b.x);
      for (const o of offsets) {
        moves.push({ pieceId, rotation: t.rotation, reflected: t.reflected, x: o.x, y: o.y });
      }
    }
  }
  return moves;
}

/** Whether `color` has at least one legal placement (short-circuits). */
export function hasAnyMove(G: GameState, color: Color): boolean {
  const bb = buildBitBoards(G);
  const hasStarted = colorStateOf(G, color).hasStarted;
  const start = startCellOf(G, color);
  let found = false;
  eachCandidate(G, color, (_pieceId, t, ox, oy) => {
    const cells = t.cells.map((c) => ({ x: c.x + ox, y: c.y + oy }));
    if (bbLegal(bb, color, cells, hasStarted, start)) {
      found = true;
      return true;
    }
    return false;
  });
  return found;
}
