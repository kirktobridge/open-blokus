/**
 * AE9 throughput bench: iters/s of the MCTS engine on a fixed mid-opening
 * position. Deterministic iteration count (no timer), so before/after are
 * directly comparable. Run on new code, `git stash`, run again for the baseline.
 *
 *   npx vite-node scripts/bench-mcts.ts
 */
import { createInitialState } from '../src/game/modes';
import { COLOR_ORDER } from '../src/game/types';
import { recomputeStuck, applyAndAdvance } from '../src/game/ai/simstate';
import { mulberry32, heuristicStrategy } from '../src/game/ai/arena';
import { mctsSearch } from '../src/game/ai/mcts';
import { generateLegalMoves } from '../src/game/moves';

const rng = mulberry32(42);
let G = createInitialState(4);
recomputeStuck(G);
const heur = heuristicStrategy();
for (let ply = 0; ply < 8; ply++) {
  const idx = G.activeColorIndex;
  const m = heur(G, COLOR_ORDER[idx], rng);
  if (m) G = applyAndAdvance(G, idx, m);
}
const toMove = COLOR_ORDER[G.activeColorIndex];
const branching = generateLegalMoves(G, toMove).length;

const ITERS = 150;
const SEARCHES = 60;
// warmup (JIT)
for (let i = 0; i < 10; i++) mctsSearch(G, toMove, mulberry32(i), { iterations: ITERS, rolloutDepth: 12, beam: 16 });

let best = Infinity;
for (let rep = 0; rep < 3; rep++) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < SEARCHES; i++) {
    mctsSearch(G, toMove, mulberry32(1000 + i), { iterations: ITERS, rolloutDepth: 12, beam: 16 });
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  best = Math.min(best, ms);
}
const totalIters = ITERS * SEARCHES;
console.log(`position: 8 plies in, ${toMove} to move, branching=${branching}`);
console.log(`${SEARCHES}× ${ITERS}-iter searches, best-of-3: ${best.toFixed(0)}ms`);
console.log(`iters/s = ${((totalIters / best) * 1000).toFixed(0)}`);
console.log(`ms/search = ${(best / SEARCHES).toFixed(2)}`);
