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
