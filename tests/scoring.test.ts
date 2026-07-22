import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { scoreColor, scorePlayers, determineWinners } from '../src/game/scoring';
import { colorStateOf } from '../src/game/modes';

describe('advanced scoring (rulebook example)', () => {
  it('reproduces +20 / -8 / -24 / -20', () => {
    const G = createInitialState(4, 'advanced');
    // blue: all pieces placed, monomino played last → +20
    colorStateOf(G, 'blue').remaining = [];
    colorStateOf(G, 'blue').lastPlaced = 'I1';
    // yellow: two 4-square pieces left → -8
    colorStateOf(G, 'yellow').remaining = ['I4', 'O4'];
    // red: one 3 + four 4s + one 5 = 24 → -24
    colorStateOf(G, 'red').remaining = ['I3', 'I4', 'O4', 'T4', 'L4', 'I5'];
    // green: one 3 + three 4s + one 5 = 20 → -20
    colorStateOf(G, 'green').remaining = ['I3', 'I4', 'O4', 'T4', 'I5'];

    expect(scoreColor(G, 'blue')).toBe(20);
    expect(scoreColor(G, 'yellow')).toBe(-8);
    expect(scoreColor(G, 'red')).toBe(-24);
    expect(scoreColor(G, 'green')).toBe(-20);

    // Highest wins → blue (player '0').
    expect(determineWinners(G)).toEqual(['0']);
  });

  it('gives +15 (not +20) when all placed but last piece was not the monomino', () => {
    const G = createInitialState(4, 'advanced');
    colorStateOf(G, 'blue').remaining = [];
    colorStateOf(G, 'blue').lastPlaced = 'I5';
    expect(scoreColor(G, 'blue')).toBe(15);
  });
});

describe('basic scoring', () => {
  it('lowest remaining squares wins', () => {
    const G = createInitialState(4, 'basic');
    colorStateOf(G, 'blue').remaining = [];
    colorStateOf(G, 'yellow').remaining = ['I1'];
    colorStateOf(G, 'red').remaining = ['I2'];
    colorStateOf(G, 'green').remaining = ['I3'];
    expect(scorePlayers(G)).toEqual({ '0': 0, '1': 1, '2': 2, '3': 3 });
    expect(determineWinners(G)).toEqual(['0']);
  });

  it('returns co-winners on a tie', () => {
    const G = createInitialState(4, 'basic');
    colorStateOf(G, 'blue').remaining = [];
    colorStateOf(G, 'yellow').remaining = [];
    colorStateOf(G, 'red').remaining = ['I1'];
    colorStateOf(G, 'green').remaining = ['I2'];
    expect(determineWinners(G)).toEqual(['0', '1']);
  });
});

describe('per-player aggregation', () => {
  it('2p: each player sums both controlled colors', () => {
    const G = createInitialState(2, 'basic'); // P0=blue+red, P1=yellow+green
    colorStateOf(G, 'blue').remaining = ['I1']; // 1
    colorStateOf(G, 'red').remaining = ['I2']; // 2  → P0 = 3
    colorStateOf(G, 'yellow').remaining = ['I3']; // 3
    colorStateOf(G, 'green').remaining = ['I4']; // 4  → P1 = 7
    expect(scorePlayers(G)).toEqual({ '0': 3, '1': 7 });
    expect(determineWinners(G)).toEqual(['0']);
  });

  it('3p: the shared color is ignored', () => {
    const G = createInitialState(3, 'basic'); // green = shared
    colorStateOf(G, 'blue').remaining = ['I1']; // 1
    colorStateOf(G, 'yellow').remaining = ['I2']; // 2
    colorStateOf(G, 'red').remaining = ['I3']; // 3
    colorStateOf(G, 'green').remaining = ['I5']; // shared → ignored
    const players = scorePlayers(G);
    expect(players).toEqual({ '0': 1, '1': 2, '2': 3 });
    expect(Object.keys(players)).not.toContain('shared');
  });
});
