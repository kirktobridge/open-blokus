import { describe, expect, it } from 'vitest';
import { COLOR_EMOJI, EMPTY_EMOJI, emojiBoard } from '../src/game/share';
import { createInitialState } from '../src/game/modes';
import { COLOR_ORDER } from '../src/game/types';

describe('emojiBoard', () => {
  it('renders an empty board as 20 rows of 20 empty squares', () => {
    const grid = emojiBoard(createInitialState(4, 'basic'));
    const rows = grid.split('\n');
    expect(rows).toHaveLength(20);
    for (const row of rows) expect([...row]).toEqual(Array(20).fill(EMPTY_EMOJI));
  });

  it('maps each color to its square glyph, with distinct glyphs per color', () => {
    const glyphs = COLOR_ORDER.map((c) => COLOR_EMOJI[c]);
    expect(new Set(glyphs).size).toBe(COLOR_ORDER.length);
    expect(glyphs).not.toContain(EMPTY_EMOJI);
  });

  it('places each cell at its (x, y) — row-major, top row first', () => {
    const G = createInitialState(4, 'basic');
    // A cell per color, each in a distinct row/column, so a transpose or a
    // flipped row order would move them.
    G.board[0 * 20 + 0] = 'blue'; // (0,0) top-left
    G.board[1 * 20 + 3] = 'yellow'; // (3,1)
    G.board[19 * 20 + 19] = 'red'; // (19,19) bottom-right
    G.board[5 * 20 + 2] = 'green'; // (2,5)

    const rows = emojiBoard(G).split('\n');
    expect([...rows[0]][0]).toBe(COLOR_EMOJI.blue);
    expect([...rows[1]][3]).toBe(COLOR_EMOJI.yellow);
    expect([...rows[19]][19]).toBe(COLOR_EMOJI.red);
    expect([...rows[5]][2]).toBe(COLOR_EMOJI.green);

    // Nothing else got painted.
    const painted = [...emojiBoard(G)].filter((g) => g !== EMPTY_EMOJI && g !== '\n');
    expect(painted).toHaveLength(4);
  });
});
