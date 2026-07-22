import { describe, it, expect } from 'vitest';
import {
  applyResult,
  bestScoreTile,
  emptyProgression,
  hardestTier,
  sanitize,
  winRate,
  type GameResult,
} from '../src/client/progression/progression';

const win = (over: Partial<GameResult> = {}): GameResult => ({
  won: true,
  score: 50,
  hardestTier: 'easy',
  perfectClear: false,
  scoring: 'basic',
  variant: 'classic',
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
    expect(state.bestScores.classic.basic).toBe(42);
    expect(state.perTier.classic.easy).toEqual({ played: 1, won: 1 });
    expect(state.firstWinTiers.classic).toEqual(['easy']);
    expect(unlocked.map((m) => m.id)).toEqual(['first-win-classic-easy']);
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

  // P51: "best" runs in the variant's direction. Basic scores squares still in
  // your tray, so the best game is the *smallest* number — taking the max there
  // reported your worst game.
  it('best score under basic takes the min and seeds from null', () => {
    let s = applyResult(emptyProgression(), loss({ score: 43, scoring: 'basic' })).state;
    expect(s.bestScores.classic.basic).toBe(43);
    s = applyResult(s, win({ score: 32, scoring: 'basic' })).state;
    expect(s.bestScores.classic.basic).toBe(32);
    s = applyResult(s, win({ score: 37, scoring: 'basic' })).state;
    expect(s.bestScores.classic.basic).toBe(32);
  });

  it('best score under advanced takes the max and seeds from null (negatives included)', () => {
    let s = applyResult(emptyProgression(), loss({ score: -3, scoring: 'advanced' })).state;
    expect(s.bestScores.classic.advanced).toBe(-3);
    s = applyResult(s, win({ score: 10, scoring: 'advanced' })).state;
    expect(s.bestScores.classic.advanced).toBe(10);
    s = applyResult(s, win({ score: 7, scoring: 'advanced' })).state;
    expect(s.bestScores.classic.advanced).toBe(10);
  });

  it('the two variants are tracked apart — points never beat squares-left', () => {
    let s = applyResult(emptyProgression(), win({ score: 5, scoring: 'basic' })).state;
    s = applyResult(s, win({ score: 20, scoring: 'advanced' })).state;
    expect(s.bestScores.classic).toEqual({ basic: 5, advanced: 20 });
  });
});

describe('bestScoreTile', () => {
  it('is null until a game is recorded, then carries the variant unit', () => {
    expect(bestScoreTile(emptyProgression())).toBeNull();

    const basic = applyResult(emptyProgression(), win({ score: 32, scoring: 'basic' })).state;
    expect(bestScoreTile(basic)?.value).toBe('32 left');
    expect(bestScoreTile(basic)?.title).toContain('lower is better');

    const advanced = applyResult(emptyProgression(), win({ score: 20, scoring: 'advanced' })).state;
    expect(bestScoreTile(advanced)?.value).toBe('20 pts');
    expect(bestScoreTile(advanced)?.title).toContain('higher is better');
  });

  it('prefers basic (the default variant) and mentions the advanced best alongside', () => {
    let s = applyResult(emptyProgression(), win({ score: 32, scoring: 'basic' })).state;
    s = applyResult(s, win({ score: 20, scoring: 'advanced' })).state;
    const tile = bestScoreTile(s);
    expect(tile?.value).toBe('32 left');
    expect(tile?.title).toContain('20 pts');
  });
});

describe('applyResult — milestones fire once', () => {
  it('first-win-vs-tier unlocks only on the first win at that tier', () => {
    let s = emptyProgression();
    const a = applyResult(s, win({ hardestTier: 'extreme' }));
    expect(a.unlocked.map((m) => m.id)).toEqual(['first-win-classic-extreme']);
    s = a.state;
    // easy stays untouched; extreme recorded
    expect(s.perTier.classic.extreme).toEqual({ played: 1, won: 1 });
    expect(s.perTier.classic.easy).toEqual({ played: 0, won: 0 });
    const b = applyResult(s, win({ hardestTier: 'extreme' }));
    expect(b.unlocked).toEqual([]);
    expect(b.state.perTier.classic.extreme).toEqual({ played: 2, won: 2 });
  });

  it('a loss at a tier does not unlock first-win', () => {
    const { state, unlocked } = applyResult(emptyProgression(), loss({ hardestTier: 'hard' }));
    expect(unlocked).toEqual([]);
    expect(state.perTier.classic.hard).toEqual({ played: 1, won: 0 });
    expect(state.firstWinTiers.classic).toEqual([]);
  });

  it('perfect-clear unlocks once, then only increments the counter', () => {
    let s = emptyProgression();
    const a = applyResult(s, win({ perfectClear: true }));
    expect(a.unlocked.map((m) => m.id)).toContain('perfect-clear-classic');
    expect(a.state.perfectClears.classic).toBe(1);
    s = a.state;
    const b = applyResult(s, win({ perfectClear: true }));
    expect(b.unlocked.map((m) => m.id)).not.toContain('perfect-clear-classic');
    expect(b.state.perfectClears.classic).toBe(2);
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
      expect(state.perTier.classic[d]).toEqual({ played: 0, won: 0 });
    }
  });
});

describe('sanitize — stored blobs', () => {
  it('drops a pre-P51 bestScore (unrepairable) but keeps every other counter', () => {
    const legacy = {
      gamesPlayed: 10,
      wins: 4,
      currentStreak: 1,
      bestStreak: 3,
      bestScore: 43, // max-fold under basic: actually the worst of the ten games
      perTier: { easy: { played: 10, won: 4 } },
      firstWinTiers: ['easy'],
      perfectClears: 0,
    } as unknown as Partial<ReturnType<typeof emptyProgression>>;

    const s = sanitize(legacy);
    expect(s.bestScores.classic).toEqual({ basic: null, advanced: null });
    expect(bestScoreTile(s)).toBeNull();
    expect(s.gamesPlayed).toBe(10);
    expect(s.wins).toBe(4);
    expect(s.bestStreak).toBe(3);
    expect(s.perTier.classic.easy).toEqual({ played: 10, won: 4 });
    expect(s.firstWinTiers.classic).toEqual(['easy']);
  });

  it('round-trips per-scoring bests and rejects junk', () => {
    const s = sanitize({
      bestScores: { basic: 32, advanced: 'nope' },
    } as unknown as Partial<ReturnType<typeof emptyProgression>>);
    expect(s.bestScores.classic).toEqual({ basic: 32, advanced: null });
  });

  it('attributes a pre-variant blob to Classic and leaves Duo empty (P56)', () => {
    // Every game stored before variants existed was Classic — that is a fact about
    // when it was written, not a guess, so it is attributed rather than dropped.
    const s = sanitize({
      gamesPlayed: 3,
      perTier: { hard: { played: 3, won: 2 } },
      firstWinTiers: ['hard'],
      perfectClears: 1,
      bestScores: { advanced: 20 },
    } as unknown as Partial<ReturnType<typeof emptyProgression>>);

    expect(s.perTier.classic.hard).toEqual({ played: 3, won: 2 });
    expect(s.firstWinTiers.classic).toEqual(['hard']);
    expect(s.perfectClears.classic).toBe(1);
    expect(s.bestScores.classic.advanced).toBe(20);

    expect(s.perTier.duo.hard).toEqual({ played: 0, won: 0 });
    expect(s.firstWinTiers.duo).toEqual([]);
    expect(s.perfectClears.duo).toBe(0);
    expect(s.bestScores.duo).toEqual({ basic: null, advanced: null });
  });

  it('keeps Classic and Duo results in separate buckets (P56)', () => {
    let s = applyResult(emptyProgression(), win({ score: 10, scoring: 'advanced' })).state;
    const duo = applyResult(s, win({ score: 20, scoring: 'advanced', variant: 'duo', hardestTier: 'hard' }));
    s = duo.state;

    expect(s.gamesPlayed).toBe(2); // the lifetime headline still counts both
    expect(s.bestScores.classic.advanced).toBe(10);
    expect(s.bestScores.duo.advanced).toBe(20);
    expect(s.perTier.classic.hard).toEqual({ played: 0, won: 0 });
    expect(s.perTier.duo.hard).toEqual({ played: 1, won: 1 });
    // A tier already beaten in Classic is still unbeaten in Duo — different game.
    expect(duo.unlocked.map((m) => m.id)).toContain('first-win-duo-hard');
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
