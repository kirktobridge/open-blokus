import { describe, expect, it } from 'vitest';
import { AMBIENT_GAMES } from '../src/client/lobby/ambientGames';
import { generateAmbientGame } from '../src/game/ai/ambient';
import { BOARD_SIZE } from '../src/shared/constants';
import { COLOR_ORDER } from '../src/game/types';

const CELLS = BOARD_SIZE * BOARD_SIZE;

describe('ambient board games (P29 M2)', () => {
  it('the checked-in data is exactly what the engine produces for its seeds', () => {
    // The generator is offline and the client only ever reads its output, so nothing
    // at runtime would notice if the two drifted apart. This is that check: regenerate
    // every game from its recorded seed and compare. Fails → rerun
    // `npx vite-node scripts/ambient-games.ts`.
    for (const game of AMBIENT_GAMES) {
      expect(generateAmbientGame(game.seed)).toEqual(game);
    }
  });

  it('ships several distinct, fully-played games', () => {
    expect(AMBIENT_GAMES.length).toBeGreaterThanOrEqual(3);
    const seeds = new Set(AMBIENT_GAMES.map((g) => g.seed));
    expect(seeds.size).toBe(AMBIENT_GAMES.length);

    for (const game of AMBIENT_GAMES) {
      // A heuristic 4p game runs to exhaustion — well past the opening.
      expect(game.moves.length).toBeGreaterThan(40);
    }
  });

  it('every move is a legal-shaped placement on an empty square', () => {
    // The client trusts these cells blindly (that's the point — no engine at runtime),
    // so the data itself has to be sound: in-bounds, 1–5 cells, never overlapping.
    for (const game of AMBIENT_GAMES) {
      const filled = new Set<number>();
      for (const [colorIndex, cells] of game.moves) {
        expect(COLOR_ORDER[colorIndex]).toBeDefined();
        expect(cells.length).toBeGreaterThanOrEqual(1);
        expect(cells.length).toBeLessThanOrEqual(5);
        for (const idx of cells) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(CELLS);
          expect(filled.has(idx)).toBe(false);
          filled.add(idx);
        }
      }
    }
  });

  it('each color gets a turn — the board fills from four corners, not one', () => {
    for (const game of AMBIENT_GAMES) {
      const played = new Set(game.moves.map(([c]) => c));
      expect(played.size).toBe(COLOR_ORDER.length);
    }
  });
});
