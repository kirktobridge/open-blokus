/**
 * AE11 throughput bench: iters/s of each rollout policy on a fixed mid-opening
 * position, at the shipped rollout depth (0 = full). Deterministic iteration
 * count (no timer), so the policies are directly comparable and the measured
 * ratio is what "matched wall-clock" means for the AE11 arena: the slower policy
 * gets proportionally fewer iterations.
 *
 *   npx vite-node scripts/bench-rollout.ts
 */
import { createInitialState } from '../src/game/modes';
import { COLOR_ORDER } from '../src/game/types';
import { recomputeStuck, applyAndAdvance } from '../src/game/ai/simstate';
import { mulberry32, heuristicStrategy } from '../src/game/ai/arena';
import { mctsSearch, type MctsConfig } from '../src/game/ai/mcts';
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

const ITERS = 48;
const SEARCHES = 40;
const BASE = { iterations: ITERS, rolloutDepth: 0, beam: 16, rankRewardWeight: 0.25 };

const ARMS: Array<[string, Partial<MctsConfig>]> = [
  ['heuristic-6 (baseline)', { rolloutPolicy: 'heuristic', rolloutSamples: 6 }],
  ['heuristic-12', { rolloutPolicy: 'heuristic', rolloutSamples: 12 }],
  ['heuristic-24', { rolloutPolicy: 'heuristic', rolloutSamples: 24 }],
  ['heuristic-48', { rolloutPolicy: 'heuristic', rolloutSamples: 48 }],
  ['score-6', { rolloutPolicy: 'score', rolloutSamples: 6 }],
  ['softmax-6 T=8', { rolloutPolicy: 'softmax', rolloutSamples: 6, rolloutTemperature: 8 }],
  ['softmax-6 T=3', { rolloutPolicy: 'softmax', rolloutSamples: 6, rolloutTemperature: 3 }],
];

console.log(`position: 8 plies in, ${toMove} to move, branching=${branching}`);
console.log(`${SEARCHES}× ${ITERS}-iter searches, rolloutDepth=0, best-of-3\n`);

const results: Array<[string, number]> = [];
for (const [name, over] of ARMS) {
  const cfg = { ...BASE, ...over };
  for (let i = 0; i < 8; i++) mctsSearch(G, toMove, mulberry32(i), cfg); // warmup (JIT)
  let best = Infinity;
  for (let rep = 0; rep < 3; rep++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < SEARCHES; i++) mctsSearch(G, toMove, mulberry32(1000 + i), cfg);
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  results.push([name, (ITERS * SEARCHES) / best * 1000]);
}

const baseline = results[0][1];
console.log('| policy | iters/s | vs baseline | matched-clock iters (base 48) |');
console.log('|--------|---------|-------------|-------------------------------|');
for (const [name, ips] of results) {
  const ratio = ips / baseline;
  console.log(
    `| ${name} | ${ips.toFixed(0)} | ${ratio.toFixed(2)}× | ${Math.round(48 * ratio)} |`,
  );
}
