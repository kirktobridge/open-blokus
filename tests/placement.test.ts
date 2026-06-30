import { describe, it, expect } from 'vitest';
import type { Cell } from '../src/game/types';
import { createInitialState, CORNERS } from '../src/game/modes';
import { isLegalPlacement, applyPlacement } from '../src/game/placement';
import { idx } from '../src/game/board';

const cell = (x: number, y: number): Cell => ({ x, y });

describe('first move (corner rule)', () => {
  it('blue corner is top-left (0,0)', () => {
    expect(CORNERS.blue).toEqual({ x: 0, y: 0 });
  });

  it('is legal only if it covers the color corner', () => {
    const G = createInitialState(4);
    // I2 covering (0,0) — legal.
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(0, 0), cell(1, 0)])).toBe(true);
    // I2 not covering the corner — illegal (first move must cover corner).
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(1, 0), cell(2, 0)])).toBe(false);
  });

  it('rejects out-of-bounds and overlap', () => {
    const G = createInitialState(4);
    // Out of bounds.
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(19, 0), cell(20, 0)])).toBe(false);
    // Occupy (0,0), then a piece overlapping it is illegal.
    G.board[idx(0, 0)] = 'blue';
    G.colors.blue.hasStarted = true;
    expect(isLegalPlacement(G, 'blue', 'I1', [cell(0, 0)])).toBe(false);
  });
});

describe('corner-only growth (rules 4 & 5)', () => {
  function started() {
    // Blue has played I2 across (0,0)-(1,0).
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'I2', [cell(0, 0), cell(1, 0)]);
    return G;
  }

  it('allows a piece touching same color only at a corner', () => {
    const G = started();
    // (2,1) is diagonal to blue (1,0); no orthogonal blue neighbor.
    expect(isLegalPlacement(G, 'blue', 'I1', [cell(2, 1)])).toBe(true);
  });

  it('rejects a piece sharing an edge with the same color', () => {
    const G = started();
    // (2,0) is orthogonally adjacent to blue (1,0).
    expect(isLegalPlacement(G, 'blue', 'I1', [cell(2, 0)])).toBe(false);
    // (1,1) shares an edge with blue (1,0) even though it corners (0,0): edge rule wins.
    expect(isLegalPlacement(G, 'blue', 'I1', [cell(1, 1)])).toBe(false);
  });

  it('rejects a non-first piece with no same-color corner contact', () => {
    const G = started();
    // (5,5) is far from any blue cell.
    expect(isLegalPlacement(G, 'blue', 'I1', [cell(5, 5)])).toBe(false);
  });

  it('allows sharing an edge with a different color', () => {
    const G = started();
    G.board[idx(2, 2)] = 'red'; // red square adjacent to candidate
    // (2,1) corners blue (1,0) and shares an edge with red (2,2) — allowed.
    expect(isLegalPlacement(G, 'blue', 'I1', [cell(2, 1)])).toBe(true);
  });
});

describe('availability', () => {
  it('rejects a piece the color has already placed', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'I2', [cell(0, 0), cell(1, 0)]);
    // I2 is no longer in remaining; even a geometrically valid spot is illegal.
    expect(G.colors.blue.remaining).not.toContain('I2');
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(2, 1), cell(3, 1)])).toBe(false);
  });
});

describe('applyPlacement', () => {
  it('paints cells, removes the piece, records lastPlaced, sets hasStarted', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'I2', [cell(0, 0), cell(1, 0)]);
    expect(G.board[idx(0, 0)]).toBe('blue');
    expect(G.board[idx(1, 0)]).toBe('blue');
    expect(G.colors.blue.remaining).not.toContain('I2');
    expect(G.colors.blue.remaining.length).toBe(20);
    expect(G.colors.blue.lastPlaced).toBe('I2');
    expect(G.colors.blue.hasStarted).toBe(true);
  });
});
