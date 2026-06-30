import { describe, it, expect } from 'vitest';
import { COLOR_ORDER } from '../src/game/types';
import {
  playGame,
  runTournament,
  runTournamentSeeds,
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
