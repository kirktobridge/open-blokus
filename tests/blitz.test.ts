import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  BLITZ_OPTIONS,
  formatRemaining,
  pickRandomMove,
  resolveBlitzSeconds,
} from '../src/client/blitz/blitz';
import { createInitialState } from '../src/game/modes';
import { generateLegalMoves } from '../src/game/moves';
import { applyPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { COLOR_ORDER } from '../src/game/types';

const freshGame = () => createInitialState(4, 'basic');

/** Stub window.location.search so resolveBlitzSeconds can read a query param. */
function withSearch(search: string, fn: () => void): void {
  vi.stubGlobal('window', { location: { search } });
  try {
    fn();
  } finally {
    vi.unstubAllGlobals();
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('blitz options', () => {
  it('offers "off" first, then ascending limits', () => {
    expect(BLITZ_OPTIONS[0].value).toBeNull();
    const limits = BLITZ_OPTIONS.slice(1).map((o) => o.value as number);
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
    expect(limits.every((n) => n > 0)).toBe(true);
  });
});

describe('resolveBlitzSeconds', () => {
  it('passes the setting through when no query param is present', () => {
    withSearch('', () => {
      expect(resolveBlitzSeconds(10)).toBe(10);
      expect(resolveBlitzSeconds(null)).toBeNull();
    });
  });

  it('lets ?blitz= override the saved setting (e2e forces a fast clock)', () => {
    withSearch('?blitz=1', () => expect(resolveBlitzSeconds(null)).toBe(1));
    withSearch('?blitz=2.5', () => expect(resolveBlitzSeconds(30)).toBe(2.5));
  });

  it('treats ?blitz=0 and junk values as "off"', () => {
    withSearch('?blitz=0', () => expect(resolveBlitzSeconds(30)).toBeNull());
    withSearch('?blitz=-5', () => expect(resolveBlitzSeconds(30)).toBeNull());
    withSearch('?blitz=abc', () => expect(resolveBlitzSeconds(30)).toBeNull());
  });
});

describe('pickRandomMove', () => {
  it('picks the move at the index rand() lands on in the legal-move list', () => {
    const G = freshGame();
    const legal = generateLegalMoves(G, 'blue');
    expect(legal.length).toBeGreaterThan(1);

    expect(pickRandomMove(G, 'blue', () => 0)).toEqual(legal[0]);
    expect(pickRandomMove(G, 'blue', () => 0.5)).toEqual(legal[Math.floor(0.5 * legal.length)]);
  });

  it('stays in bounds when rand() returns its supremum', () => {
    const G = freshGame();
    const legal = generateLegalMoves(G, 'blue');
    // Math.random() never returns 1, but a caller's rand might; don't read past the end.
    expect(pickRandomMove(G, 'blue', () => 1)).toEqual(legal[legal.length - 1]);
  });

  it('only ever returns a legal placement', () => {
    const G = freshGame();
    // Advance the game a little so "legal" is a real constraint, not just the corner.
    for (const color of COLOR_ORDER) {
      const move = generateLegalMoves(G, color)[0];
      applyPlacement(G, color, move.pieceId, resolveCells(move));
    }
    const legal = generateLegalMoves(G, 'blue');
    const keys = new Set(legal.map((m) => JSON.stringify(m)));
    for (let i = 0; i < 50; i++) {
      const picked = pickRandomMove(G, 'blue', Math.random);
      expect(keys.has(JSON.stringify(picked))).toBe(true);
    }
  });

  it('returns null for a color with no legal move (a stuck seat is auto-skipped)', () => {
    const G = freshGame();
    // A color that has started but owns no pieces has nothing legal to play.
    G.colors.blue.hasStarted = true;
    G.colors.blue.remaining = [];
    expect(pickRandomMove(G, 'blue', () => 0)).toBeNull();
  });
});

describe('formatRemaining', () => {
  it('renders tenths so the last seconds visibly move', () => {
    expect(formatRemaining(4321)).toBe('4.3');
    expect(formatRemaining(1000)).toBe('1.0');
  });

  it('never renders a negative clock (a late tick reads 0.0, not -0.1)', () => {
    expect(formatRemaining(-120)).toBe('0.0');
  });
});
