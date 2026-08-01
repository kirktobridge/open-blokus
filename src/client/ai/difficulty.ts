import type { MctsConfig } from '../../game/ai/mcts';
import type { Variant } from '../../game/types';
import type { VariantDeltas } from '../tuning';
import type { BlitzSeconds } from '../blitz/blitz';

/**
 * Offline-AI difficulty. Easy = heuristic bot; medium/hard = MCTS on a per-move
 * time budget; extreme = MCTS with a fixed (large) iteration count and *no time
 * budget* — strongest, but moves can take tens of seconds early game.
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

type MctsTier = Exclude<Difficulty, 'easy'>;

/**
 * MCTS config per tier (full rollouts throughout — the strength driver, F6/Run I).
 *
 * `beam` must scale with the iteration budget or a tier breaks: at ~30 iters/move a
 * `beam=16` spreads ~2 rollouts over 16 children (noise) and the tier *loses* to
 * the heuristic (F8 / AE5). Rule of thumb `beam ≈ iters/6` while keeping ≥ ~5
 * rollouts/child. medium ≈ 30 iters → 6; hard ≈ 140 → 16.
 *
 * `extreme` uses `iterations` (no `timeBudgetMs`) so it searches a fixed amount
 * regardless of wall-clock — the strongest setting on the Run I curve, at the cost
 * of long early-game moves. Tunable — see docs/research/backlog/ai-engine.md (AE10).
 *
 * `rankRewardWeight: 0.25` shapes the reward with a rank-normalized placement term
 * (AE15 / F15): a losing bot fights for 2nd-vs-4th (better final placement/score)
 * at no measured cost to wins. Validated at truncated rollouts; here rollouts run
 * to terminal, where the rank term is the *true* final ranking — a stronger signal.
 *
 * `extreme`'s `rolloutSamples: 48` (AE28 / F18) widens the rejection-sample pool
 * each rollout move chooses from: at extreme's fixed 500-iter budget, width 48 beats
 * the default 6 by +11.3 pts game-share (pure rollout quality, no wall-clock confound)
 * *and* runs ~1.35× faster (bigger-piece playouts terminate sooner). medium/hard keep
 * the default 6 — their width optimum trades against *free iterations* (F17), a
 * separate budget regime left as-is here.
 *
 * **Variant scope (Classic).** Every constant here is the *Classic* value, measured on
 * 20×20 4p (F6/F8/F15/F17/F18) and scoped to it, not to "the game" — see FINDINGS M6.
 * Three are known not to transfer as written: `rankRewardWeight` is provably inert at two
 * colors (the rank term collapses onto the winner term at n=2), `beam ≈ iters/6` reads
 * a branching factor that moves with board size *and* opponent count, and the reward
 * ranks by placed squares — the winner under *basic* scoring, not under Duo's
 * advanced-only scoring. Where a Duo measurement exists it lives in `MCTS_TIER_DELTAS`
 * below; a tier with no delta there plays Classic's constants on that variant because
 * nobody has measured otherwise — deliberate, and re-openable by an arena run.
 */
const MCTS_TIERS: Record<MctsTier, Partial<MctsConfig>> = {
  medium: { timeBudgetMs: 500, beam: 6, rolloutDepth: 0, minIterations: 8, rankRewardWeight: 0.25 },
  hard: { timeBudgetMs: 2000, beam: 16, rolloutDepth: 0, minIterations: 8, rankRewardWeight: 0.25 },
  extreme: { iterations: 500, beam: 20, rolloutDepth: 0, minIterations: 8, rankRewardWeight: 0.25, rolloutSamples: 48 },
};

/**
 * Per-variant tier overrides — **only** what a measurement moved (P63/P55's delta
 * discipline, the same shape `tuning.ts` uses for signal thresholds). A tier with no
 * entry plays Classic's constants on that variant *deliberately*.
 *
 * `medium.beam: 16` on Duo is F21 (AE30, replicated): 16 beats Classic's 6 by 58.6%
 * over n=600 on 14×14. The Classic rule of thumb `beam ≈ iters/6` is what fails here —
 * a 14×14 two-color game has a different branching factor, so the same time budget
 * supports a wider beam.
 *
 * `extreme.iterations: 1000` on Duo is F24 (AE33, two seed batches): at 1000 iters the
 * tier beats `hard` 63.6% [60.8, 66.3] over n=1200, restoring a top ladder step that was
 * flat on 14×14 — Classic's 500 left `extreme` failing to out-search `hard`. The latency
 * cap is what pins the value: 1000 iters is the most that fits (p95 5273 ms under a
 * 6000 ms cap), and move time roughly doubles (1506 → 3103 ms), which is the accepted
 * cost of the step. Note the *mechanism*: the `s6` arm isolating iterations alone failed
 * (54.6%), so the win comes from rollout **width** (`rolloutSamples: 48`, already the
 * shipped `extreme` value) paying off at the larger budget — raising iterations further
 * is not indicated by this result.
 *
 * Duo's `block: 0` (F22) is **not** here: that is a `weights` change, and it is measured
 * heuristic-vs-heuristic only. Whether the term still hurts with a search on top is
 * AE34, unmeasured — shipping it off F22 alone would read the finding past its scope.
 */
const MCTS_TIER_DELTAS: Record<MctsTier, VariantDeltas<Partial<MctsConfig>>> = {
  medium: { duo: { beam: 16 } },
  hard: {},
  extreme: { duo: { iterations: 1000 } },
};

/**
 * The MCTS config for `difficulty` on `variant` — Classic constants plus that
 * variant's measured deltas. Keyed on the variant rather than a `GameState` (which
 * `tunedFor` needs) because tiers are picked at seat-setup time, before a game exists.
 */
export function mctsConfigFor(
  difficulty: MctsTier,
  variant: Variant = 'classic',
): Partial<MctsConfig> {
  return { ...MCTS_TIERS[difficulty], ...MCTS_TIER_DELTAS[difficulty][variant] };
}

/**
 * Blitz bot pacing (P25). In blitz only the human is on a clock, so an instant bot
 * reply reads as the CPU sniping while you sweat. Floor each pace-able tier's
 * *visible* think-time to a jittered, human-plausible delay before it submits.
 *
 * This delays the submit, never the search — no tier's strength changes (the
 * ladder anchored by F14/F15 stays valid). The ranges are tuned against each
 * tier's own search cost (easy ≈ instant, medium ≈ 0.5 s, hard ≈ 2 s budget) so
 * total visible time stays human and rises with tier. `extreme` is excluded from
 * blitz entirely (see resolveExtremeForBlitz), so it never paces.
 *
 * **Variant-independent (verified, P58).** These ranges hold on Duo unchanged. A
 * fixed-*iteration* search would finish faster on Duo's smaller board, but every
 * pace-able tier is either heuristic-instant (easy) or *time-budget*-bound
 * (medium ≈ 500 ms, hard ≈ 2000 ms) — measured identical on Classic and Duo — so
 * the visible search cost these ranges floor doesn't move with the variant. The
 * only faster-on-Duo tier is `extreme`, which never paces.
 */
const BLITZ_PACE_MS: Record<Exclude<Difficulty, 'extreme'>, [number, number]> = {
  easy: [1200, 2200],
  medium: [1000, 1800],
  hard: [300, 900],
};

/** A jittered per-move pacing delay in ms for `tier` under a blitz clock. */
export function blitzPaceMs(tier: Difficulty, rand: () => number = Math.random): number {
  if (tier === 'extreme') return 0; // excluded from blitz; never paced
  const [lo, hi] = BLITZ_PACE_MS[tier];
  return lo + Math.floor(rand() * (hi - lo + 1));
}

/**
 * Sanitize a setup so `extreme` never races a blitz clock (P25). Extreme has no
 * time budget (~12 s/move), already longer than a 5–10 s limit, so pacing can't
 * fix it — with blitz on, any extreme seat drops to `hard`. Returns the same
 * object reference when nothing changes (blitz off, or no extreme seats).
 */
export function resolveExtremeForBlitz(
  botDifficulties: Record<string, Difficulty>,
  blitzSeconds: BlitzSeconds,
): Record<string, Difficulty> {
  if (blitzSeconds == null) return botDifficulties;
  let changed = false;
  const next: Record<string, Difficulty> = {};
  for (const [seat, d] of Object.entries(botDifficulties)) {
    if (d === 'extreme') {
      next[seat] = 'hard';
      changed = true;
    } else {
      next[seat] = d;
    }
  }
  return changed ? next : botDifficulties;
}
