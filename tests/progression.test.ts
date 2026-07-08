import { describe, it, expect } from 'vitest';
import {
  applyResult,
  emptyProgression,
  hardestTier,
  winRate,
  type GameResult,
} from '../src/client/progression/progression';

const win = (over: Partial<GameResult> = {}): GameResult => ({
  won: true,
  score: 50,
  hardestTier: 'easy',
  perfectClear: false,
  ...over,
});
const loss = (over: Partial<GameResult> = {}): GameResult => win({ won: false, ...over });

describe('applyResult — counters', () => {
  it('folds a first win: counts, streak, best score, per-tier, first-win unlock', () => {
    const { state, unlocked } = applyResult(emptyProgression(), win({ score: 42, hardestTier: 'easy' }));
    expect(state.gamesPlayed).toBe(1);
    expect(state.wins).toBe(1);
    expect(state.currentStreak).toBe(1);
    expect(state.bestStreak).toBe(1);
    expect(state.bestScore).toBe(42);
    expect(state.perTier.easy).toEqual({ played: 1, won: 1 });
    expect(state.firstWinTiers).toEqual(['easy']);
    expect(unlocked.map((m) => m.id)).toEqual(['first-win-easy']);
  });

  it('a loss records the game and resets the current streak but keeps best streak', () => {
    let s = emptyProgression();
    s = applyResult(s, win()).state; // streak 1
    s = applyResult(s, win()).state; // streak 2, best 2
    const { state } = applyResult(s, loss());
    expect(state.gamesPlayed).toBe(3);
    expect(state.wins).toBe(2);
    expect(state.currentStreak).toBe(0);
    expect(state.bestStreak).toBe(2);
  });

  it('best score takes the max and seeds from null (including negative scores)', () => {
    let s = applyResult(emptyProgression(), loss({ score: -3 })).state;
    expect(s.bestScore).toBe(-3);
    s = applyResult(s, win({ score: 10 })).state;
    expect(s.bestScore).toBe(10);
    s = applyResult(s, win({ score: 7 })).state;
    expect(s.bestScore).toBe(10);
  });
});

describe('applyResult — milestones fire once', () => {
  it('first-win-vs-tier unlocks only on the first win at that tier', () => {
    let s = emptyProgression();
    const a = applyResult(s, win({ hardestTier: 'extreme' }));
    expect(a.unlocked.map((m) => m.id)).toEqual(['first-win-extreme']);
    s = a.state;
    // easy stays untouched; extreme recorded
    expect(s.perTier.extreme).toEqual({ played: 1, won: 1 });
    expect(s.perTier.easy).toEqual({ played: 0, won: 0 });
    const b = applyResult(s, win({ hardestTier: 'extreme' }));
    expect(b.unlocked).toEqual([]);
    expect(b.state.perTier.extreme).toEqual({ played: 2, won: 2 });
  });

  it('a loss at a tier does not unlock first-win', () => {
    const { state, unlocked } = applyResult(emptyProgression(), loss({ hardestTier: 'hard' }));
    expect(unlocked).toEqual([]);
    expect(state.perTier.hard).toEqual({ played: 1, won: 0 });
    expect(state.firstWinTiers).toEqual([]);
  });

  it('perfect-clear unlocks once, then only increments the counter', () => {
    let s = emptyProgression();
    const a = applyResult(s, win({ perfectClear: true }));
    expect(a.unlocked.map((m) => m.id)).toContain('perfect-clear');
    expect(a.state.perfectClears).toBe(1);
    s = a.state;
    const b = applyResult(s, win({ perfectClear: true }));
    expect(b.unlocked.map((m) => m.id)).not.toContain('perfect-clear');
    expect(b.state.perfectClears).toBe(2);
  });
});

describe('applyResult — no-AI games', () => {
  it('a game with no opponent tier still counts overall but touches no tier bucket', () => {
    const { state, unlocked } = applyResult(emptyProgression(), win({ hardestTier: null }));
    expect(state.gamesPlayed).toBe(1);
    expect(state.wins).toBe(1);
    expect(state.currentStreak).toBe(1);
    expect(unlocked).toEqual([]); // no tier → no first-win milestone
    for (const d of ['easy', 'medium', 'hard', 'extreme'] as const) {
      expect(state.perTier[d]).toEqual({ played: 0, won: 0 });
    }
  });
});

describe('hardestTier + winRate helpers', () => {
  it('hardestTier picks the strongest by ladder order, null when empty', () => {
    expect(hardestTier(['easy', 'hard', 'medium'])).toBe('hard');
    expect(hardestTier(['medium', 'extreme', 'easy'])).toBe('extreme');
    expect(hardestTier(['easy', 'easy'])).toBe('easy');
    expect(hardestTier([])).toBeNull();
  });

  it('winRate is a ratio, null when no games (no 0/0)', () => {
    expect(winRate(0, 0)).toBeNull();
    expect(winRate(4, 1)).toBe(0.25);
    expect(winRate(2, 2)).toBe(1);
  });
});
