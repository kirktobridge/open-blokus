import { useEffect, useMemo, useReducer } from 'react';
import { Client } from 'boardgame.io/client';
import type { BoardProps } from 'boardgame.io/react';
import { BlokusGame, enumerate } from '../../bgio/BlokusGame';
import { HeuristicBot } from '../../bgio/bots/HeuristicBot';
import type { GameMode, GameState } from '../../game/types';
import { BlokusBoardView } from '../BlokusBoardView';
import { useBotRunner } from './useBotRunner';

/** Bot pacing; set VITE_BOT_DELAY=0 (e.g. in e2e) for instant play. */
const BOT_DELAY_MS = Number(import.meta.env.VITE_BOT_DELAY ?? 600);

/**
 * Offline single-player-vs-AI game on a local boardgame.io client. Human seats
 * are the first `mode − aiCount`; the rest are bots driven by useBotRunner. With
 * 0 human seats this is an all-AI game you simply watch.
 */
export function LocalAIGame({
  mode,
  aiCount,
  onLeave,
}: {
  mode: GameMode;
  aiCount: number;
  onLeave: () => void;
}) {
  const client = useMemo(() => Client({ game: BlokusGame, numPlayers: mode }), [mode]);
  const bot = useMemo(() => new HeuristicBot({ enumerate, seed: 'vs-ai' }), []);

  const humanCount = Math.max(0, mode - aiCount);
  const humanSeats = useMemo(
    () => new Set(Array.from({ length: humanCount }, (_, i) => String(i))),
    [humanCount],
  );
  const botSeats = useMemo(
    () =>
      new Set(
        Array.from({ length: mode }, (_, i) => String(i)).filter((s) => !humanSeats.has(s)),
      ),
    [mode, humanSeats],
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

  const thinking = useBotRunner(client, botSeats, bot, BOT_DELAY_MS);

  const state = client.getState();
  if (!state) return <div style={{ padding: 16 }}>Loading…</div>;

  const isActive = humanSeats.has(state.ctx.currentPlayer) && !state.ctx.gameover;
  const boardProps = {
    G: state.G,
    ctx: state.ctx,
    moves: client.moves,
    isActive,
  } as unknown as BoardProps<GameState>;

  return (
    <div>
      <div style={{ padding: 8, fontFamily: 'system-ui, sans-serif' }}>
        <strong>vs AI</strong> · {humanCount} human / {aiCount} AI
        <span
          data-testid="ai-thinking"
          style={{
            marginLeft: 12,
            color: '#6b7280',
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
  );
}
