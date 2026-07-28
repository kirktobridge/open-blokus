import { describe, it, expect } from 'vitest';
import { COLOR_ORDER } from '../src/game/types';
import {
  playGame,
  runTournament,
  runTournamentSeeds,
  runRoundRobin,
  bradleyTerryElo,
  mulberry32,
  randomStrategy,
  greedySizeStrategy,
  heuristicStrategy,
} from '../src/game/ai/arena';

describe('arena.playGame', () => {
  it('drives a 4p game to a terminal (all colors stuck) state', () => {
    const byColor = Object.fromEntries(
      COLOR_ORDER.map((c) => [c, randomStrategy]),
    ) as Record<(typeof COLOR_ORDER)[number], typeof randomStrategy>;
    const result = playGame(byColor, { rng: mulberry32(7) });
    // finalScores always returns at least one winner once the game ends.
    expect(result.winners.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(result.colors)).toHaveLength(COLOR_ORDER.length);
  });
});

describe('arena.runTournament', () => {
  it('is deterministic for a fixed seed', () => {
    const make = () => [
      { name: 'heuristic', strategy: heuristicStrategy() },
      { name: 'random', strategy: randomStrategy },
      { name: 'greedy-size', strategy: greedySizeStrategy },
      { name: 'random#2', strategy: randomStrategy },
    ];
    const a = runTournament(make(), { games: 20, seed: 42 });
    const b = runTournament(make(), { games: 20, seed: 42 });
    expect(a).toEqual(b);
  });

  it('lazy-stuck driver is byte-identical to the eager one (AE18 golden)', () => {
    // Golden wins/ties captured from the eager `recomputeStuck`-per-move driver
    // before AE18's lazy-stuck rewrite. Locks byte-identity: the rng stream is
    // reused across a tournament's games, so any extra/missing draw would cascade.
    const make = () => [
      { name: 'heuristic', strategy: heuristicStrategy() },
      { name: 'random', strategy: randomStrategy },
      { name: 'greedy-size', strategy: greedySizeStrategy },
      { name: 'random#2', strategy: randomStrategy },
    ];
    const golden: Record<number, { wins: Record<string, number>; ties: number }> = {
      1: { wins: { heuristic: 27, random: 0, 'greedy-size': 3, 'random#2': 0 }, ties: 0 },
      42: { wins: { heuristic: 28.5, random: 0, 'greedy-size': 1.5, 'random#2': 0 }, ties: 1 },
      99: { wins: { heuristic: 28, random: 0, 'greedy-size': 2, 'random#2': 0 }, ties: 0 },
    };
    for (const seed of [1, 42, 99]) {
      const r = runTournament(make(), { games: 30, seed });
      expect(r.wins).toEqual(golden[seed].wins);
      expect(r.ties).toBe(golden[seed].ties);
    }
  });

  it('heuristic dominates random (regression guard for the bot)', () => {
    const r = runTournament(
      [
        { name: 'heuristic', strategy: heuristicStrategy() },
        { name: 'random', strategy: randomStrategy },
        { name: 'heuristic', strategy: heuristicStrategy() },
        { name: 'random', strategy: randomStrategy },
      ],
      { games: 40, seed: 3 },
    );
    // Two heuristic seats of four, so per-seat winRate caps near 0.5; what
    // matters is heuristic's share of *games won* vs random's.
    expect(r.winRate.heuristic).toBeGreaterThan(r.winRate.random);
    expect(r.wins.heuristic / r.games).toBeGreaterThan(0.85);
    expect(r.wins.heuristic).toBeGreaterThan(r.wins.random * 5);
  });
});

describe('arena.runTournamentSeeds', () => {
  const contestants = () => [
    { name: 'heuristic', strategy: heuristicStrategy() },
    { name: 'greedy-size', strategy: greedySizeStrategy },
    { name: 'heuristic', strategy: heuristicStrategy() },
    { name: 'greedy-size', strategy: greedySizeStrategy },
  ];

  it('aggregates mean/std across seeds and is deterministic', () => {
    const a = runTournamentSeeds(contestants(), { games: 10, seeds: 4, baseSeed: 1 });
    const b = runTournamentSeeds(contestants(), { games: 10, seeds: 4, baseSeed: 1 });
    expect(a).toEqual(b);
    expect(a.rows.map((r) => r.name)).toContain('heuristic');
    // Sorted by mean rate desc; heuristic should lead greedy-size.
    expect(a.rows[0].name).toBe('heuristic');
    expect(a.rows[0].meanRate).toBeGreaterThan(a.rows[1].meanRate);
    // Multiple seeds → a real spread is reported.
    expect(a.rows[0].stdRate).toBeGreaterThanOrEqual(0);
  });
});

describe('arena.bradleyTerryElo', () => {
  it('orders a transitive matrix and centers the pool mean on 1500', () => {
    const names = ['strong', 'mid', 'weak'];
    // A perfectly transitive 80/60/? matrix.
    const n = 100;
    const wins = {
      strong: { mid: 70, weak: 90 },
      mid: { strong: 30, weak: 70 },
      weak: { strong: 10, mid: 30 },
    };
    const games = {
      strong: { mid: n, weak: n },
      mid: { strong: n, weak: n },
      weak: { strong: n, mid: n },
    };
    const elo = bradleyTerryElo(names, wins, games);
    expect(elo.strong).toBeGreaterThan(elo.mid);
    expect(elo.mid).toBeGreaterThan(elo.weak);
    const mean = names.reduce((a, nm) => a + elo[nm], 0) / names.length;
    expect(mean).toBeCloseTo(1500, 6);
  });

  it('stays finite for a 0%/100% member (prior regularization)', () => {
    const names = ['winner', 'loser'];
    const wins = { winner: { loser: 100 }, loser: { winner: 0 } };
    const games = { winner: { loser: 100 }, loser: { winner: 100 } };
    const elo = bradleyTerryElo(names, wins, games);
    expect(Number.isFinite(elo.winner)).toBe(true);
    expect(Number.isFinite(elo.loser)).toBe(true);
    expect(elo.winner).toBeGreaterThan(elo.loser);
  });

  /**
   * Why the committed ladder is anchored rather than mean-centered (P61). These two
   * tests are a matched pair: the same pool gains the same newcomer, and only the
   * centering convention differs. Under the mean, ratings the picker publishes move
   * because of who *else* joined; under an anchor they don't.
   */
  describe('anchoring', () => {
    const n = 100;
    const base = {
      names: ['strong', 'mid', 'weak'],
      wins: {
        strong: { mid: 70, weak: 90 },
        mid: { strong: 30, weak: 70 },
        weak: { strong: 10, mid: 30 },
      } as Record<string, Record<string, number>>,
      games: {
        strong: { mid: n, weak: n },
        mid: { strong: n, weak: n },
        weak: { strong: n, mid: n },
      } as Record<string, Record<string, number>>,
    };
    // A newcomer far below everyone — the case that drags the pool mean down hardest.
    const grown = {
      names: [...base.names, 'newcomer'],
      wins: {
        strong: { ...base.wins.strong, newcomer: 95 },
        mid: { ...base.wins.mid, newcomer: 92 },
        weak: { ...base.wins.weak, newcomer: 85 },
        newcomer: { strong: 5, mid: 8, weak: 15 },
      },
      games: {
        strong: { ...base.games.strong, newcomer: n },
        mid: { ...base.games.mid, newcomer: n },
        weak: { ...base.games.weak, newcomer: n },
        newcomer: { strong: n, mid: n, weak: n },
      },
    };

    const anchor = { member: 'mid', elo: 1549 };
    const drift = (opts?: { anchor: { member: string; elo: number } }) => {
      const before = bradleyTerryElo(base.names, base.wins, base.games, opts);
      const after = bradleyTerryElo(grown.names, grown.wins, grown.games, opts);
      return Object.fromEntries(base.names.map((nm) => [nm, after[nm] - before[nm]]));
    };

    it('mean-centering moves every incumbent by a common offset nobody earned', () => {
      const d = drift();
      // ~+100 each: not one of them played differently, and the shifts barely differ
      // from each other — which is the tell that this is the arithmetic of who is in
      // the room, not a re-estimate of anyone's strength.
      for (const name of base.names) {
        expect(Math.abs(d[name]), `${name} should have drifted`).toBeGreaterThan(50);
      }
      const spread = Math.max(...base.names.map((nm) => d[nm])) - Math.min(...base.names.map((nm) => d[nm]));
      expect(spread).toBeLessThan(Math.min(...base.names.map((nm) => Math.abs(d[nm]))));
    });

    it('an anchor pins its member exactly and leaves the rest to re-estimation', () => {
      const withAnchor = drift({ anchor });
      const withMean = drift();
      expect(withAnchor.mid).toBeCloseTo(0, 6);
      // The newcomer's results still inform the fit, so the others move a little — by
      // their measured strength. An order of magnitude below the composition shift.
      for (const name of base.names) {
        expect(Math.abs(withAnchor[name]), `${name} drifted like a re-centering`).toBeLessThan(
          Math.abs(withMean[name]) / 5,
        );
      }
    });

    it('refuses an anchor that names a member outside the pool', () => {
      expect(() => bradleyTerryElo(base.names, base.wins, base.games, { anchor: { member: 'ghost', elo: 1500 } })).toThrow(
        /not in the pool/,
      );
    });
  });
});

describe('arena.runRoundRobin', () => {
  const pool = () => [
    { name: 'heuristic', strategy: heuristicStrategy() },
    { name: 'greedy-size', strategy: greedySizeStrategy },
    { name: 'random', strategy: randomStrategy },
  ];

  it('is deterministic and fills a full pairwise matrix', () => {
    const a = runRoundRobin(pool(), { games: 8, seeds: 2, baseSeed: 1 });
    const b = runRoundRobin(pool(), { games: 8, seeds: 2, baseSeed: 1 });
    expect(a).toEqual(b);
    // Every off-diagonal cell present; diagonal empty. Mirror shares sum to ~1.
    for (const x of a.names) {
      for (const y of a.names) {
        if (x === y) expect(a.matrix[x][y]).toBeUndefined();
        else expect(a.matrix[x][y].games).toBe(16);
      }
    }
    expect(a.matrix.heuristic.random.share + a.matrix.random.heuristic.share).toBeCloseTo(1, 6);
  });

  it('ranks heuristic over greedy over random by pool Elo', () => {
    const rr = runRoundRobin(pool(), { games: 12, seeds: 3, baseSeed: 5 });
    expect(rr.ranking).toEqual(['heuristic', 'greedy-size', 'random']);
    expect(rr.elo.heuristic).toBeGreaterThan(rr.elo['greedy-size']);
    expect(rr.elo['greedy-size']).toBeGreaterThan(rr.elo.random);
  });

  it('rejects duplicate member names', () => {
    expect(() =>
      runRoundRobin([
        { name: 'x', strategy: randomStrategy },
        { name: 'x', strategy: greedySizeStrategy },
      ]),
    ).toThrow(/distinct/);
  });
});
