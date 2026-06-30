import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { setup, validateSetupData } from '../src/bgio/setup';
import { createInitialState } from '../src/game/modes';
import { generateLegalMoves } from '../src/game/moves';
import { idx } from '../src/game/board';
import { COLOR_ORDER } from '../src/game/types';

/** Play the first legal move for whichever color is currently active. */
function playCurrent(client: ReturnType<typeof makeClient>) {
  const { G } = client.getState()!;
  const color = COLOR_ORDER[G.activeColorIndex];
  client.moves.placePiece(generateLegalMoves(G, color)[0]);
}

function makeClient(numPlayers: number) {
  return Client({ game: BlokusGame, numPlayers });
}

describe('turn order', () => {
  it('4p cycles blue→yellow→red→green by player 0→1→2→3', () => {
    const client = makeClient(4);
    const seq: string[] = [];
    const idxSeq: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { G, ctx } = client.getState()!;
      seq.push(ctx.currentPlayer);
      idxSeq.push(G.activeColorIndex);
      playCurrent(client);
    }
    expect(seq).toEqual(['0', '1', '2', '3', '0']);
    expect(idxSeq).toEqual([0, 1, 2, 3, 0]);
  });

  it('2p cycles players 0,1,0,1 across the four colors', () => {
    const client = makeClient(2);
    const seq: string[] = [];
    for (let i = 0; i < 5; i++) {
      seq.push(client.getState()!.ctx.currentPlayer);
      playCurrent(client);
    }
    expect(seq).toEqual(['0', '1', '0', '1', '0']);
  });

  it('3p rotates the shared color among players each round', () => {
    const client = makeClient(3);
    const seq: string[] = [];
    for (let i = 0; i < 4; i++) {
      seq.push(client.getState()!.ctx.currentPlayer);
      playCurrent(client);
    }
    // blue=0, yellow=1, red=2, green(shared)=0 on the first round.
    expect(seq).toEqual(['0', '1', '2', '0']);
    expect(client.getState()!.G.sharedRotation).toBe(1);

    const seq2: string[] = [];
    for (let i = 0; i < 4; i++) {
      seq2.push(client.getState()!.ctx.currentPlayer);
      playCurrent(client);
    }
    // Second round: green(shared) now goes to player 1.
    expect(seq2).toEqual(['0', '1', '2', '1']);
  });
});

describe('move validation', () => {
  it('rejects an illegal first move and leaves state unchanged', () => {
    const client = makeClient(4);
    // First move must cover the corner (0,0); (5,5) does not.
    client.moves.placePiece({ pieceId: 'I1', rotation: 0, reflected: false, x: 5, y: 5 });
    const { G, ctx } = client.getState()!;
    expect(ctx.currentPlayer).toBe('0');
    expect(G.activeColorIndex).toBe(0);
    expect(G.board.every((c) => c === null)).toBe(true);
  });
});

describe('game over', () => {
  it('endIf fires with scores when every color is stuck', () => {
    const scenario = {
      ...BlokusGame,
      setup: () => {
        const G = createInitialState(4, 'basic');
        G.board.fill('red');
        G.board[idx(0, 0)] = null; // leave blue's corner open
        G.colors.blue.remaining = ['I1'];
        for (const c of ['yellow', 'red', 'green'] as const) {
          G.colors[c].remaining = [];
          G.colors[c].hasStarted = true;
          G.colors[c].stuck = true;
        }
        return G;
      },
    };
    const client = Client({ game: scenario, numPlayers: 4 });
    client.moves.placePiece({ pieceId: 'I1', rotation: 0, reflected: false, x: 0, y: 0 });
    const { ctx } = client.getState()!;
    expect(ctx.gameover).toBeDefined();
    expect(ctx.gameover.winners).toContain('0');
  });
});

describe('setup / validateSetupData', () => {
  it('setup builds owners from mode', () => {
    const ctx = { numPlayers: 3 } as never;
    expect(setup({ ctx } as never, { mode: 3, scoring: 'basic' }).config.owners.green).toBe(
      'shared',
    );
    expect(setup({ ctx: { numPlayers: 4 } } as never, undefined).config.mode).toBe(4);
  });

  it('validateSetupData rejects mismatches', () => {
    expect(validateSetupData({ mode: 3, scoring: 'basic' }, 3)).toBeUndefined();
    expect(validateSetupData({ mode: 3 }, 4)).toBeDefined(); // mode != numPlayers
    expect(validateSetupData({ mode: 5 as never }, 5)).toBeDefined(); // bad mode
    expect(validateSetupData({ mode: 4, scoring: 'weird' as never }, 4)).toBeDefined();
  });
});
