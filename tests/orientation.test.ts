import { describe, expect, it } from 'vitest';
import { BOARD_SIZE } from '../src/shared/constants';
import {
  TURNS_TO_BOTTOM_RIGHT,
  toBoardXY,
  toScreenBoard,
  toScreenIndex,
  toScreenXY,
} from '../src/client/board/orientation';
import type { Color } from '../src/game/types';
import { COLOR_ORDER } from '../src/game/types';

const N = BOARD_SIZE - 1;
/** Each color's home corner, in board coordinates (GAME_SPEC §3). */
const HOME: Partial<Record<Color, [number, number]>> = {
  blue: [0, 0],
  yellow: [N, 0],
  red: [N, N],
  green: [0, N],
};

describe('view orientation (P49)', () => {
  it('turns the board contents clockwise', () => {
    // Top-left goes to top-right on one CW turn, and on round the corners.
    expect(toScreenXY(0, 0, 1, BOARD_SIZE)).toEqual([N, 0]);
    expect(toScreenXY(0, 0, 2, BOARD_SIZE)).toEqual([N, N]);
    expect(toScreenXY(0, 0, 3, BOARD_SIZE)).toEqual([0, N]);
    expect(toScreenXY(0, 0, 4, BOARD_SIZE)).toEqual([0, 0]);
  });

  it('puts every seat’s home corner bottom-right at its own view turns', () => {
    // The reason the orientation exists: you play from the bottom-right corner.
    for (const c of COLOR_ORDER) {
      const [x, y] = HOME[c]!;
      expect(toScreenXY(x, y, TURNS_TO_BOTTOM_RIGHT[c], BOARD_SIZE)).toEqual([N, N]);
    }
  });

  it('round-trips screen ↔ board for every cell and every turn', () => {
    // This is what keeps hit-testing honest: the cell you click reports itself.
    for (let t = -4; t <= 7; t++) {
      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const [x, y] = [i % BOARD_SIZE, Math.floor(i / BOARD_SIZE)];
        const [sx, sy] = toScreenXY(x, y, t, BOARD_SIZE);
        expect(toBoardXY(sx, sy, t, BOARD_SIZE)).toEqual([x, y]);
        expect(toScreenIndex(i, t, BOARD_SIZE)).toBe(sy * BOARD_SIZE + sx);
      }
    }
  });

  it('is a permutation — no cell is dropped or doubled up', () => {
    for (const t of [1, 2, 3]) {
      const seen = new Set(
        Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => toScreenIndex(i, t, BOARD_SIZE)),
      );
      expect(seen.size).toBe(BOARD_SIZE * BOARD_SIZE);
    }
  });

  it('re-indexes a board array without copying at rest', () => {
    const board = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null as Color | null);
    board[0] = 'blue';
    expect(toScreenBoard(board, 0, BOARD_SIZE)).toBe(board);
    // Blue's corner sits bottom-right at its own two turns.
    expect(toScreenBoard(board, 2, BOARD_SIZE)[N * BOARD_SIZE + N]).toBe('blue');
    expect(toScreenBoard(board, 2, BOARD_SIZE)[0]).toBeNull();
  });
});
