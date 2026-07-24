import { describe, it, expect } from 'vitest';
import { COLOR_ORDER } from '../src/game/types';
import { CORNERS, DUO_START_CELLS } from '../src/game/modes';
import { createInitialState } from '../src/game/modes';
import { generateLegalMoves } from '../src/game/moves';
import { resolveCells } from '../src/game/pieces';
import {
  cellToPoint,
  pointToCell,
  placementToMove,
  moveToPlacement,
  isPass,
} from '../src/game/ai/pentobi/coords';

/**
 * Locks the Pentobi GTP coordinate/move mapping (AE19; Duo in AE29). The transform
 * is x = col-'a', y = size-row, verified live against Pentobi's forced first moves:
 * Classic (size 20) blue→a20, yellow→t20, red→t1, green→a1 (our CORNERS); Duo
 * (size 14) black→e10, white→j5 (our DUO_START_CELLS).
 */
describe('pentobi coords', () => {
  it('maps the four Classic corners the way Pentobi seats them', () => {
    expect(cellToPoint(CORNERS.blue!, 20)).toBe('a20'); // top-left
    expect(cellToPoint(CORNERS.yellow!, 20)).toBe('t20'); // top-right
    expect(cellToPoint(CORNERS.red!, 20)).toBe('t1'); // bottom-right
    expect(cellToPoint(CORNERS.green!, 20)).toBe('a1'); // bottom-left
  });

  it('maps the two Duo start cells the way Pentobi seats them (size 14)', () => {
    expect(cellToPoint(DUO_START_CELLS.black!, 14)).toBe('e10'); // (4,4)
    expect(cellToPoint(DUO_START_CELLS.white!, 14)).toBe('j5'); // (9,9)
    expect(pointToCell('e10', 14)).toEqual({ x: 4, y: 4 });
    expect(pointToCell('j5', 14)).toEqual({ x: 9, y: 9 });
  });

  it('round-trips every board cell through point notation (Classic + Duo)', () => {
    for (const size of [20, 14]) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          expect(pointToCell(cellToPoint({ x, y }, size), size)).toEqual({ x, y });
        }
      }
    }
  });

  it('rejects out-of-range and malformed points', () => {
    expect(() => pointToCell('u1', 20)).toThrow(); // column past 't'
    expect(() => pointToCell('a21', 20)).toThrow(); // row past 20
    expect(() => pointToCell('a0', 20)).toThrow(); // row before 1
    expect(() => pointToCell('zz', 20)).toThrow();
    expect(() => pointToCell('o1', 14)).toThrow(); // column past 'n' on a Duo board
    expect(() => pointToCell('a15', 14)).toThrow(); // row past 14 on a Duo board
  });

  it('recognises the pass sentinel', () => {
    expect(isPass('pass')).toBe(true);
    expect(isPass(' PASS ')).toBe(true);
    expect(isPass('a1,b1')).toBe(false);
  });

  it('recovers our placement from its own move string, for every legal opener', () => {
    const G = createInitialState(4, 'basic');
    const blue = COLOR_ORDER[G.activeColorIndex];
    const moves = generateLegalMoves(G, blue);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      const recovered = moveToPlacement(G, blue, placementToMove(m, 20));
      // Same occupied cells (canonical identity — piece/rotation may differ for
      // symmetric placements, but the board footprint must be identical).
      const key = (p: typeof m) =>
        resolveCells(p)
          .map((c) => c.y * 20 + c.x)
          .sort((a, b) => a - b)
          .join(',');
      expect(key(recovered)).toBe(key(m));
    }
  });

  it('throws when a move has no legal counterpart (replay-verify gate)', () => {
    const G = createInitialState(4, 'basic');
    const blue = COLOR_ORDER[G.activeColorIndex];
    // A cell far from blue's corner cannot be a legal blue opener.
    expect(() => moveToPlacement(G, blue, 't1')).toThrow();
  });

  it('recovers Duo openers via the board size read from G (AE29)', () => {
    const G = createInitialState(2, 'advanced', 'duo');
    const black = G.config.playColors![G.activeColorIndex];
    const size = G.config.boardSize!;
    const moves = generateLegalMoves(G, black);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      // moveToPlacement reads size from G — no size passed — so a Duo game round-trips.
      const recovered = moveToPlacement(G, black, placementToMove(m, size));
      const key = (p: typeof m) =>
        resolveCells(p)
          .map((c) => c.y * 20 + c.x)
          .sort((a, b) => a - b)
          .join(',');
      expect(key(recovered)).toBe(key(m));
    }
  });
});
