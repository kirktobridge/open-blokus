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
    const m = mctsConfigFor('medium');
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
