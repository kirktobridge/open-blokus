/**
 * AE33 Phase 1 — latency budget: which Duo `extreme` iteration counts fit under the
 * pre-registered p95 move-time cap?
 *
 * The cap is **6000 ms/move (p95)**, fixed in the AE33 backlog entry *before* this ran
 * (M2) — parity with `extreme`'s measured Classic cost (5973 ms/move, Run Y phase 1).
 * Phase 2 may only sweep arms that clear it; an arm that wins by taking 30 s/move is
 * not shippable, and moving this line after seeing the results is the failure M2 names.
 *
 * Measures wall-clock per move for the candidate grid — iterations {500 (control),
 * 1000, 1500, 2000} × rolloutSamples {6, 48} — over probe plies of Duo heuristic
 * self-play traces. Everything else is held at the shipped `extreme` config
 * (beam 20, rolloutDepth 0, minIterations 8, rankRewardWeight 0.25).
 *
 * Trace construction mirrors ae30-phase1.ts ('basic' scoring, heuristic self-play) so
 * the 500/48 control is directly comparable to Run Y's 1549 ms — a latency measurement
 * whose control doesn't reproduce is a broken harness, not a result.
 *
 *   npx vite-node scripts/experiments/ae33-phase1.ts
 */
import { createInitialState, colorStateOf, playColorsOf, VARIANTS } from '../../src/game/modes';
import type { Color, GameMode, GameState, Variant } from '../../src/game/types';
import { generateLegalMoves } from '../../src/game/moves';
import { applyPlacement } from '../../src/game/placement';
import { resolveCells } from '../../src/game/pieces';
import { cloneState } from '../../src/game/ai/simstate';
import { mulberry32, heuristicStrategy } from '../../src/game/ai/arena';
import { mctsSearch } from '../../src/game/ai/mcts';

// --- run parameters -----------------------------------------------------------
const VARIANT: Variant = 'duo';
const SEEDS = [42, 43, 44];
/** Probe plies. Spread across the game so p95 sees the branchy early plies. */
const PROBE_PLIES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
/** The pre-registered cap (criterion (b)). Not tunable from here. */
const CAP_P95_MS = 6000;

const ITER_GRID = [500, 1000, 1500, 2000];
const SAMPLE_GRID = [6, 48];
/** Held fixed at the shipped `extreme` config — this phase moves iterations only. */
const BASE = { beam: 20, rolloutDepth: 0, minIterations: 8, rankRewardWeight: 0.25 };

const maxMode = (v: Variant): GameMode =>
  VARIANTS[v].modes.reduce((a, b) => (b > a ? b : a));

/** Mirrors arena.advanceActiveColor / BlokusGame.advanceActiveColor (not exported). */
function advanceActiveColor(G: GameState): void {
  const play = playColorsOf(G);
  for (let step = 1; step <= play.length; step++) {
    const i = (G.activeColorIndex + step) % play.length;
    if (!colorStateOf(G, play[i]).stuck) {
      G.activeColorIndex = i;
      return;
    }
  }
}

/** One heuristic self-play game, recording probe snapshots by ply. */
function traceGame(variant: Variant, seed: number): Map<number, { G: GameState; color: Color }> {
  const G = createInitialState(maxMode(variant), 'basic', variant);
  const play = playColorsOf(G);
  const rng = mulberry32(seed);
  const heur = heuristicStrategy();
  const snapshots = new Map<number, { G: GameState; color: Color }>();
  const probe = new Set(PROBE_PLIES);

  let live = play.length;
  let ply = 0;
  while (live > 0) {
    const color = play[G.activeColorIndex];
    const n = generateLegalMoves(G, color).length;
    if (n > 0) {
      if (probe.has(ply)) snapshots.set(ply, { G: cloneState(G), color });
      const move = heur(G, color, rng)!;
      applyPlacement(G, color, move.pieceId, resolveCells(move));
      ply++;
    } else {
      colorStateOf(G, color).stuck = true;
      live--;
    }
    advanceActiveColor(G);
  }
  return snapshots;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
/** Nearest-rank p95 — the criterion-(b) statistic. */
const p95 = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};
const fmt = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '—');

// --- measure ------------------------------------------------------------------
console.log(
  `AE33 Phase 1 — Duo \`extreme\` move-time vs the ${CAP_P95_MS} ms p95 cap\n` +
    `variant ${VARIANT} (${maxMode(VARIANT)}p, ${VARIANTS[VARIANT].boardSize}×${VARIANTS[VARIANT].boardSize}), ` +
    `seeds ${SEEDS.join('/')}, probe plies ${PROBE_PLIES.join(',')}\n`,
);

const traces = SEEDS.map((s) => traceGame(VARIANT, s));
const nProbes = traces.reduce((a, t) => a + PROBE_PLIES.filter((p) => t.has(p)).length, 0);
console.log(`probe positions reached: ${nProbes} (of ${SEEDS.length * PROBE_PLIES.length} planned)\n`);

interface Arm {
  iterations: number;
  rolloutSamples: number;
  ms: number[];
}
const arms: Arm[] = [];

for (const iterations of ITER_GRID) {
  for (const rolloutSamples of SAMPLE_GRID) {
    const arm: Arm = { iterations, rolloutSamples, ms: [] };
    const cfg = { ...BASE, iterations, rolloutSamples };
    for (const [si, t] of traces.entries()) {
      for (const ply of PROBE_PLIES) {
        const snap = t.get(ply);
        if (!snap) continue; // game ended before this ply
        const t0 = Date.now();
        mctsSearch(snap.G, snap.color, mulberry32(9000 + si), cfg);
        arm.ms.push(Date.now() - t0);
      }
    }
    arms.push(arm);
    console.log(
      `  iters ${String(iterations).padStart(4)}  samples ${String(rolloutSamples).padStart(2)}  ` +
        `mean ${fmt(mean(arm.ms)).padStart(6)} ms   p95 ${fmt(p95(arm.ms)).padStart(6)} ms   ` +
        `max ${fmt(Math.max(...arm.ms)).padStart(6)} ms   ${p95(arm.ms) <= CAP_P95_MS ? 'PASS' : 'OVER CAP'}`,
    );
  }
}

// --- control check + phase-2 admission ----------------------------------------
const control = arms.find((a) => a.iterations === 500 && a.rolloutSamples === 48)!;
console.log(
  `\ncontrol (500 iters, samples 48): mean ${fmt(mean(control.ms))} ms ` +
    `— Run Y phase 1 measured 1549 ms/move; a large divergence means the harness moved, not the tier.`,
);

const admitted = arms.filter((a) => a.iterations !== 500 && p95(a.ms) <= CAP_P95_MS);
console.log(`\n--- Phase 2 admission (p95 ≤ ${CAP_P95_MS} ms) ---`);
if (!admitted.length) {
  console.log(
    '  NO candidate arm clears the cap. Per the AE33 entry that is not a licence to raise\n' +
      '  the cap — it is the "collapse the Duo ladder to three tiers" product decision.',
  );
} else {
  for (const a of admitted) console.log(`  iters ${a.iterations}  samples ${a.rolloutSamples}`);
}
