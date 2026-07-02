import { Bot } from 'boardgame.io/ai';
import type { State } from 'boardgame.io';
import type { Color, GameState, Placement } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import type { MctsConfig } from '../../game/ai/mcts';

/** Minimal Worker surface used here (keeps the bot testable/mocked). */
interface WorkerLike {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
}

type BotOptions = ConstructorParameters<typeof Bot>[0];

/**
 * boardgame.io bot backed by MCTS running in a Web Worker. `play` posts the state
 * to the worker and awaits the chosen placement, so the (potentially multi-second)
 * search never blocks the UI thread. Requests are correlated by id in case a stale
 * message arrives. Falls back to any legal move if the worker returns nothing.
 *
 * The worker is resolved lazily via `getWorker` (not held directly) so React
 * StrictMode's mount→cleanup→mount can recreate it underneath us without leaving
 * the bot pointing at a terminated worker.
 */
export class MctsBot extends Bot {
  private readonly getWorker: () => WorkerLike | null;
  private readonly config: Partial<MctsConfig>;
  private nextId = 0;

  constructor(opts: BotOptions & { getWorker: () => WorkerLike | null; config: Partial<MctsConfig> }) {
    super(opts);
    this.getWorker = opts.getWorker;
    this.config = opts.config;
  }

  async play(state: State<GameState>, playerID: string) {
    const { G, ctx } = state;
    const color = COLOR_ORDER[G.activeColorIndex];
    const move = await this.request(G, color);

    // Map the chosen placement back to its enumerated BotAction (bgio needs a real
    // action, not a raw {move,args}). The worker searched the same legal set, so a
    // match exists; fall back to any legal action defensively.
    const actions = this.enumerate(G, ctx, playerID);
    if (move) {
      const match = actions.find((a) => {
        const p = (a as { payload?: { args?: Placement[] } }).payload?.args?.[0];
        return (
          p &&
          p.pieceId === move.pieceId &&
          p.rotation === move.rotation &&
          p.reflected === move.reflected &&
          p.x === move.x &&
          p.y === move.y
        );
      });
      if (match) return { action: match };
    }
    return { action: actions[0] };
  }

  private request(G: GameState, color: Color): Promise<Placement | null> {
    const worker = this.getWorker();
    if (!worker) return Promise.resolve(null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        const data = e.data as { id: number; move: Placement | null };
        if (data.id !== id) return; // ignore replies to earlier requests
        worker.removeEventListener('message', onMessage);
        resolve(data.move);
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ id, G, color, config: this.config });
    });
  }
}
