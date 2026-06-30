import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { generateLegalMoves } from '../src/game/moves';

/**
 * Uses the Local master to simulate networked play in-process: separate clients
 * per seat sharing one authoritative state. This is the headless equivalent of
 * "a move in browser A shows up in browser B" plus turn/credential gating.
 */
describe('multiplayer (Local master)', () => {
  it('syncs moves across clients and gates by turn/seat', () => {
    const spec = { game: BlokusGame, multiplayer: Local(), numPlayers: 4 };
    const p0 = Client({ ...spec, playerID: '0' });
    const p1 = Client({ ...spec, playerID: '1' });
    const spectator = Client({ ...spec }); // no playerID → spectator
    p0.start();
    p1.start();
    spectator.start();

    try {
      // Player 0 (blue) plays the first move.
      const blueMove = generateLegalMoves(p0.getState()!.G, 'blue')[0];
      p0.moves.placePiece(blueMove);

      // The move is visible to the other clients (state is shared).
      expect(p1.getState()!.G.board.some((c) => c === 'blue')).toBe(true);
      expect(spectator.getState()!.G.board.some((c) => c === 'blue')).toBe(true);
      // Turn advanced to player 1 (yellow).
      expect(p1.getState()!.ctx.currentPlayer).toBe('1');

      const filled = () => p1.getState()!.G.board.filter((c) => c !== null).length;
      const before = filled();
      const yellowMove = generateLegalMoves(p1.getState()!.G, 'yellow')[0];

      // Player 0 can't move out of turn; spectator can't move at all.
      p0.moves.placePiece(yellowMove);
      spectator.moves.placePiece(yellowMove);
      expect(filled()).toBe(before);

      // Player 1, whose turn it is, can.
      p1.moves.placePiece(yellowMove);
      expect(p0.getState()!.G.board.some((c) => c === 'yellow')).toBe(true);
      expect(p0.getState()!.ctx.currentPlayer).toBe('2');
    } finally {
      p0.stop();
      p1.stop();
      spectator.stop();
    }
  });
});
