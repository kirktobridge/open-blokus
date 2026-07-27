/**
 * AE30 Phase 1 — measurement: does the Classic-tuned `beam ≈ iters/6` ratio (F8)
 * still hold on Duo's 14×14 two-color board?
 *
 * Two inputs to that ratio move at once in Duo, in the same direction (see the AE30
 * backlog entry): branching collapses, *and* the ms-budgeted tiers therefore complete
 * more iterations per move. Both push `iters/beam` up, so medium/hard may be
 * **under**-beamed — the mirror image of F8's original break.
 *
 * This script measures both, on Classic and Duo, from the same code path:
 *   1. branching factor by ply, over a heuristic self-play trace (cheap, full game);
 *   2. iterations completed per move for the ms-budgeted tiers (medium 500 ms,
 *      hard 2000 ms) at probe plies, read off the searched root's visit count;
 *   3. wall-clock per move for `extreme` (fixed 500 iters, so its iters/beam is 25 by
 *      construction on either variant — informational, for F20 context only).
 *
 * Phase 2 (the beam sweep arena) fires only if the ratio drifted >2×.
 *
 *   npx vite-node scripts/experiments/ae30-phase1.ts
 */
import { createInitialState, colorStateOf, playColorsOf, VARIANTS } from '../../src/game/modes';
import type { Color, GameMode, GameState, Variant } from '../../src/game/types';
import { generateLegalMoves } from '../../src/game/moves';
import { applyPlacement } from '../../src/game/placement';
import { resolveCells } from '../../src/game/pieces';
import { cloneState } from '../../src/game/ai/simstate';
import { mulberry32, heuristicStrategy } from '../../src/game/ai/arena';
import { mctsSearch } from '../../src/game/ai/mcts';
import { mctsConfigFor } from '../../src/client/ai/difficulty';

// --- run parameters -----------------------------------------------------------
const SEEDS = [42, 43, 44];
/** Plies to probe search throughput at. Skipped when a game ends earlier. */
const PROBE_PLIES = [4, 8, 12, 16, 20, 24];
/** `extreme` has no time budget and costs ~10 s/move; probe it sparsely. */
const EXTREME_PROBE_PLIES = [8, 16];

/** The variant's fullest seating — Classic 4p, Duo 2p (mirrors arena.maxMode). */
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

interface Trace {
  /** branching[ply] = legal moves available to the color that moved at that ply. */
  branching: number[];
  /** Position snapshots at PROBE_PLIES, for the search-throughput probes. */
  snapshots: Map<number, { G: GameState; color: Color }>;
}

/** One heuristic self-play game, recording branching by ply + probe snapshots. */
function traceGame(variant: Variant, seed: number): Trace {
  const G = createInitialState(maxMode(variant), 'basic', variant);
  const play = playColorsOf(G);
  const rng = mulberry32(seed);
  const heur = heuristicStrategy();
  const branching: number[] = [];
  const snapshots = new Map<number, { G: GameState; color: Color }>();
  const probe = new Set([...PROBE_PLIES, ...EXTREME_PROBE_PLIES]);

  let live = play.length;
  let ply = 0;
  while (live > 0) {
    const color = play[G.activeColorIndex];
    const n = generateLegalMoves(G, color).length;
    if (n > 0) {
      branching.push(n);
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
  return { branching, snapshots };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');

interface TierProbe {
  tier: string;
  beam: number;
  /** Iterations completed (root visits) per probed move. */
  iters: number[];
  /** Wall-clock ms per probed move. */
  ms: number[];
}

function measure(variant: Variant) {
  const traces = SEEDS.map((s) => traceGame(variant, s));

  // --- 1. branching by ply ----------------------------------------------------
  const maxPly = Math.max(...traces.map((t) => t.branching.length));
  const byPly: number[][] = Array.from({ length: maxPly }, () => []);
  for (const t of traces) t.branching.forEach((n, i) => byPly[i].push(n));

  const peak = Math.max(...byPly.map((xs) => mean(xs)));
  const peakPly = byPly.findIndex((xs) => mean(xs) === peak);

  // --- 2/3. search throughput at probe plies ----------------------------------
  const probes: TierProbe[] = [];
  for (const tier of ['medium', 'hard', 'extreme'] as const) {
    const cfg = mctsConfigFor(tier);
    const plies = tier === 'extreme' ? EXTREME_PROBE_PLIES : PROBE_PLIES;
    const p: TierProbe = { tier, beam: cfg.beam!, iters: [], ms: [] };
    for (const ply of plies) {
      for (const [si, t] of traces.entries()) {
        const snap = t.snapshots.get(ply);
        if (!snap) continue; // game ended before this ply
        const t0 = Date.now();
        const { root } = mctsSearch(snap.G, snap.color, mulberry32(9000 + si), cfg);
        p.ms.push(Date.now() - t0);
        p.iters.push(root?.N ?? 0);
      }
    }
    probes.push(p);
  }

  return { variant, traces, byPly, peak, peakPly, probes };
}

// --- report -------------------------------------------------------------------
console.log(`AE30 Phase 1 — branching + search throughput, seeds ${SEEDS.join('/')}\n`);

const results = (['classic', 'duo'] as const).map((v) => {
  console.log(`--- ${v} (${maxMode(v)}p, ${VARIANTS[v].boardSize}×${VARIANTS[v].boardSize}) ---`);
  const r = measure(v);
  const lens = r.traces.map((t) => t.branching.length);
  console.log(`game length: ${fmt(mean(lens), 0)} plies (${Math.min(...lens)}–${Math.max(...lens)})`);
  console.log(`branching: peak ${fmt(r.peak, 0)} @ ply ${r.peakPly}, mean ${fmt(mean(r.byPly.flat()), 0)}`);
  const buckets = [0, 8, 16, 24, 32];
  const line = buckets
    .map((b, i) => {
      const hi = buckets[i + 1] ?? r.byPly.length;
      return `${b}-${hi - 1}: ${fmt(mean(r.byPly.slice(b, hi).flat()), 0)}`;
    })
    .join('  ');
  console.log(`branching by ply-bucket: ${line}`);
  console.log(`\n  tier      beam  iters/move  ms/move   iters/beam  vs F8 (6)`);
  for (const p of r.probes) {
    const it = mean(p.iters);
    const ratio = it / p.beam;
    console.log(
      `  ${p.tier.padEnd(9)} ${String(p.beam).padStart(4)}  ${fmt(it, 0).padStart(10)}  ` +
        `${fmt(mean(p.ms), 0).padStart(7)}   ${fmt(ratio, 1).padStart(10)}   ${fmt(ratio / 6, 2)}×`,
    );
  }
  console.log('');
  return r;
});

// --- drift verdict (the Phase-2 gate) -----------------------------------------
const [classic, duo] = results;
console.log('--- Phase-2 gate: iters/beam drift, Duo vs Classic (fires at >2×) ---');
let fires = false;
for (const [i, p] of duo.probes.entries()) {
  const c = classic.probes[i];
  const drift = mean(p.iters) / p.beam / (mean(c.iters) / c.beam);
  if (p.tier !== 'extreme' && drift > 2) fires = true;
  console.log(`  ${p.tier.padEnd(9)} ${fmt(drift, 2)}×${p.tier === 'extreme' ? '  (informational — fixed iters)' : ''}`);
}
console.log(`\nPhase 2 (beam sweep on Duo): ${fires ? 'FIRES' : 'does not fire'}`);
