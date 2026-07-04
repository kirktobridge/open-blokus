/**
 * AE2/AE9 profiling probe: where does a single 150-iter MCTS move spend its time?
 * Builds a representative mid-opening position (highest branching, the case the
 * time budget struggles with), CPU-profiles one plain-UCT search, and buckets
 * self-time by phase (move-gen vs rollout vs selection/backprop). Non-invasive:
 * uses node:inspector, no engine changes.
 *
 *   npx vite-node scripts/profile-mcts.ts
 */
import { Session } from 'node:inspector';
import { promisify } from 'node:util';
import { createInitialState } from '../src/game/modes';
import { COLOR_ORDER } from '../src/game/types';
import { recomputeStuck, applyAndAdvance } from '../src/game/ai/simstate';
import { mulberry32, heuristicStrategy } from '../src/game/ai/arena';
import { mctsSearch } from '../src/game/ai/mcts';
import { generateLegalMoves } from '../src/game/moves';

// --- build a mid-opening position: 8 heuristic plies in (2 per color) ---------
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

// --- CPU-profile one 150-iter plain-UCT search --------------------------------
async function main() {
  const session = new Session();
  session.connect();
  const post = promisify(session.post.bind(session)) as (m: string, p?: object) => Promise<any>;
  await post('Profiler.enable');
  await post('Profiler.setSamplingInterval', { interval: 50 }); // 50µs, fine-grained
  await post('Profiler.start');

  const t0 = Date.now();
  const REPS = 20; // repeat the search so the profile has enough samples
  for (let i = 0; i < REPS; i++) {
    mctsSearch(G, toMove, mulberry32(1000 + i), { iterations: 150, rolloutDepth: 12, beam: 16 });
  }
  const elapsed = Date.now() - t0;

  const { profile } = await post('Profiler.stop');
  session.disconnect();

  // --- aggregate self-time by function name ----------------------------------
  const interval = profile.timeDeltas ? null : null;
  const selfById = new Map<number, number>();
  // self-time = number of samples whose leaf is this node, weighted by timeDelta
  const idToNode = new Map<number, any>();
  for (const n of profile.nodes) idToNode.set(n.id, n);
  const hitSelf = new Map<number, number>(); // nodeId -> summed µs
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    const dt = profile.timeDeltas[i] ?? 0;
    hitSelf.set(id, (hitSelf.get(id) ?? 0) + dt);
  }
  const byFn = new Map<string, number>();
  for (const [id, us] of hitSelf) {
    const node = idToNode.get(id);
    const fn = node?.callFrame?.functionName || '(anonymous)';
    const url = node?.callFrame?.url || '';
    const key = url.includes('/src/') ? fn : `${fn} «${url.split('/').pop() || 'native'}»`;
    byFn.set(key, (byFn.get(key) ?? 0) + us);
  }

  const total = [...byFn.values()].reduce((a, b) => a + b, 0);
  const rows = [...byFn.entries()].sort((a, b) => b[1] - a[1]);

  // --- phase buckets ---------------------------------------------------------
  const buckets: Record<string, RegExp> = {
    'move-gen': /generateLegalMoves|scorePlacement|hasAnyMove|cornersFor|WEIGHTS/,
    rollout: /rollout|sampleLegalMove|fallbackMove|isLegalPlacement|applyPlacement|getOrientations|resolveCells|cloneState|rewardVector|remainingSquares/,
    'tree/backprop': /selectChild|treePolicy|untriedMoves|backprop|makeNode|isTerminal|applyAndAdvance/,
  };
  const bucketTot: Record<string, number> = { 'move-gen': 0, rollout: 0, 'tree/backprop': 0, other: 0 };
  for (const [fn, us] of byFn) {
    let hit = false;
    for (const [b, re] of Object.entries(buckets)) {
      if (re.test(fn)) {
        bucketTot[b] += us;
        hit = true;
        break;
      }
    }
    if (!hit) bucketTot.other += us;
  }

  console.log(`\nPosition: 8 plies in, ${toMove} to move, branching = ${branching} legal moves`);
  console.log(`${REPS}× 150-iter searches in ${elapsed}ms (${(elapsed / REPS).toFixed(0)}ms/search)`);
  console.log(`\nPhase breakdown (self-time, ${(total / 1000).toFixed(0)}ms sampled):`);
  for (const [b, us] of Object.entries(bucketTot).sort((a, b2) => b2[1] - a[1])) {
    const pct = (100 * us) / total;
    console.log(`  ${b.padEnd(14)} ${pct.toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(pct / 2))}`);
  }
  console.log(`\nTop 18 functions by self-time:`);
  for (const [fn, us] of rows.slice(0, 18)) {
    console.log(`  ${((100 * us) / total).toFixed(1).padStart(5)}%  ${fn}`);
  }
}
main();
