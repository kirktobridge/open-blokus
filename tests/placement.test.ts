import { describe, it, expect } from 'vitest';
import type { Cell } from '../src/game/types';
import { createInitialState, CORNERS, boardSizeOf, startCellOf } from '../src/game/modes';
import { isLegalPlacement, applyPlacement } from '../src/game/placement';
import { generateLegalMoves } from '../src/game/moves';
import { idx, BOARD_SIZE } from '../src/game/board';
import { colorStateOf } from '../src/game/modes';

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
    colorStateOf(G, 'blue').hasStarted = true;
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
    expect(colorStateOf(G, 'blue').remaining).not.toContain('I2');
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(2, 1), cell(3, 1)])).toBe(false);
  });
});

describe('applyPlacement', () => {
  it('paints cells, removes the piece, records lastPlaced, sets hasStarted', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'I2', [cell(0, 0), cell(1, 0)]);
    expect(G.board[idx(0, 0)]).toBe('blue');
    expect(G.board[idx(1, 0)]).toBe('blue');
    expect(colorStateOf(G, 'blue').remaining).not.toContain('I2');
    expect(colorStateOf(G, 'blue').remaining.length).toBe(20);
    expect(colorStateOf(G, 'blue').lastPlaced).toBe('I2');
    expect(colorStateOf(G, 'blue').hasStarted).toBe(true);
  });
});

/**
 * P20 M2a made board size + start cells per-game config, but both fields are
 * optional so that states persisted *before* they existed (localStorage games,
 * shared replays, saved logs) still load. Those states are Classic by
 * construction, and this pins that fallback: without it, a pre-M2a saved game
 * would deserialize with an undefined board size and silently misbehave rather
 * than fail loudly.
 */
describe('legacy states without boardSize/startCells (M2a back-compat)', () => {
  /** A state as persisted before M2a: config carries neither new field. */
  const legacy = () => {
    const G = createInitialState(4);
    delete G.config.boardSize;
    delete G.config.startCells;
    return G;
  };

  it('reads as a Classic 20×20 board', () => {
    expect(boardSizeOf(legacy())).toBe(BOARD_SIZE);
  });

  it('falls back to the Classic corners as start cells', () => {
    const G = legacy();
    for (const color of ['blue', 'yellow', 'red', 'green'] as const) {
      expect(startCellOf(G, color)).toEqual(CORNERS[color]);
    }
  });

  it('still enforces the corner rule and bounds', () => {
    const G = legacy();
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(0, 0), cell(1, 0)])).toBe(true);
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(1, 0), cell(2, 0)])).toBe(false);
    expect(isLegalPlacement(G, 'blue', 'I2', [cell(19, 0), cell(20, 0)])).toBe(false);
  });

  it('generates the same legal moves as an equivalent modern state', () => {
    expect(generateLegalMoves(legacy(), 'blue')).toEqual(
      generateLegalMoves(createInitialState(4), 'blue'),
    );
  });
});
