import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { isLegalPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { generateLegalMoves } from '../src/game/moves';
import { mctsStrategy } from '../src/game/ai/mcts';

// MCTS is expensive; keep the unit config tiny. Strength (vs heuristic/random)
// is validated in the benchmark / Run H, not here.
const fast = { iterations: 15, rolloutDepth: 3, beam: 5 } as const;

describe('mctsStrategy', () => {
  it('returns a legal move without mutating the live state', () => {
    const G = createInitialState(4);
    const snapshot = JSON.stringify(G);
    const move = mctsStrategy(fast)(G, 'blue', seededRng());
    expect(move).not.toBeNull();
    expect(isLegalPlacement(G, 'blue', move!.pieceId, resolveCells(move!))).toBe(true);
    expect(JSON.stringify(G)).toBe(snapshot);
  });

  it('picks a move from the current legal set', () => {
    const G = createInitialState(4);
    const move = mctsStrategy(fast)(G, 'blue', seededRng());
    const legal = generateLegalMoves(G, 'blue');
    expect(legal.some((m) => m.pieceId === move!.pieceId)).toBe(true);
  });

  it('is deterministic under identical rng streams', () => {
    const G = createInitialState(4);
    expect(mctsStrategy(fast)(G, 'blue', seededRng())).toEqual(
      mctsStrategy(fast)(G, 'blue', seededRng()),
    );
  });
});

/** A fixed-seed mulberry32 stream so two runs draw identically. */
function seededRng(): () => number {
  let a = 777 >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
