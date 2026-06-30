import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { RandomBot, Step } from 'boardgame.io/ai';
import type { Ctx } from 'boardgame.io';
import { BlokusGame, enumerate } from '../src/bgio/BlokusGame';
import { generateLegalMoves } from '../src/game/moves';
import { createInitialState } from '../src/game/modes';
import { COLOR_ORDER } from '../src/game/types';
import { HeuristicBot } from '../src/bgio/bots/HeuristicBot';
import { chooseMove } from '../src/game/ai/heuristic';
import { pieceSize } from '../src/game/pieces';

describe('ai.enumerate', () => {
  it('matches generateLegalMoves for the active color and yields placePiece moves', () => {
    const G = createInitialState(4);
    const moves = enumerate(G, {} as Ctx, '0');
    const legal = generateLegalMoves(G, COLOR_ORDER[G.activeColorIndex]);
    expect(moves.length).toBe(legal.length);
    expect(moves.every((m) => 'move' in m && m.move === 'placePiece' && m.args?.length === 1)).toBe(
      true,
    );
  });
});

describe('RandomBot self-play', () => {
  it('plays a 4p game to completion via Step', async () => {
    const client = Client({ game: BlokusGame, numPlayers: 4 });
    const bot = new RandomBot({ enumerate, seed: 'seed-1' });
    let guard = 0;
    while (!client.getState()!.ctx.gameover && guard++ < 500) {
      await Step(client, bot);
    }
    expect(client.getState()!.ctx.gameover).toBeDefined();
    expect(COLOR_ORDER.every((c) => client.getState()!.G.colors[c].stuck)).toBe(true);
  });
});

describe('heuristic', () => {
  it('opens by playing a 5-square piece', () => {
    const G = createInitialState(4);
    const move = chooseMove(G, 'blue');
    expect(move).not.toBeNull();
    expect(pieceSize(move!.pieceId)).toBe(5);
  });

  it('is deterministic with a fixed tie-break', () => {
    const G = createInitialState(4);
    expect(chooseMove(G, 'blue', () => 0)).toEqual(chooseMove(G, 'blue', () => 0));
  });
});

describe('HeuristicBot self-play', () => {
  it('plays a 4p game to completion and fills the board well', async () => {
    const client = Client({ game: BlokusGame, numPlayers: 4 });
    const bot = new HeuristicBot({ enumerate, seed: 'heuristic-1' });
    let guard = 0;
    while (!client.getState()!.ctx.gameover && guard++ < 500) {
      await Step(client, bot);
    }
    const { G, ctx } = client.getState()!;
    expect(ctx.gameover).toBeDefined();
    expect(G.board.filter((c) => c !== null).length).toBeGreaterThan(40);
  });
});
