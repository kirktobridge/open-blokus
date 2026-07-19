import { describe, it, expect, afterEach } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { isLegalPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { generateLegalMoves } from '../src/game/moves';
import {
  mctsStrategy,
  mctsSearch,
  enableRolloutStats,
  getRolloutStats,
  rewardVector,
  DEFAULTS,
  type MctsNode,
} from '../src/game/ai/mcts';
import { chooseMove } from '../src/game/ai/heuristic';
import { remainingSquares } from '../src/game/scoring';
import { COLOR_ORDER } from '../src/game/types';

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

  it('leafValue mode returns a legal move without any rollouts', () => {
    const G = createInitialState(4);
    // Constant evaluator favoring blue: search still functions, no rollout runs.
    const move = mctsStrategy({ ...fast, leafValue: () => [0.7, 0.1, 0.1, 0.1] })(
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

// P37: opt-in rollout-sampling instrumentation. Verifies the counters are wired and
// zero-cost when off, and that width-48 rollouts to terminal do surface the
// sample-with-replacement waste the readout is meant to quantify.
describe('rollout-sampling instrumentation (P37)', () => {
  afterEach(() => enableRolloutStats(false)); // never leak global state to other tests

  it('reports null while disabled (the default hot path stays uninstrumented)', () => {
    expect(getRolloutStats()).toBeNull();
    const G = createInitialState(4);
    mctsStrategy({ ...fast, rolloutSamples: 48 })(G, 'blue', seededRng());
    expect(getRolloutStats()).toBeNull(); // a search did not turn it on
  });

  it('accumulates rollout-move and draw counts once enabled', () => {
    const G = createInitialState(4);
    enableRolloutStats(true);
    mctsStrategy({ ...fast, rolloutSamples: 48 })(G, 'blue', seededRng());
    const st = getRolloutStats()!;
    expect(st.moves).toBeGreaterThan(0);
    // Each non-null policy move draws rolloutSamples candidates.
    expect(st.samples).toBeGreaterThanOrEqual(st.moves);
    // Distinct + null can never exceed the draws taken (a consistency invariant).
    expect(st.distinct + st.nullSamples).toBeLessThanOrEqual(st.samples);
  });

  it('captures sample-with-replacement waste when width exceeds the legal-move count', () => {
    // Full rollouts (rolloutDepth 0) reach sparse endgame plies where far fewer than
    // 48 legal moves exist, so the 48-draw pool must repeat moves — the exact waste
    // the extreme-tier flip trades cycles for. Deterministic under the fixed seed.
    const G = createInitialState(4);
    enableRolloutStats(true);
    mctsStrategy({ iterations: 40, rolloutDepth: 0, beam: 6, rolloutSamples: 48 })(
      G,
      'blue',
      seededRng(),
    );
    const st = getRolloutStats()!;
    const duplicates = st.samples - st.nullSamples - st.distinct;
    expect(duplicates).toBeGreaterThan(0);
  });

  it('re-enabling resets the counters to zero', () => {
    const G = createInitialState(4);
    enableRolloutStats(true);
    mctsStrategy({ ...fast, rolloutSamples: 48 })(G, 'blue', seededRng());
    expect(getRolloutStats()!.samples).toBeGreaterThan(0);
    enableRolloutStats(true);
    expect(getRolloutStats()).toEqual({
      moves: 0,
      samples: 0,
      nullSamples: 0,
      distinct: 0,
      fallbacks: 0,
    });
  });
});

// P36: deploy F15's rank-normalized reward shaping as the base default so bare/advisor
// MCTS callers (not just the tiers, which already override it) fight for placement in a
// lost position and hand the advisor a non-degenerate value signal.
describe('reward-shaping default (P36/F15)', () => {
  it('ships rankRewardWeight 0.25 as the base MctsConfig default', () => {
    expect(DEFAULTS.rankRewardWeight).toBe(0.25);
  });

  it('gives losing colors a placement gradient winner-take-all leaves flat', () => {
    // Force a strictly-ordered final standing: drop nested supersets of pieces so each
    // successive color has strictly more placed squares (blue fewest → green most).
    const G = createInitialState(4);
    COLOR_ORDER.forEach((c, i) => {
      const rem = G.colors[c].remaining;
      G.colors[c].remaining = rem.slice(0, rem.length - i * 3);
    });
    const remaining = COLOR_ORDER.map((c) => remainingSquares(G.colors[c]));
    // Sanity: construction really did produce a strict placed ordering (green leads).
    expect(remaining[0]).toBeGreaterThan(remaining[1]);
    expect(remaining[1]).toBeGreaterThan(remaining[2]);
    expect(remaining[2]).toBeGreaterThan(remaining[3]);

    const shaped = rewardVector(G, DEFAULTS); // the shipped default
    const wta = rewardVector(G, { ...DEFAULTS, rankRewardWeight: 0 });

    // Winner-take-all: every non-leader is a flat 0 — no gradient between 2nd and 4th.
    expect(wta[3]).toBe(1); // green, the sole leader
    expect(wta[0]).toBe(0);
    expect(wta[1]).toBe(0);
    expect(wta[2]).toBe(0);

    // Shaped default: the standing is now a strict gradient the losers can climb.
    expect(shaped[3]).toBeGreaterThan(shaped[2]);
    expect(shaped[2]).toBeGreaterThan(shaped[1]);
    expect(shaped[1]).toBeGreaterThan(shaped[0]);
    // The middle losers, flat under winner-take-all, are now separated.
    expect(shaped[2]).toBeGreaterThan(0);
    expect(shaped[1]).toBeGreaterThan(0);
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
