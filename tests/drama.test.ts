import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { finalScores } from '../src/game/scoring';
import {
  TOTAL_SQUARES,
  placedSquares,
  newlyStuckColors,
  outOfMovesText,
  revealRows,
  resultSummary,
} from '../src/client/drama';

describe('placedSquares / TOTAL_SQUARES', () => {
  it('all 21 pieces total 89 squares', () => {
    expect(TOTAL_SQUARES).toBe(89);
  });

  it('coverage = total minus remaining', () => {
    const G = createInitialState(4, 'basic');
    expect(placedSquares(G.colors.blue)).toBe(0); // nothing placed yet
    G.colors.blue.remaining = []; // everything placed
    expect(placedSquares(G.colors.blue)).toBe(TOTAL_SQUARES);
  });
});

describe('newlyStuckColors', () => {
  it('reports only the colors that flipped to stuck this update', () => {
    const prev = createInitialState(4, 'basic');
    const cur = createInitialState(4, 'basic');
    prev.colors.red.stuck = true; // already stuck before → not "newly"
    cur.colors.red.stuck = true;
    cur.colors.yellow.stuck = true; // flipped this update
    expect(newlyStuckColors(prev, cur)).toEqual(['yellow']);
  });

  it('returns [] when nothing changed', () => {
    const G = createInitialState(4, 'basic');
    expect(newlyStuckColors(G, G)).toEqual([]);
  });
});

describe('outOfMovesText', () => {
  it('capitalizes the color', () => {
    expect(outOfMovesText('green')).toBe('Green is out of moves');
  });
});

describe('revealRows', () => {
  it('sorts winners first, then by coverage desc', () => {
    const G = createInitialState(4, 'basic');
    // green covers most but red is the winner (fewest remaining → wins basic).
    G.colors.red.remaining = []; // placed 89, winner
    G.colors.green.remaining = ['I1']; // placed 88
    G.colors.blue.remaining = ['I5', 'V5']; // placed 79
    G.colors.yellow.remaining = ['I1']; // placed 88
    const rows = revealRows(G, finalScores(G));

    expect(rows[0].color).toBe('red');
    expect(rows[0].isWinner).toBe(true);
    // Remaining three ranked by coverage desc: green/yellow (88) before blue (79).
    expect(rows[rows.length - 1].color).toBe('blue');
    expect(rows.every((r) => (r.color === 'red' ? r.isWinner : !r.isWinner))).toBe(true);
  });
});

describe('resultSummary', () => {
  it('names the winner and lists every color score', () => {
    const G = createInitialState(4, 'basic');
    G.colors.blue.remaining = []; // winner (0 remaining)
    const text = resultSummary(G, finalScores(G));
    expect(text).toContain('Blue wins');
    for (const name of ['Blue', 'Yellow', 'Red', 'Green']) expect(text).toContain(name);
  });
});
