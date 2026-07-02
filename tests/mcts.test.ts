import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { isLegalPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { generateLegalMoves } from '../src/game/moves';
import { mctsStrategy, mctsSearch, type MctsNode } from '../src/game/ai/mcts';
import { chooseMove } from '../src/game/ai/heuristic';

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

  it('time-budget mode returns a legal move', () => {
    const G = createInitialState(4);
    const move = mctsStrategy({ timeBudgetMs: 50, minIterations: 1, rolloutDepth: 4, beam: 6 })(
      G,
      'blue',
      seededRng(),
    );
    expect(move).not.toBeNull();
    expect(isLegalPlacement(G, 'blue', move!.pieceId, resolveCells(move!))).toBe(true);
  });

  it('falls back to the heuristic when too few iterations complete', () => {
    const G = createInitialState(4);
    // Tiny budget + huge trust threshold forces the fallback path; a constant rng
    // makes both the fallback and a direct chooseMove pick the same tie-break.
    const move = mctsStrategy({ timeBudgetMs: 1, minIterations: 1e9 })(G, 'blue', () => 0);
    expect(move).toEqual(chooseMove(G, 'blue', () => 0));
  });
});

describe('mctsSearch tree reuse', () => {
  it('re-roots onto a prior subtree and keeps its visit statistics', () => {
    const G = createInitialState(4);
    const first = mctsSearch(G, 'blue', seededRng(), {
      iterations: 500,
      rolloutDepth: 6,
      beam: 6,
    });
    expect(first.root).not.toBeNull();

    // Find an explored descendant that is again blue's turn (a plausible "our next
    // turn" position reached after the opponents reply).
    const target = findByMover(first.root!, 0);
    expect(target, 'expected an explored blue-turn descendant').not.toBeNull();
    const priorN = target!.N;
    expect(priorN).toBeGreaterThan(0);

    const second = mctsSearch(target!.G, 'blue', seededRng(), { iterations: 40, beam: 8 }, first.root);
    // Reuse: the search rooted at the very same node object, stats carried over.
    expect(second.root).toBe(target);
    expect(second.root!.N).toBeGreaterThan(priorN);
    expect(second.move).not.toBeNull();
  });

  it('starts fresh when the position is not in the prior tree', () => {
    const G = createInitialState(4);
    const first = mctsSearch(G, 'blue', seededRng(), { iterations: 30, beam: 6 });
    // A different, unrelated position (yellow has opened elsewhere) won't match.
    const other = createInitialState(4);
    other.board[other.board.length - 1] = 'yellow';
    const second = mctsSearch(other, 'blue', seededRng(), { iterations: 20, beam: 6 }, first.root);
    expect(second.root).not.toBe(first.root);
    expect(second.move).not.toBeNull();
  });
});

/** BFS a tree (depth ≤ 4) for a visited descendant whose mover index is `moverIdx`. */
function findByMover(root: MctsNode, moverIdx: number): MctsNode | null {
  let frontier = root.children;
  for (let d = 1; d <= 4; d++) {
    for (const n of frontier) if (n.moverIdx === moverIdx && n.N > 0) return n;
    frontier = frontier.flatMap((n) => n.children);
    if (frontier.length === 0) break;
  }
  return null;
}

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
