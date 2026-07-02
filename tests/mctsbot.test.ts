import { describe, it, expect } from 'vitest';
import type { Ctx, State } from 'boardgame.io';
import { MctsBot } from '../src/bgio/bots/MctsBot';
import { enumerate } from '../src/bgio/BlokusGame';
import { mctsStrategy } from '../src/game/ai/mcts';
import { createInitialState } from '../src/game/modes';
import { isLegalPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import type { GameState } from '../src/game/types';

/** In-process stand-in for the browser Worker: computes the move like mctsWorker. */
class MockWorker {
  private listeners: ((e: MessageEvent) => void)[] = [];
  addEventListener(_t: 'message', l: (e: MessageEvent) => void) {
    this.listeners.push(l);
  }
  removeEventListener(_t: 'message', l: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((x) => x !== l);
  }
  postMessage(msg: { id: number; G: GameState; color: string; config: object }) {
    const move = mctsStrategy(msg.config)(msg.G, msg.color as never, () => 0.5);
    const data = { id: msg.id, move };
    setTimeout(() => this.listeners.forEach((l) => l({ data } as MessageEvent)), 0);
  }
}

describe('MctsBot', () => {
  it('returns a legal placePiece action from the worker reply', async () => {
    const worker = new MockWorker();
    const bot = new MctsBot({
      enumerate,
      seed: 'test',
      getWorker: () => worker,
      config: { iterations: 20, rolloutDepth: 4, beam: 6 },
    });
    const G = createInitialState(4);
    const state = { G, ctx: { currentPlayer: '0' } as Ctx } as State<GameState>;

    const { action } = await bot.play(state, '0');
    const payload = (action as { payload?: { type?: string; args?: unknown[] } }).payload;
    expect(payload?.type).toBe('placePiece');
    const placement = payload?.args?.[0] as import('../src/game/types').Placement;
    expect(isLegalPlacement(G, 'blue', placement.pieceId, resolveCells(placement))).toBe(true);
  });
});
