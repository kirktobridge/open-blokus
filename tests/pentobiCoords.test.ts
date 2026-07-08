import { describe, it, expect } from 'vitest';
import { COLOR_ORDER } from '../src/game/types';
import { CORNERS } from '../src/game/modes';
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
 * Locks the Pentobi GTP coordinate/move mapping (AE19). The transform is
 * x = col-'a', y = 20-row, verified live against Pentobi's forced first moves:
 * blue→a20, yellow→t20, red→t1, green→a1 — the four corners of our CORNERS map.
 */
describe('pentobi coords', () => {
  it('maps the four corners the way Pentobi seats them', () => {
    expect(cellToPoint(CORNERS.blue)).toBe('a20'); // top-left
    expect(cellToPoint(CORNERS.yellow)).toBe('t20'); // top-right
    expect(cellToPoint(CORNERS.red)).toBe('t1'); // bottom-right
    expect(cellToPoint(CORNERS.green)).toBe('a1'); // bottom-left
  });

  it('round-trips every board cell through point notation', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        expect(pointToCell(cellToPoint({ x, y }))).toEqual({ x, y });
      }
    }
  });

  it('rejects out-of-range and malformed points', () => {
    expect(() => pointToCell('u1')).toThrow(); // column past 't'
    expect(() => pointToCell('a21')).toThrow(); // row past 20
    expect(() => pointToCell('a0')).toThrow(); // row before 1
    expect(() => pointToCell('zz')).toThrow();
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
      const recovered = moveToPlacement(G, blue, placementToMove(m));
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
});
