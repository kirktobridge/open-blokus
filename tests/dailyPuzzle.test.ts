import { describe, expect, it } from 'vitest';
import {
  PUZZLE_COLOR,
  cellsPlaced,
  dailyDateKey,
  dailyShareText,
  generateDailyPuzzle,
  piecesPlaced,
  seedFromDateKey,
} from '../src/game/puzzle/daily';
import { COLOR_ORDER } from '../src/game/types';
import { hasAnyMove, generateLegalMoves } from '../src/game/moves';
import { applyPlacement } from '../src/game/placement';
import { resolveCells, pieceSize } from '../src/game/pieces';
import { remainingSquares } from '../src/game/scoring';

const clone = <T>(v: T): T => structuredClone(v);

describe('daily puzzle date + seed', () => {
  it('formats a date key as YYYY-MM-DD', () => {
    expect(dailyDateKey(new Date(2026, 6, 9))).toBe('2026-07-09');
  });

  it('derives a stable, key-sensitive seed', () => {
    expect(seedFromDateKey('2026-07-10')).toBe(seedFromDateKey('2026-07-10'));
    expect(seedFromDateKey('2026-07-10')).not.toBe(seedFromDateKey('2026-07-11'));
  });
});

describe('generateDailyPuzzle', () => {
  it('is deterministic for a given date key', () => {
    const a = generateDailyPuzzle('2026-07-10');
    const b = generateDailyPuzzle('2026-07-10');
    expect(b.seed).toBe(a.seed);
    expect(b.state).toEqual(a.state);
    expect(b.ceiling).toBe(a.ceiling);
  });

  it('produces different positions on different days', () => {
    const a = generateDailyPuzzle('2026-07-10');
    const b = generateDailyPuzzle('2026-07-11');
    expect(b.state.board).not.toEqual(a.state.board);
  });

  it('hands a playable mid-game position to the player color', () => {
    const p = generateDailyPuzzle('2026-07-10');
    expect(p.playerColor).toBe(PUZZLE_COLOR);
    // The turn is pointed at the player's color, which has already opened.
    expect(COLOR_ORDER[p.state.activeColorIndex]).toBe(PUZZLE_COLOR);
    expect(p.state.colors[PUZZLE_COLOR].hasStarted).toBe(true);
    // The board is meaningfully populated by the self-play setup...
    expect(p.state.board.some((c) => c !== null)).toBe(true);
    // ...and every color, including the player's, is on the board.
    for (const color of COLOR_ORDER) {
      expect(p.state.board.some((c) => c === color)).toBe(true);
    }
    // The player has moves to make and pieces to place.
    expect(hasAnyMove(p.state, PUZZLE_COLOR)).toBe(true);
    expect(p.ceiling).toBe(remainingSquares(p.state.colors[PUZZLE_COLOR]));
    expect(p.ceiling).toBeGreaterThan(0);
  });
});

describe('score tracking', () => {
  it('counts squares and pieces the player fits after handoff', () => {
    const p = generateDailyPuzzle('2026-07-10');
    // Nothing placed yet.
    expect(cellsPlaced(p, p.state)).toBe(0);
    expect(piecesPlaced(p, p.state)).toBe(0);

    // Play one legal move on a clone and re-measure.
    const next = clone(p.state);
    const move = generateLegalMoves(next, PUZZLE_COLOR)[0];
    applyPlacement(next, PUZZLE_COLOR, move.pieceId, resolveCells(move));
    expect(cellsPlaced(p, next)).toBe(pieceSize(move.pieceId));
    expect(piecesPlaced(p, next)).toBe(1);
  });
});

describe('dailyShareText', () => {
  it('summarizes the run in plain text', () => {
    const text = dailyShareText('2026-07-10', 34, 9);
    expect(text).toContain('OpenBlokus Daily 2026-07-10');
    expect(text).toContain('34 squares');
    expect(text).toContain('9 pieces');
  });
});
