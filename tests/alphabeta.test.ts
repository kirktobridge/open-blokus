import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { isLegalPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { COLOR_ORDER } from '../src/game/types';
import { mulberry32, runTournament, randomStrategy } from '../src/game/ai/arena';
import { alphaBetaStrategy } from '../src/game/ai/alphabeta';

describe('alphaBetaStrategy', () => {
  it('returns a legal move and does not mutate the live state', () => {
    const G = createInitialState(4);
    const snapshot = JSON.stringify(G);
    const move = alphaBetaStrategy({ depth: 2, beam: 6 })(G, 'blue', mulberry32(1));
    expect(move).not.toBeNull();
    expect(isLegalPlacement(G, 'blue', move!.pieceId, resolveCells(move!))).toBe(true);
    // Search clones state; the live G must be untouched.
    expect(JSON.stringify(G)).toBe(snapshot);
  });

  it('is deterministic with a fixed tie-break rng', () => {
    const G = createInitialState(4);
    const ab = alphaBetaStrategy({ depth: 2, beam: 6 });
    expect(ab(G, 'blue', () => 0)).toEqual(ab(G, 'blue', () => 0));
  });

  it('eval ordering also yields a legal move', () => {
    const G = createInitialState(4);
    const move = alphaBetaStrategy({ depth: 2, beam: 4, ordering: 'eval' })(G, 'blue', () => 0);
    expect(move).not.toBeNull();
    expect(isLegalPlacement(G, 'blue', move!.pieceId, resolveCells(move!))).toBe(true);
  });

  it('crushes random (sanity floor)', () => {
    const r = runTournament(
      [
        { name: 'ab', strategy: alphaBetaStrategy({ depth: 2, beam: 4 }) },
        { name: 'random', strategy: randomStrategy },
        { name: 'ab', strategy: alphaBetaStrategy({ depth: 2, beam: 4 }) },
        { name: 'random', strategy: randomStrategy },
      ],
      { games: 5, seed: 2 },
    );
    expect(r.wins.ab / r.games).toBeGreaterThan(0.85);
    expect(COLOR_ORDER.length).toBe(4);
  });
});
