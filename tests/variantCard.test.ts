import { describe, expect, it } from 'vitest';
import { startCellBoard } from '../src/client/lobby/VariantCard';
import { VARIANTS } from '../src/game/modes';
import type { Variant } from '../src/game/types';

/**
 * P65 M1 — the variant cards show the geometry they select.
 *
 * The card's visual claim is that Classic and Duo *look* structurally different at a
 * glance: a big board starting in the corners vs a small one starting inside. That
 * claim reduces to the cell array below, which is pure — so it is held here rather
 * than by screenshot. The per-theme screenshots verify the finish; this verifies the
 * geometry, which is the part that could silently regress to Classic.
 */
describe('variant cards (P65 M1)', () => {
  const variants: Variant[] = ['classic', 'duo'];

  it.each(variants)('%s draws its own board size, not the Classic one', (variant) => {
    const { boardSize } = VARIANTS[variant];
    expect(startCellBoard(variant)).toHaveLength(boardSize * boardSize);
  });

  it.each(variants)('%s marks exactly its own start cells, in its own colors', (variant) => {
    const { boardSize, playColors, startCells } = VARIANTS[variant];
    const board = startCellBoard(variant);

    const filled = board.filter((c) => c !== null);
    expect(filled).toHaveLength(playColors.length);
    // Every color in play appears exactly once, and only colors in play appear.
    expect([...filled].sort()).toEqual([...playColors].sort());

    for (const color of playColors) {
      const cell = startCells[color];
      expect(cell).toBeDefined();
      expect(board[cell!.y * boardSize + cell!.x]).toBe(color);
    }
  });

  it('Duo starts inside the board where Classic starts in the corners', () => {
    // The variants' defining structural difference (GAME_SPEC_DUO §3). Stated as a
    // property of the rendered board so a regression to Classic geometry — the exact
    // bug the variant invariant exists to catch — fails here.
    const isCorner = (i: number, n: number) => {
      const [x, y] = [i % n, Math.floor(i / n)];
      return (x === 0 || x === n - 1) && (y === 0 || y === n - 1);
    };

    const classicSize = VARIANTS.classic.boardSize;
    const classic = startCellBoard('classic');
    const classicFilled = classic.flatMap((c, i) => (c ? [i] : []));
    expect(classicFilled.every((i) => isCorner(i, classicSize))).toBe(true);

    const duoSize = VARIANTS.duo.boardSize;
    const duo = startCellBoard('duo');
    const duoFilled = duo.flatMap((c, i) => (c ? [i] : []));
    expect(duoFilled.some((i) => isCorner(i, duoSize))).toBe(false);
  });
});
