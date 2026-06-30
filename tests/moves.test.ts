import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { generateLegalMoves, hasAnyMove } from '../src/game/moves';
import { resolveCells } from '../src/game/pieces';

describe('generateLegalMoves / hasAnyMove', () => {
  it('on an empty board, blue first moves all cover the corner (0,0)', () => {
    const G = createInitialState(4);
    const moves = generateLegalMoves(G, 'blue');
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      const cells = resolveCells(m);
      expect(cells.some((c) => c.x === 0 && c.y === 0)).toBe(true);
    }
    // The monomino at the corner is one of them.
    expect(moves.some((m) => m.pieceId === 'I1' && m.x === 0 && m.y === 0)).toBe(true);
  });

  it('hasAnyMove agrees with generateLegalMoves being non-empty', () => {
    const G = createInitialState(4);
    expect(hasAnyMove(G, 'blue')).toBe(true);
    expect(hasAnyMove(G, 'blue')).toBe(generateLegalMoves(G, 'blue').length > 0);
  });

  it('reports no moves on a completely full board', () => {
    const G = createInitialState(4);
    G.board.fill('red');
    expect(hasAnyMove(G, 'blue')).toBe(false);
    expect(generateLegalMoves(G, 'blue').length).toBe(0);
  });

  it('reports no moves when a color has no pieces left', () => {
    const G = createInitialState(4);
    G.colors.blue.remaining = [];
    G.colors.blue.hasStarted = true;
    expect(hasAnyMove(G, 'blue')).toBe(false);
  });
});
