import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { generateLegalMoves } from '../src/game/moves';
import { COLOR_ORDER } from '../src/game/types';

/**
 * Plays a full game greedily (first legal move each turn) and asserts it reaches
 * a valid game-over. Exercises the move → turn-advance → auto-skip → endIf loop
 * end to end, which underpins the interactive UI.
 */
describe('full game simulation', () => {
  it('4p greedy play reaches game over with valid scores', () => {
    const client = Client({ game: BlokusGame, numPlayers: 4 });
    let guard = 0;
    while (!client.getState()!.ctx.gameover && guard++ < 400) {
      const { G } = client.getState()!;
      const color = COLOR_ORDER[G.activeColorIndex];
      const moves = generateLegalMoves(G, color);
      // The active color is never stuck (stuck colors are auto-skipped).
      expect(moves.length).toBeGreaterThan(0);
      client.moves.placePiece(moves[0]);
    }

    const { G, ctx } = client.getState()!;
    expect(ctx.gameover).toBeDefined();
    expect(ctx.gameover.winners.length).toBeGreaterThan(0);
    expect(Object.keys(ctx.gameover.players)).toHaveLength(4);
    // Every color is stuck at game end.
    expect(COLOR_ORDER.every((c) => G.colors[c].stuck)).toBe(true);
    // A meaningful number of cells were filled.
    expect(G.board.filter((c) => c !== null).length).toBeGreaterThan(40);
  });
});
