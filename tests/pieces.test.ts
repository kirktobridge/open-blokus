import { describe, it, expect } from 'vitest';
import { PIECE_IDS } from '../src/game/types';
import type { Cell, PieceId } from '../src/game/types';
import {
  PIECES,
  pieceSize,
  cellsKey,
  normalize,
  getOrientations,
  resolveCells,
} from '../src/game/pieces';

/** Orthogonal connectivity check via flood fill. */
function isConnected(cells: Cell[]): boolean {
  const present = new Set(cells.map((c) => `${c.x},${c.y}`));
  const seen = new Set<string>();
  const stack: Cell[] = [cells[0]];
  seen.add(`${cells[0].x},${cells[0].y}`);
  while (stack.length) {
    const c = stack.pop()!;
    for (const n of [
      { x: c.x + 1, y: c.y },
      { x: c.x - 1, y: c.y },
      { x: c.x, y: c.y + 1 },
      { x: c.x, y: c.y - 1 },
    ]) {
      const k = `${n.x},${n.y}`;
      if (present.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(n);
      }
    }
  }
  return seen.size === cells.length;
}

const minX = (cells: Cell[]) => Math.min(...cells.map((c) => c.x));
const minY = (cells: Cell[]) => Math.min(...cells.map((c) => c.y));

describe('piece set', () => {
  it('has 21 pieces', () => {
    expect(PIECE_IDS.length).toBe(21);
    expect(new Set(PIECE_IDS).size).toBe(21);
  });

  it('has the right count of pieces per size (1/1/2/5/12)', () => {
    const counts: Record<number, number> = {};
    for (const id of PIECE_IDS) counts[pieceSize(id)] = (counts[pieceSize(id)] ?? 0) + 1;
    expect(counts).toEqual({ 1: 1, 2: 1, 3: 2, 4: 5, 5: 12 });
  });

  it('totals 89 squares per color', () => {
    const total = PIECE_IDS.reduce((sum, id) => sum + pieceSize(id), 0);
    expect(total).toBe(89);
  });
});

describe('base shapes', () => {
  it('are normalized (min x = min y = 0)', () => {
    for (const id of PIECE_IDS) {
      expect(minX(PIECES[id]), id).toBe(0);
      expect(minY(PIECES[id]), id).toBe(0);
    }
  });

  it('have no duplicate cells', () => {
    for (const id of PIECE_IDS) {
      const uniq = new Set(PIECES[id].map((c) => `${c.x},${c.y}`));
      expect(uniq.size, id).toBe(PIECES[id].length);
    }
  });

  it('are orthogonally connected', () => {
    for (const id of PIECE_IDS) expect(isConnected(PIECES[id]), id).toBe(true);
  });
});

describe('orientations', () => {
  const expectedCounts: Record<PieceId, number> = {
    I1: 1,
    I2: 2,
    I3: 2,
    V3: 4,
    I4: 2,
    O4: 1,
    T4: 4,
    L4: 8,
    S4: 4,
    F5: 8,
    I5: 2,
    L5: 8,
    N5: 8,
    P5: 8,
    T5: 4,
    U5: 4,
    V5: 4,
    W5: 4,
    X5: 1,
    Y5: 8,
    Z5: 4,
  };

  it('match the GAME_SPEC §2 fixed-orientation counts', () => {
    for (const id of PIECE_IDS) {
      expect(getOrientations(id).length, id).toBe(expectedCounts[id]);
    }
  });

  it('total 6 trominoes, 19 tetrominoes, 63 pentominoes', () => {
    const sumOf = (ids: PieceId[]) =>
      ids.reduce((s, id) => s + getOrientations(id).length, 0);
    const bySize = (n: number) => PIECE_IDS.filter((id) => pieceSize(id) === n);
    expect(sumOf(bySize(3))).toBe(6);
    expect(sumOf(bySize(4))).toBe(19);
    expect(sumOf(bySize(5))).toBe(63);
  });

  it('are each normalized, connected, deduplicated, and size-preserving', () => {
    for (const id of PIECE_IDS) {
      const oris = getOrientations(id);
      const keys = new Set<string>();
      for (const ori of oris) {
        expect(ori.length, id).toBe(pieceSize(id));
        expect(minX(ori), id).toBe(0);
        expect(minY(ori), id).toBe(0);
        expect(isConnected(ori), id).toBe(true);
        keys.add(cellsKey(ori));
      }
      expect(keys.size, id).toBe(oris.length); // no duplicates
    }
  });
});

describe('resolveCells', () => {
  it('round-trips T4 rot1 reflected at (5,5) to a valid oriented T4', () => {
    const cells = resolveCells({ pieceId: 'T4', rotation: 1, reflected: true, x: 5, y: 5 });
    expect(cells.length).toBe(4);
    expect(minX(cells)).toBe(5);
    expect(minY(cells)).toBe(5);
    const validKeys = new Set(getOrientations('T4').map(cellsKey));
    expect(validKeys.has(cellsKey(normalize(cells)))).toBe(true);
  });

  it('anchors every piece/rotation/reflection at the given (x,y) as a valid orientation', () => {
    for (const id of PIECE_IDS) {
      const validKeys = new Set(getOrientations(id).map(cellsKey));
      for (const rotation of [0, 1, 2, 3] as const) {
        for (const reflected of [false, true]) {
          const cells = resolveCells({ pieceId: id, rotation, reflected, x: 3, y: 7 });
          expect(cells.length, id).toBe(pieceSize(id));
          expect(minX(cells), id).toBe(3);
          expect(minY(cells), id).toBe(7);
          expect(validKeys.has(cellsKey(normalize(cells))), id).toBe(true);
        }
      }
    }
  });
});
