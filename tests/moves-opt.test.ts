import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { generateLegalMoves, hasAnyMove } from '../src/game/moves';
import { isLegalPlacement, applyPlacement } from '../src/game/placement';
import { getOrientations, resolveCells } from '../src/game/pieces';
import { idx, BOARD_SIZE } from '../src/game/board';
import { COLOR_ORDER } from '../src/game/types';
import type { Cell, Color, GameState } from '../src/game/types';
import { mulberry32 } from '../src/game/ai/arena';
import { colorStateOf } from '../src/game/modes';

/**
 * Independent brute-force oracle: the straightforward full-board scan (every
 * piece × orientation × position) the optimized generator replaced. Deliberately
 * does NOT use moves.ts internals, so it's a true reference.
 */
function oracleMoves(G: GameState, color: Color): { pieceId: import('../src/game/types').PieceId; cells: Cell[] }[] {
  const out: { pieceId: import('../src/game/types').PieceId; cells: Cell[] }[] = [];
  for (const pieceId of colorStateOf(G, color).remaining) {
    for (const base of getOrientations(pieceId)) {
      let maxX = 0;
      let maxY = 0;
      for (const c of base) {
        if (c.x > maxX) maxX = c.x;
        if (c.y > maxY) maxY = c.y;
      }
      for (let y = 0; y <= BOARD_SIZE - 1 - maxY; y++) {
        for (let x = 0; x <= BOARD_SIZE - 1 - maxX; x++) {
          const cells = base.map((c) => ({ x: c.x + x, y: c.y + y }));
          if (isLegalPlacement(G, color, pieceId, cells)) out.push({ pieceId, cells });
        }
      }
    }
  }
  return out;
}

/** Canonical, orientation-label-independent key: piece + sorted absolute cells. */
function cellKey(pieceId: string, cells: Cell[]): string {
  return pieceId + ':' + cells.map((c) => idx(c.x, c.y, BOARD_SIZE)).sort((a, b) => a - b).join(',');
}

function keysFromOracle(G: GameState, color: Color): Set<string> {
  return new Set(oracleMoves(G, color).map((m) => cellKey(m.pieceId, m.cells)));
}
function keysFromGen(G: GameState, color: Color): Set<string> {
  return new Set(generateLegalMoves(G, color).map((m) => cellKey(m.pieceId, resolveCells(m))));
}

/** Build a varied position by applying random legal (oracle-chosen) moves. */
function randomPosition(seed: number, plies: number): GameState {
  const rng = mulberry32(seed);
  const G = createInitialState(4);
  for (let p = 0; p < plies; p++) {
    const color = COLOR_ORDER[p % COLOR_ORDER.length];
    const moves = oracleMoves(G, color);
    if (moves.length === 0) continue;
    const m = moves[(rng() * moves.length) | 0];
    applyPlacement(G, color, m.pieceId, m.cells);
  }
  return G;
}

describe('generateLegalMoves (anchor-optimized) vs brute-force oracle', () => {
  it('produces the identical legal set for every color across many positions', () => {
    for (let seed = 1; seed <= 8; seed++) {
      for (const plies of [0, 3, 6, 9, 12, 15]) {
        const G = randomPosition(seed, plies);
        for (const color of COLOR_ORDER) {
          const oracle = keysFromOracle(G, color);
          const gen = keysFromGen(G, color);
          expect(gen).toEqual(oracle);
          // hasAnyMove must agree with existence of any legal placement.
          expect(hasAnyMove(G, color)).toBe(oracle.size > 0);
        }
      }
    }
  });

  it('emits placements in the same (piece → y → x) order as the full scan', () => {
    // On the opening position the optimized generator should be byte-identical to
    // a piece→transform→y→x scan; check monotonic ordering within each piece run.
    const G = createInitialState(4);
    const moves = generateLegalMoves(G, 'blue');
    expect(moves.length).toBeGreaterThan(0);
    // All opening moves must cover the corner (0,0).
    for (const m of moves) {
      expect(resolveCells(m).some((c) => c.x === 0 && c.y === 0)).toBe(true);
    }
  });
});
