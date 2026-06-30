import { BOARD_SIZE } from './board';
import { resolveCells, cellsKey } from './pieces';
import { isLegalPlacement } from './placement';
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

/** All legal placements for `color` in the current state. */
export function generateLegalMoves(G: GameState, color: Color): Placement[] {
  const moves: Placement[] = [];
  for (const pieceId of G.colors[color].remaining) {
    for (const t of transformsFor(pieceId)) {
      for (let y = 0; y <= BOARD_SIZE - t.height; y++) {
        for (let x = 0; x <= BOARD_SIZE - t.width; x++) {
          const cells = t.cells.map((c) => ({ x: c.x + x, y: c.y + y }));
          if (isLegalPlacement(G, color, pieceId, cells)) {
            moves.push({ pieceId, rotation: t.rotation, reflected: t.reflected, x, y });
          }
        }
      }
    }
  }
  return moves;
}

/** Whether `color` has at least one legal placement (short-circuits). */
export function hasAnyMove(G: GameState, color: Color): boolean {
  for (const pieceId of G.colors[color].remaining) {
    for (const t of transformsFor(pieceId)) {
      for (let y = 0; y <= BOARD_SIZE - t.height; y++) {
        for (let x = 0; x <= BOARD_SIZE - t.width; x++) {
          const cells = t.cells.map((c) => ({ x: c.x + x, y: c.y + y }));
          if (isLegalPlacement(G, color, pieceId, cells)) return true;
        }
      }
    }
  }
  return false;
}
