import { describe, it, expect } from 'vitest';
import { createInitialState, CORNERS } from '../src/game/modes';
import { isLegalPlacement, applyPlacement } from '../src/game/placement';
import { getOrientations } from '../src/game/pieces';
import { BOARD_SIZE } from '../src/game/board';
import { COLOR_ORDER } from '../src/game/types';
import type { Cell, Color, GameState } from '../src/game/types';
import { mulberry32 } from '../src/game/ai/arena';
import { buildBitBoards, bbLegal, bbApply, cloneBitBoards } from '../src/game/bitboard';

/**
 * AE9 differential test (pre-registered hard gate): the bitboard legality path
 * must be byte-identical to the reference `isLegalPlacement` scan for every
 * piece × orientation × position across many reachable positions — both from a
 * freshly built board and from an incrementally maintained one (the rollout path).
 */

interface OracleMove {
  pieceId: import('../src/game/types').PieceId;
  cells: Cell[];
}

/** Full-board scan of all candidate placements (legal or not) for a color. */
function allCandidates(G: GameState, color: Color): OracleMove[] {
  const out: OracleMove[] = [];
  for (const pieceId of G.colors[color].remaining) {
    for (const base of getOrientations(pieceId)) {
      let maxX = 0;
      let maxY = 0;
      for (const c of base) {
        if (c.x > maxX) maxX = c.x;
        if (c.y > maxY) maxY = c.y;
      }
      for (let y = 0; y <= BOARD_SIZE - 1 - maxY; y++) {
        for (let x = 0; x <= BOARD_SIZE - 1 - maxX; x++) {
          out.push({ pieceId, cells: base.map((c) => ({ x: c.x + x, y: c.y + y })) });
        }
      }
    }
  }
  return out;
}

function legalOracleMoves(G: GameState, color: Color): OracleMove[] {
  return allCandidates(G, color).filter((m) => isLegalPlacement(G, color, m.pieceId, m.cells));
}

function randomPosition(seed: number, plies: number): GameState {
  const rng = mulberry32(seed);
  const G = createInitialState(4);
  for (let p = 0; p < plies; p++) {
    const color = COLOR_ORDER[p % COLOR_ORDER.length];
    const moves = legalOracleMoves(G, color);
    if (moves.length === 0) continue;
    const m = moves[(rng() * moves.length) | 0];
    applyPlacement(G, color, m.pieceId, m.cells);
  }
  return G;
}

describe('bitboard legality (AE9) vs isLegalPlacement reference', () => {
  it('agrees on every candidate across many reachable positions (freshly built)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 8; seed++) {
      for (const plies of [0, 3, 6, 9, 12, 15]) {
        const G = randomPosition(seed, plies);
        const bb = buildBitBoards(G);
        for (const color of COLOR_ORDER) {
          const hasStarted = G.colors[color].hasStarted;
          const corner = CORNERS[color];
          for (const m of allCandidates(G, color)) {
            const ref = isLegalPlacement(G, color, m.pieceId, m.cells);
            const fast = bbLegal(bb, color, m.cells, hasStarted, corner);
            if (ref !== fast) {
              throw new Error(
                `mismatch seed=${seed} plies=${plies} ${color} ${m.pieceId} ` +
                  `cells=${JSON.stringify(m.cells)} ref=${ref} fast=${fast}`,
              );
            }
            checked++;
          }
        }
      }
    }
    // Sanity: the sweep actually exercised a large number of candidates.
    expect(checked).toBeGreaterThan(100_000);
  });

  it('incrementally maintained bitboards match a freshly built one (rollout path)', () => {
    // Mirror what the rollout does: build once, then bbApply each move instead of
    // rebuilding. After each ply the incremental board must equal a fresh rebuild,
    // and its legality verdicts must still match the reference.
    for (let seed = 20; seed <= 25; seed++) {
      const rng = mulberry32(seed);
      const G = createInitialState(4);
      const bb = buildBitBoards(G);
      for (let p = 0; p < 16; p++) {
        const color = COLOR_ORDER[p % COLOR_ORDER.length];
        // Verify incremental bb against reference for a sample of candidates.
        const hasStarted = G.colors[color].hasStarted;
        const corner = CORNERS[color];
        const cands = allCandidates(G, color);
        for (let k = 0; k < cands.length; k += 7) {
          const m = cands[k];
          expect(bbLegal(bb, color, m.cells, hasStarted, corner)).toBe(
            isLegalPlacement(G, color, m.pieceId, m.cells),
          );
        }
        const moves = legalOracleMoves(G, color);
        if (moves.length === 0) continue;
        const m = moves[(rng() * moves.length) | 0];
        applyPlacement(G, color, m.pieceId, m.cells);
        bbApply(bb, color, m.cells);
        // Incremental board must match a from-scratch rebuild, occ + own bits.
        const fresh = buildBitBoards(G);
        for (const c of COLOR_ORDER) {
          expect(Array.from(bb.own[c])).toEqual(Array.from(fresh.own[c]));
        }
        expect(Array.from(bb.occ)).toEqual(Array.from(fresh.occ));
      }
    }
  });

  it('cloneBitBoards produces an independent copy', () => {
    const G = randomPosition(3, 8);
    const bb = buildBitBoards(G);
    const clone = cloneBitBoards(bb);
    bbApply(clone, 'blue', [{ x: 10, y: 10 }]);
    expect(Array.from(clone.occ)).not.toEqual(Array.from(bb.occ));
  });
});
