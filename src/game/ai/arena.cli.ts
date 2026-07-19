/**
 * CPU-strategy benchmark runner.  `npm run arena [games] [seeds] [baseSeed]`
 *
 * Each table averages over `seeds` independent seeds and reports mean ± std of
 * the per-seat win rate, so noise (which once made frontier=6 look good on a
 * single seed but not across seeds) can't mislead a tuning call.
 */
import { readFileSync } from 'node:fs';
import {
  runTournamentSeeds,
  randomStrategy,
  greedySizeStrategy,
  heuristicStrategy,
  type Contestant,
} from './arena';
import { alphaBetaStrategy } from './alphabeta';
import { mctsStrategy, enableRolloutStats, getRolloutStats, type MctsConfig } from './mcts';
import { WEIGHTS, type Weights } from './heuristic';
import { valueNetProbs, type ValueNetWeights } from './valuenet';
import { COLOR_ORDER } from '../types';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flagArgs = process.argv.slice(2).filter((a) => a.startsWith('--'));
const flags = new Set(flagArgs);
const games = Number(args[0] ?? 100);
const seeds = Number(args[1] ?? 8);
const baseSeed = Number(args[2] ?? 1);

function table(
  title: string,
  contestants: Contestant[],
  g: number = games,
  s: number = seeds,
): void {
  const r = runTournamentSeeds(contestants, { games: g, seeds: s, baseSeed });
  // `--result`: one machine-readable line per name for shard pooling — the human
  // table rounds game-share to a whole percent, which loses the fractional wins
  // (ties split) that the stats helper needs. Emitted alongside the table.
  if (flags.has('--result')) {
    const n = g * s;
    for (const row of r.rows) {
      console.log(
        `RESULT\t${row.name}\t${(row.meanGameShare * n).toFixed(4)}\t${n}\t` +
          `${row.meanPlacement.toFixed(4)}\t${row.meanPlacedSquares.toFixed(4)}`,
      );
    }
  }
  console.log(
    `\n${title}  (${s}×${g} games, base seed ${baseSeed}, mean ties ${r.meanTies.toFixed(1)})`,
  );
  for (const row of r.rows) {
    const bar = '█'.repeat(Math.round(row.meanRate * 40));
    console.log(
      `  ${row.name.padEnd(18)} ${(row.meanRate * 100).toFixed(1).padStart(5)}% ` +
        `±${(row.stdRate * 100).toFixed(1).padStart(4)}  ` +
        `game-share ${(row.meanGameShare * 100).toFixed(0).padStart(3)}%  ` +
        `place ${row.meanPlacement.toFixed(2)}±${row.stdPlacement.toFixed(2)}  ` +
        `placed ${row.meanPlacedSquares.toFixed(1).padStart(4)}±${row.stdPlacedSquares.toFixed(1)}  ${bar}`,
    );
  }
}

const variant = (over: Partial<Weights>): Weights => ({ ...WEIGHTS, ...over });

// 0. Experiment config (`--config=scripts/experiments/<id>.json`): build the
// table from JSON instead of editing the hardcoded ones below, so experiment
// setups live outside src/ and each run is reproducible from its config file.
// Runs only that table, then exits; games/seeds default to the CLI args.
interface SeatConfig {
  name: string;
  strategy: 'random' | 'greedy-size' | 'heuristic' | 'alphabeta' | 'mcts';
  options?: Record<string, unknown>;
}
interface ExperimentConfig {
  title: string;
  seats: SeatConfig[];
  games?: number;
  seeds?: number;
}

function buildStrategy(seat: SeatConfig): Contestant['strategy'] {
  switch (seat.strategy) {
    case 'random':
      return randomStrategy;
    case 'greedy-size':
      return greedySizeStrategy;
    case 'heuristic':
      return heuristicStrategy(
        seat.options ? variant(seat.options as Partial<Weights>) : undefined,
      );
    case 'alphabeta':
      return alphaBetaStrategy(seat.options as Parameters<typeof alphaBetaStrategy>[0]);
    case 'mcts': {
      // `netWeights: <path>` (AE4): load a value net and inject it as the leaf
      // evaluator — JSON configs can't hold functions, so the wiring lives here.
      const { netWeights, ...rest } = (seat.options ?? {}) as Partial<MctsConfig> & {
        netWeights?: string;
      };
      if (typeof netWeights === 'string') {
        const w = JSON.parse(readFileSync(netWeights, 'utf8')) as ValueNetWeights;
        rest.leafValue = (G) => valueNetProbs(G, COLOR_ORDER[G.activeColorIndex], w);
      }
      return mctsStrategy(rest);
    }
  }
}

const configFlag = flagArgs.find((f) => f.startsWith('--config='));
if (configFlag) {
  const cfg = JSON.parse(
    readFileSync(configFlag.slice('--config='.length), 'utf8'),
  ) as ExperimentConfig;
  table(
    cfg.title,
    cfg.seats.map((s) => ({ name: s.name, strategy: buildStrategy(s) })),
    cfg.games ?? games,
    cfg.seeds ?? seeds,
  );
  process.exit(0);
}

// 1. Baselines: random vs size-greedy vs full heuristic.
table('Baselines', [
  { name: 'random', strategy: randomStrategy },
  { name: 'greedy-size', strategy: greedySizeStrategy },
  { name: 'heuristic', strategy: heuristicStrategy() },
  { name: 'greedy-size#2', strategy: greedySizeStrategy },
]);

// 2. Heuristic vs size-greedy head-to-head (2 seats each).
table('Heuristic vs greedy-size', [
  { name: 'heuristic', strategy: heuristicStrategy() },
  { name: 'greedy-size', strategy: greedySizeStrategy },
  { name: 'heuristic', strategy: heuristicStrategy() },
  { name: 'greedy-size', strategy: greedySizeStrategy },
]);

// 3. Weight ablation: does each term earn its keep vs the full heuristic?
table('Weight ablation', [
  { name: 'full', strategy: heuristicStrategy(WEIGHTS) },
  { name: 'no-block', strategy: heuristicStrategy(variant({ block: 0 })) },
  { name: 'no-center', strategy: heuristicStrategy(variant({ center: 0 })) },
  { name: 'no-frontier', strategy: heuristicStrategy(variant({ frontier: 0 })) },
]);

// 4. Frontier emphasis sweep.
table('Frontier weight sweep', [
  { name: 'frontier-1', strategy: heuristicStrategy(variant({ frontier: 1 })) },
  { name: 'frontier-3', strategy: heuristicStrategy(variant({ frontier: 3 })) },
  { name: 'frontier-6', strategy: heuristicStrategy(variant({ frontier: 6 })) },
  { name: 'frontier-10', strategy: heuristicStrategy(variant({ frontier: 10 })) },
]);

// 5. Alpha-beta vs heuristic — opt-in (`--ab`), it's ~4s/game so games are capped.
if (flags.has('--ab')) {
  const abGames = Math.min(games, 16);
  const abSeeds = Math.min(seeds, 4);
  table(
    'Alpha-beta vs heuristic (slow)',
    [
      { name: 'alphabeta-d2', strategy: alphaBetaStrategy({ depth: 2, beam: 8 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
      { name: 'alphabeta-d2', strategy: alphaBetaStrategy({ depth: 2, beam: 8 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
    ],
    abGames,
    abSeeds,
  );
}

// 6. MCTS vs heuristic — opt-in (`--mcts`), very slow (seconds/move) so games
// and seeds are capped hard. Tune iterations/rolloutDepth here for Run H.
if (flags.has('--mcts')) {
  const mctsGames = Math.min(games, 8);
  const mctsSeeds = Math.min(seeds, 3);
  table(
    'MCTS vs heuristic (very slow)',
    [
      { name: 'mcts', strategy: mctsStrategy({ iterations: 150, rolloutDepth: 12 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
      { name: 'mcts', strategy: mctsStrategy({ iterations: 150, rolloutDepth: 12 }) },
      { name: 'heuristic', strategy: heuristicStrategy() },
    ],
    mctsGames,
    mctsSeeds,
  );
}

// 7. RAVE / AMAF vs plain UCT at MATCHED iterations (AE3) — opt-in (`--rave`),
// seconds/move so games/seeds capped. Tests the value-sharing hypothesis: does
// AMAF warm-up buy strength at equal iteration budget? Tune iterations/raveK here.
if (flags.has('--rave')) {
  // No small cap here (unlike --mcts): AE3 needs a CI-clearing n, driven via args.
  const rGames = games;
  const rSeeds = seeds;
  const ITERS = 150;
  const DEPTH = 12;
  table(
    'RAVE vs plain UCT (matched iters, very slow)',
    [
      { name: 'rave', strategy: mctsStrategy({ iterations: ITERS, rolloutDepth: DEPTH, rave: true }) },
      { name: 'plain-uct', strategy: mctsStrategy({ iterations: ITERS, rolloutDepth: DEPTH }) },
      { name: 'rave', strategy: mctsStrategy({ iterations: ITERS, rolloutDepth: DEPTH, rave: true }) },
      { name: 'plain-uct', strategy: mctsStrategy({ iterations: ITERS, rolloutDepth: DEPTH }) },
    ],
    rGames,
    rSeeds,
  );
}

// 8. Rollout-sampling waste readout (P37) — opt-in (`--rollout-stats`). Quantifies
// the sample-with-replacement / fallback waste at extreme's width 48: in sparse
// endgames the 48-draw pool exceeds the legal-move count, so most draws duplicate and
// some miss entirely, falling through to full-enumeration `fallbackMove`. Pure wasted
// cycles, no correctness risk (F18). The waste rate is width-driven and independent of
// the iteration budget, so a reduced count measures it far faster than the live 500.
// Self-play, one short game — enough rollout moves for the rates to settle.
if (flags.has('--rollout-stats')) {
  const cfg: Partial<MctsConfig> = {
    iterations: 10,
    beam: 20,
    rolloutDepth: 0,
    minIterations: 8,
    rankRewardWeight: 0.25,
    rolloutSamples: 48, // mirrors the extreme tier (difficulty.ts)
  };
  const seats: Contestant[] = COLOR_ORDER.map((_, i) => ({
    name: `extreme#${i}`,
    strategy: mctsStrategy(cfg),
  }));
  enableRolloutStats(true);
  runTournamentSeeds(seats, { games: 1, seeds: 1, baseSeed });
  const st = getRolloutStats()!;
  enableRolloutStats(false);
  const pct = (x: number) => (x * 100).toFixed(1).padStart(5) + '%';
  const duplicates = st.samples - st.nullSamples - st.distinct;
  console.log(
    `\nRollout sampling waste  (width ${cfg.rolloutSamples}, ${st.moves} rollout moves, ${st.samples} draws)`,
  );
  console.log(`  duplicate draws (sample-with-replacement)  ${pct(duplicates / st.samples)}`);
  console.log(`  null draws (rejection-sample miss)         ${pct(st.nullSamples / st.samples)}`);
  console.log(`  fallback moves (full enumeration)          ${pct(st.fallbacks / st.moves)}`);
}
