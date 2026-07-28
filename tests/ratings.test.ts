import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLASSIC_LADDER } from '../src/game/ai/ladder';
import type { PoolFile } from '../src/game/ai/ladder/hash';
import { DIFFICULTIES, mctsConfigFor } from '../src/client/ai/difficulty';
import { TIER_MEMBERS, formatTierRating, ladderFor, tierRating } from '../src/client/ai/ratings';

/**
 * Tier → rating mapping guard (P61).
 *
 * A displayed rating is a claim about the bot you are about to play. Nothing in the
 * type system connects `difficulty.ts`'s tier configs to `pool.json`'s members, so a
 * retune of either side would leave the picker advertising a strength that was never
 * measured — silently, and to players rather than to a log. These hold both sides
 * against each other, the same idiom as the events and backlog registries.
 */

const pool = JSON.parse(
  readFileSync(fileURLToPath(new URL('../scripts/experiments/pool.json', import.meta.url)), 'utf8'),
) as PoolFile;
const memberOf = (name: string) => pool.members.find((m) => m.name === name);

describe('tier → pool member mapping', () => {
  it('maps every shipped tier to a member that is actually in the ladder', () => {
    for (const tier of DIFFICULTIES) {
      const row = TIER_MEMBERS[tier];
      expect(row, `no mapping for tier ${tier}`).toBeDefined();
      expect(memberOf(row.member), `${tier} → ${row.member} is not in pool.json`).toBeDefined();
      expect(CLASSIC_LADDER.elo[row.member], `${row.member} has no rating`).toBeTypeOf('number');
    }
  });

  it('maps distinct tiers to distinct members', () => {
    const members = DIFFICULTIES.map((t) => TIER_MEMBERS[t].member);
    expect(new Set(members).size).toBe(members.length);
  });

  it('orders tiers by rating the way the picker orders them', () => {
    // easy → extreme must read as monotonically stronger, or the display argues with
    // itself: a picker that ranks tiers one way and rates them another is worse than
    // showing no numbers at all.
    const elos = DIFFICULTIES.map((t) => CLASSIC_LADDER.elo[TIER_MEMBERS[t].member]);
    for (let i = 1; i < elos.length; i++) {
      expect(elos[i], `${DIFFICULTIES[i]} is not rated above ${DIFFICULTIES[i - 1]}`).toBeGreaterThan(
        elos[i - 1],
      );
    }
  });

  describe('exactness is honest about what was measured', () => {
    it('easy IS the heuristic member — same strategy, no search config either side', () => {
      expect(TIER_MEMBERS.easy.exact).toBe(true);
      const member = memberOf(TIER_MEMBERS.easy.member)!;
      expect(member.strategy).toBe('heuristic');
      expect(member.options ?? {}).toEqual({});
    });

    it('extreme IS the champion member — config for config', () => {
      expect(TIER_MEMBERS.extreme.exact).toBe(true);
      const member = memberOf(TIER_MEMBERS.extreme.member)!;
      expect(member.strategy).toBe('mcts');
      expect(member.options).toEqual(mctsConfigFor('extreme'));
    });

    /**
     * The reason medium/hard are inexact, held as a fact rather than a comment: the
     * tier is time-budgeted, its stand-in is fixed-iteration. If someone ever converts
     * a tier to fixed iterations the mapping could become exact — and this test fails,
     * which is the prompt to say so in the UI instead of keeping a needless `≈`.
     */
    it.each([
      ['medium', 'mcts-30'],
      ['hard', 'mcts-150'],
    ] as const)('%s is a time-budgeted stand-in for fixed-iteration %s', (tier, member) => {
      expect(TIER_MEMBERS[tier]).toEqual({ member, exact: false });

      const shipped = mctsConfigFor(tier);
      const measured = memberOf(member)!.options!;
      expect(shipped.timeBudgetMs, `${tier} is no longer time-budgeted`).toBeTypeOf('number');
      expect(shipped.iterations).toBeUndefined();
      expect(measured.iterations, `${member} is no longer fixed-iteration`).toBeTypeOf('number');
      expect(measured.timeBudgetMs).toBeUndefined();

      // The stand-in is only defensible while the rest of the search matches — beam is
      // the lever that broke a tier before (F8/AE5), so it has to line up.
      expect(measured.beam).toBe(shipped.beam);
      expect(measured.rankRewardWeight).toBe(shipped.rankRewardWeight);
    });
  });
});

describe('tierRating', () => {
  it('reads Classic ratings off the committed ladder', () => {
    expect(tierRating('classic', 'easy')).toEqual({ member: 'heuristic', elo: 1549, exact: true });
    expect(tierRating('classic', 'extreme')).toEqual({ member: 'champion', elo: 2056, exact: true });
  });

  // M6, the rule this feature most easily gets wrong: a Duo board must never wear a
  // Classic number. Duo has no pool, so it is unrated — not defaulted.
  it('has no rating for Duo, because Duo has no ladder', () => {
    expect(ladderFor('duo')).toBeUndefined();
    for (const tier of DIFFICULTIES) {
      expect(tierRating('duo', tier)).toBeUndefined();
      expect(formatTierRating('duo', tier)).toBeUndefined();
    }
  });
});

describe('formatTierRating', () => {
  it('marks approximate ratings and leaves exact ones bare', () => {
    expect(formatTierRating('classic', 'easy')).toBe('1549');
    expect(formatTierRating('classic', 'medium')).toBe('≈1683');
    expect(formatTierRating('classic', 'hard')).toBe('≈1796');
    expect(formatTierRating('classic', 'extreme')).toBe('2056');
  });
});
