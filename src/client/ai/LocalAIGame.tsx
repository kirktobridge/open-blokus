import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Client } from 'boardgame.io/client';
import type { BoardProps } from 'boardgame.io/react';
import type { Bot } from 'boardgame.io/ai';
import { BlokusGame, enumerate } from '../../bgio/BlokusGame';
import { HeuristicBot } from '../../bgio/bots/HeuristicBot';
import { MctsBot } from '../../bgio/bots/MctsBot';
import type { GameMode, GameState } from '../../game/types';
import { BlokusBoardView } from '../BlokusBoardView';
import { SessionActionsContext } from '../lobby/sessionContext';
import { useBotRunner } from './useBotRunner';
import { mctsConfigFor, type Difficulty } from './difficulty';

/**
 * Bot pacing in ms. A `?botDelay=` query param wins (so e2e can force instant
 * play regardless of which dev server it hits), else VITE_BOT_DELAY, else 600.
 */
function resolveBotDelay(): number {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('botDelay');
    if (q != null && q !== '') return Number(q);
  }
  return Number(import.meta.env.VITE_BOT_DELAY ?? 600);
}

/**
 * Offline single-player-vs-AI game on a local boardgame.io client. Human seats
 * are the first `mode − aiCount`; the rest are bots driven by useBotRunner. With
 * 0 human seats this is an all-AI game you simply watch.
 */
export function LocalAIGame({
  mode,
  aiCount,
  botDifficulties,
  onLeave,
}: {
  mode: GameMode;
  aiCount: number;
  /** Difficulty per bot seat (playerID). Seats absent here are human. */
  botDifficulties: Record<string, Difficulty>;
  onLeave: () => void;
}) {
  const client = useMemo(() => Client({ game: BlokusGame, numPlayers: mode }), [mode]);

  const humanCount = Math.max(0, mode - aiCount);
  const botSeats = useMemo(
    () =>
      Array.from({ length: mode }, (_, i) => String(i)).filter(
        (s) => Number(s) >= humanCount,
      ),
    [mode, humanCount],
  );

  // Stable key for the seat→difficulty map so worker/bot memos only rebuild when a
  // tier actually changes, not on every render (object identity would churn).
  const difficultyKey = botSeats.map((s) => `${s}:${botDifficulties[s] ?? 'easy'}`).join(',');

  // Each MCTS bot seat gets its own Web Worker so its per-color search trees stay
  // isolated — mixed tiers never share a tree (the worker keys trees by color).
  // Easy seats need no worker. Workers live in a ref (managed by the effect below)
  // rather than useMemo, so StrictMode's mount→cleanup→mount recreates them cleanly;
  // each bot reads its live worker lazily via getWorker and never holds a terminated one.
  const workersRef = useRef<Map<string, Worker>>(new Map());
  useEffect(() => {
    const workers = new Map<string, Worker>();
    for (const seat of botSeats) {
      if ((botDifficulties[seat] ?? 'easy') === 'easy') continue;
      workers.set(seat, new Worker(new URL('./mctsWorker.ts', import.meta.url), { type: 'module' }));
    }
    workersRef.current = workers;
    return () => {
      for (const w of workers.values()) w.terminate();
      if (workersRef.current === workers) workersRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyKey]);

  const botsBySeat = useMemo(() => {
    const bots = new Map<string, Bot>();
    for (const seat of botSeats) {
      const diff = botDifficulties[seat] ?? 'easy';
      if (diff === 'easy') {
        bots.set(seat, new HeuristicBot({ enumerate, seed: `vs-ai-${seat}` }));
      } else {
        bots.set(
          seat,
          new MctsBot({
            enumerate,
            seed: `vs-ai-${seat}`,
            getWorker: () => workersRef.current.get(seat) ?? null,
            config: mctsConfigFor(diff),
          }),
        );
      }
    }
    return bots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyKey]);

  // Heuristic (easy) needs an artificial pace to be watchable; MCTS's own search is
  // the pace, so it runs with no extra delay.
  const delayForSeat = useMemo(() => {
    const heuristicDelay = resolveBotDelay();
    return (seat: string) =>
      (botDifficulties[seat] ?? 'easy') === 'easy' ? heuristicDelay : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyKey]);

  const humanSeats = useMemo(
    () => new Set(Array.from({ length: humanCount }, (_, i) => String(i))),
    [humanCount],
  );

  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    client.start();
    const unsub = client.subscribe(() => force());
    return () => {
      unsub();
      client.stop();
    };
  }, [client]);

  const thinking = useBotRunner(client, botsBySeat, delayForSeat);

  const state = client.getState();
  if (!state) return <div style={{ padding: 16 }}>Loading…</div>;

  const isActive = humanSeats.has(state.ctx.currentPlayer) && !state.ctx.gameover;
  // Orient the board to the first human seat (undefined for all-AI watch games).
  const viewSeat = humanCount > 0 ? '0' : undefined;
  const boardProps = {
    G: state.G,
    ctx: state.ctx,
    moves: client.moves,
    isActive,
    playerID: viewSeat,
  } as unknown as BoardProps<GameState>;

  return (
    <SessionActionsContext.Provider
      value={{ onPlayAgain: () => client.reset(), onLeave }}
    >
      <div>
        <div style={{ padding: 8, fontFamily: 'system-ui, sans-serif' }}>
          <strong>vs AI</strong> · {humanCount} human / {aiCount} AI ·{' '}
          {botSeats.map((s) => botDifficulties[s] ?? 'easy').join(', ')}
          <span
            data-testid="ai-thinking"
            style={{
              marginLeft: 12,
              color: 'var(--fg-muted)',
              visibility: thinking ? 'visible' : 'hidden',
            }}
          >
            AI thinking…
          </span>
          <button data-testid="leave-ai" onClick={onLeave} style={{ marginLeft: 12 }}>
            Leave
          </button>
        </div>
        <BlokusBoardView {...boardProps} />
      </div>
    </SessionActionsContext.Provider>
  );
}
