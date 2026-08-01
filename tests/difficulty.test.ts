import { describe, it, expect } from 'vitest';
import {
  blitzPaceMs,
  mctsConfigFor,
  resolveExtremeForBlitz,
  type Difficulty,
} from '../src/client/ai/difficulty';

// Structural guard for F8 / AE5: a time budget delivers few iterations (~30 for
// medium), so the beam must stay narrow — a wide beam spreads rollouts too thin
// and the tier loses to the heuristic. Strength itself is validated by the
// research runs (Run J), not here.
describe('difficulty MCTS config', () => {
  it('medium uses a narrow beam matched to its small iteration budget', () => {
    // Classic explicitly: the ≤8 bar is a *Classic* measurement (F8/AE5) and Duo
    // measures the opposite way (F21), so this must not silently read a default.
    const m = mctsConfigFor('medium', 'classic');
    expect(m.timeBudgetMs).toBe(500);
    expect(m.rolloutDepth).toBe(0); // full rollouts — the strength driver (F6)
    // beam ≈ iters/6 with medium ≈ 30 iters ⇒ ~5. Guard against a regression to a
    // wide beam (16 lost to the heuristic at this budget).
    expect(m.beam).toBeLessThanOrEqual(8);
  });

  it('hard uses a wider beam than medium (more iterations to spend)', () => {
    const hard = mctsConfigFor('hard');
    const medium = mctsConfigFor('medium');
    expect(hard.timeBudgetMs).toBe(2000);
    expect(hard.beam!).toBeGreaterThanOrEqual(medium.beam!);
  });

  it('extreme uses a fixed iteration count and no time budget', () => {
    const x = mctsConfigFor('extreme');
    expect(x.timeBudgetMs).toBeUndefined(); // "no time budget" → iterations mode
    expect(x.iterations!).toBeGreaterThan(mctsConfigFor('hard').beam! * 5); // clearly deep
    expect(x.rolloutDepth).toBe(0);
    // Enough rollouts per child to stay reliable at its beam (≥ ~5, per F8).
    expect(x.iterations! / x.beam!).toBeGreaterThanOrEqual(5);
  });

  it('extreme widens the rollout sample pool to 48 (AE28/F18); medium/hard keep the default', () => {
    // At extreme's fixed 500-iter budget, width 48 beats the default 6 on pure
    // rollout quality (+11.3 pts game-share, no wall-clock confound). medium/hard
    // trade width against *free iterations* (F17) — a separate regime, left unset so
    // they inherit the MctsConfig default (6).
    expect(mctsConfigFor('extreme').rolloutSamples).toBe(48);
    expect(mctsConfigFor('medium').rolloutSamples).toBeUndefined();
    expect(mctsConfigFor('hard').rolloutSamples).toBeUndefined();
  });
});

/**
 * P63 (a): Duo stops inheriting Classic's beam. These guard the *deployment* of
 * F21 — the finding itself is settled by the arena (AE30, n=600, replicated), not
 * here. What can regress silently is the wiring: a tier that reads Classic's
 * constants on a Duo board is exactly the bug this slice exists to remove.
 */
describe('per-variant tier config (P63)', () => {
  it('medium on Duo uses the measured beam of 16, not Classic 6 (F21)', () => {
    expect(mctsConfigFor('medium', 'duo').beam).toBe(16);
    expect(mctsConfigFor('medium', 'classic').beam).toBe(6);
  });

  it('defaults to Classic when no variant is given', () => {
    // Load-bearing: the Elo pool and its ratings are Classic-measured, and callers
    // that omit the variant (tests/ratings.test.ts, the arena scripts) must keep
    // reading Classic's numbers rather than silently drifting onto a variant's.
    expect(mctsConfigFor('medium')).toEqual(mctsConfigFor('medium', 'classic'));
  });

  it('deltas override only what they name — everything else stays Classic', () => {
    const classic = mctsConfigFor('medium', 'classic');
    const duo = mctsConfigFor('medium', 'duo');
    expect(duo.timeBudgetMs).toBe(classic.timeBudgetMs);
    expect(duo.rolloutDepth).toBe(classic.rolloutDepth);
    expect(duo.minIterations).toBe(classic.minIterations);
    expect(duo.rankRewardWeight).toBe(classic.rankRewardWeight);
  });

  it('a tier with no measured Duo delta plays Classic constants, deliberately', () => {
    // Not an oversight — AE30 measured `medium`. hard/extreme are unmeasured on Duo
    // and inherit until they are, which is the documented delta discipline.
    for (const tier of ['hard', 'extreme'] as const) {
      expect(mctsConfigFor(tier, 'duo')).toEqual(mctsConfigFor(tier, 'classic'));
    }
  });
});

describe('blitz bot pacing (P25)', () => {
  it('stays within each tier jitter band, both extremes of rand', () => {
    for (const tier of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const lo = blitzPaceMs(tier, () => 0);
      const hi = blitzPaceMs(tier, () => 0.999999);
      expect(lo).toBeLessThan(hi); // it's a range, not a constant → doesn't read as an animation
      expect(lo).toBeGreaterThan(0);
    }
  });

  it('paces long enough to not read as sniping (well above ~0.5s)', () => {
    // The complaint is bots replying in ~0.5s; every paced floor clears 1s.
    for (const tier of ['easy', 'medium', 'hard'] as Difficulty[]) {
      expect(blitzPaceMs(tier, () => 0)).toBeGreaterThanOrEqual(300);
    }
    expect(blitzPaceMs('easy', () => 0)).toBeGreaterThanOrEqual(1000);
  });

  it('never paces extreme (it is excluded from blitz, so it would never be called)', () => {
    expect(blitzPaceMs('extreme', () => 0.5)).toBe(0);
  });
});

describe('resolveExtremeForBlitz (P25)', () => {
  it('drops extreme seats to hard when a blitz clock is set', () => {
    const out = resolveExtremeForBlitz({ '1': 'extreme', '2': 'easy' }, 5);
    expect(out).toEqual({ '1': 'hard', '2': 'easy' });
  });

  it('is a no-op (same reference) with blitz off', () => {
    const input = { '1': 'extreme' as Difficulty };
    expect(resolveExtremeForBlitz(input, null)).toBe(input);
  });

  it('is a no-op (same reference) when no seat is extreme', () => {
    const input = { '1': 'hard' as Difficulty, '2': 'medium' as Difficulty };
    expect(resolveExtremeForBlitz(input, 10)).toBe(input);
  });
});
