import { describe, expect, it } from 'vitest';
import {
  PUZZLE_COLOR,
  advanceOpponents,
  cellsPlaced,
  dailyDateKey,
  dailyShareText,
  generateDailyPuzzle,
  piecesPlaced,
  seedFromDateKey,
  stepOpponent,
} from '../src/game/puzzle/daily';
import { emojiBoard } from '../src/game/share';
import { COLOR_ORDER } from '../src/game/types';
import { hasAnyMove, generateLegalMoves } from '../src/game/moves';
import { applyPlacement } from '../src/game/placement';
import { resolveCells, pieceSize } from '../src/game/pieces';
import { remainingSquares } from '../src/game/scoring';
import { mulberry32 } from '../src/game/ai/arena';
import { colorStateOf, createInitialState } from '../src/game/modes';

const clone = <T>(v: T): T => structuredClone(v);

describe('daily puzzle date + seed', () => {
  it('formats a date key as YYYY-MM-DD', () => {
    expect(dailyDateKey(new Date(2026, 6, 9))).toBe('2026-07-09');
  });

  it('derives a stable, key-sensitive seed', () => {
    expect(seedFromDateKey('2026-07-10')).toBe(seedFromDateKey('2026-07-10'));
    expect(seedFromDateKey('2026-07-10')).not.toBe(seedFromDateKey('2026-07-11'));
  });

  it('hashes to an exact FNV-1a value (pins the whole key, char by char)', () => {
    // A pinned value catches a loop that reads one char too few or too many, or
    // a wrong arithmetic op — mistakes a determinism check can't see.
    expect(seedFromDateKey('2026-07-10')).toBe(3483350219);
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

  it('runs exactly the scripted opening — pinned seed, ceiling, and handoff state', () => {
    // Absolute values, not just run-to-run equality: an off-by-one in the setup
    // ply loop plays one extra opponent move and shifts the ceiling, and a wrong
    // scoring default or a non-empty lastMove would slip past the determinism test.
    const p = generateDailyPuzzle('2026-07-10');
    expect(p.seed).toBe(3483350219);
    expect(p.ceiling).toBe(34);
    expect(p.state.config.scoring).toBe('basic');
    expect(p.state.lastMove).toEqual([]);
  });

  it('hands a playable mid-game position to the player color', () => {
    const p = generateDailyPuzzle('2026-07-10');
    expect(p.playerColor).toBe(PUZZLE_COLOR);
    // The turn is pointed at the player's color, which has already opened.
    expect(COLOR_ORDER[p.state.activeColorIndex]).toBe(PUZZLE_COLOR);
    expect(colorStateOf(p.state, PUZZLE_COLOR).hasStarted).toBe(true);
    // The board is meaningfully populated by the self-play setup...
    expect(p.state.board.some((c) => c !== null)).toBe(true);
    // ...and every color, including the player's, is on the board.
    for (const color of COLOR_ORDER) {
      expect(p.state.board.some((c) => c === color)).toBe(true);
    }
    // The player has moves to make and pieces to place.
    expect(hasAnyMove(p.state, PUZZLE_COLOR)).toBe(true);
    expect(p.ceiling).toBe(remainingSquares(colorStateOf(p.state, PUZZLE_COLOR)));
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

describe('advanceOpponents', () => {
  it('lets the three other colors reply without touching the player color', () => {
    const p = generateDailyPuzzle('2026-07-10');
    const state = clone(p.state);
    const before = COLOR_ORDER.map((c) => colorStateOf(state, c).remaining.length);
    const playerBefore = colorStateOf(state, PUZZLE_COLOR).remaining.slice();

    const changed = advanceOpponents(state, PUZZLE_COLOR, mulberry32(1));

    // Each opponent (that had a move) placed exactly one piece; the player's hand
    // is untouched.
    expect(colorStateOf(state, PUZZLE_COLOR).remaining).toEqual(playerBefore);
    let opponentsMoved = 0;
    COLOR_ORDER.forEach((c, i) => {
      if (c === PUZZLE_COLOR) return;
      const placed = before[i] - colorStateOf(state, c).remaining.length;
      expect(placed === 0 || placed === 1).toBe(true);
      if (placed === 1) opponentsMoved += 1;
    });
    expect(opponentsMoved).toBeGreaterThan(0);
    // Returned indices are exactly the opponent-colored cells that appeared.
    // These must be real integer board indices: a bogus index (undefined, a
    // fraction from the wrong index math, or a stray accumulator element) reads
    // back as `undefined`, which would slip past a plain not-null check.
    expect(changed.length).toBeGreaterThan(0);
    const size = state.config.boardSize ?? 20;
    for (const idx of changed) {
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(size * size);
      const cell = state.board[idx];
      expect(cell).not.toBeNull();
      expect(cell).not.toBe(PUZZLE_COLOR);
    }
  });

  it('is deterministic for a given rng seed', () => {
    const p = generateDailyPuzzle('2026-07-10');
    const a = clone(p.state);
    const b = clone(p.state);
    const ra = advanceOpponents(a, PUZZLE_COLOR, mulberry32(42));
    const rb = advanceOpponents(b, PUZZLE_COLOR, mulberry32(42));
    expect(rb).toEqual(ra);
    expect(b.board).toEqual(a.board);
  });
});

describe('stepOpponent', () => {
  it('is a no-op returning no cells when the color has no legal move', () => {
    // A color with no move must not place anything — the guard that returns []
    // before touching the board. Fill the board so no placement is possible.
    const state = createInitialState(4, 'basic');
    state.board.fill('green');
    const before = clone(state.board);

    const changed = stepOpponent(state, 'blue', mulberry32(1));

    expect(changed).toEqual([]);
    expect(state.board).toEqual(before); // nothing placed
  });
});

describe('dailyShareText', () => {
  it('summarizes the run, then the board as the shared emoji grid (P26)', () => {
    const puzzle = generateDailyPuzzle('2026-07-10');
    const text = dailyShareText('2026-07-10', 34, 9, puzzle.state);
    expect(text).toContain('OpenBlokus Daily 2026-07-10');
    expect(text).toContain('34 squares');
    expect(text).toContain('9 pieces');

    const [caption, grid] = text.split('\n\n');
    expect(caption.split('\n')).toHaveLength(2);
    expect(grid).toBe(emojiBoard(puzzle.state)); // same renderer as game-over share
  });
});
