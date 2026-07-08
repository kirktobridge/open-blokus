import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Client } from 'boardgame.io/client';
import type { BoardProps } from 'boardgame.io/react';
import type { Bot } from 'boardgame.io/ai';
import { BlokusGame, enumerate } from '../../bgio/BlokusGame';
import { HeuristicBot } from '../../bgio/bots/HeuristicBot';
import { MctsBot } from '../../bgio/bots/MctsBot';
import type { Color, GameMode, GameState } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { ownersFor } from '../../game/modes';
import { remainingSquares } from '../../game/scoring';
import { BlokusBoardView } from '../BlokusBoardView';
import { useGameRecorder } from '../log/useGameRecorder';
import type { RecorderClient } from '../log/recorder';
import { useProgressionRecorder, type ProgressionClient } from '../progression/useProgressionRecorder';
import { MilestoneToasts } from '../progression/MilestoneToasts';
import { hardestTier } from '../progression/progression';
import { SessionActionsContext } from '../lobby/sessionContext';
import { SettingsPanel } from '../SettingsPanel';
import { ControlsHelp } from '../ControlsHelp';
import { ICON_CHIP, FONT_MONO, FONT_UI } from '../theme';
import { LeaveIcon } from '../icons';
import { useBotRunner } from './useBotRunner';
import { AiThinkingIndicator } from './AiThinkingIndicator';
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
  // debug:false so the redesigned table owns the full width (no bgio panel).
  const client = useMemo(
    () => Client({ game: BlokusGame, numPlayers: mode, debug: false }),
    [mode],
  );

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

  // Seat provenance per color for the game log (product P1): "human", a bot tier,
  // or "shared" for the 3p rotating color. Read by useGameRecorder.
  const seats = useMemo(() => {
    const owners = ownersFor(mode);
    const out = {} as Record<Color, string>;
    for (const c of COLOR_ORDER) {
      const owner = owners[c];
      out[c] =
        owner === 'shared' ? 'shared' : humanSeats.has(owner) ? 'human' : botDifficulties[owner] ?? 'easy';
    }
    return out;
    // botDifficulties is read via the stable difficultyKey proxy (as elsewhere here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, humanCount, difficultyKey]);
  useGameRecorder(
    client as unknown as RecorderClient,
    useMemo(() => ({ seats, src: 'vs-ai' }), [seats]),
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

  const { since: thinkingSince } = useBotRunner(client, botsBySeat, delayForSeat);

  // Record each finished game into local progression (P15) and surface milestone
  // toasts. Watch games (no human seat) are skipped. "You" is seat 0.
  const { toasts: milestoneToasts, dismiss: dismissMilestones } = useProgressionRecorder(
    client as unknown as ProgressionClient,
    (G, gameover) => {
      if (humanCount === 0) return null;
      const you = '0';
      const owners = G.config.owners;
      const yourColors = COLOR_ORDER.filter((c) => owners[c] === you);
      const tiers = botSeats.map((s) => botDifficulties[s] ?? 'easy');
      return {
        won: gameover.winners.includes(you),
        score: gameover.players[you] ?? 0,
        hardestTier: hardestTier(tiers),
        perfectClear: yourColors.length > 0 && yourColors.every((c) => remainingSquares(G.colors[c]) === 0),
      };
    },
  );

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
      <div style={{ background: 'var(--table-bg)', minHeight: '100vh' }}>
        {/* TopBar — wordmark · match chip · status · utility chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 26px',
            fontFamily: FONT_UI,
          }}
        >
          <span style={{ fontFamily: FONT_UI, fontWeight: 900, fontSize: 25, color: 'var(--top-ink)' }}>
            OpenBlokus
          </span>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '.09em',
              color: 'var(--top-mut)',
              border: '1px solid var(--top-bd)',
              borderRadius: 999,
              padding: '5px 12px',
            }}
          >
            Local game
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--top-mut)' }}>
            {humanCount} human / {aiCount} AI
          </span>
          <AiThinkingIndicator since={thinkingSince} />

          <span style={{ flex: 1 }} />

          <SettingsPanel docked />
          <ControlsHelp docked />
          <button
            data-testid="leave-ai"
            onClick={onLeave}
            aria-label="Leave table"
            title="Leave table"
            style={{ ...ICON_CHIP, opacity: 0.85 }}
          >
            <LeaveIcon />
          </button>
        </div>
        <BlokusBoardView {...boardProps} botDifficulties={botDifficulties} />
      </div>
      <MilestoneToasts items={milestoneToasts} onDismiss={dismissMilestones} />
    </SessionActionsContext.Provider>
  );
}
