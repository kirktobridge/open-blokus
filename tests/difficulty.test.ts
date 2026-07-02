import { describe, it, expect } from 'vitest';
import { mctsConfigFor } from '../src/client/ai/difficulty';

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
});
