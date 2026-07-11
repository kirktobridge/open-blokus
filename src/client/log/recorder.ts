/**
 * Game-logging foundation (product P1). Captures a *real* app game as the same
 * minimal record self-play uses — game header (mode, scoring, seats) + move list
 * — so every position, score and eval is regenerable by replay through the pure
 * rules core. No second schema: this extends src/game/ai/selfplay.ts.
 *
 * Capture is framework-agnostic: `attachRecorder` subscribes to a boardgame.io
 * client, reads accepted `placePiece` moves off `client.log`, and on game-over
 * builds + persists one record. The record is replay-validated and cross-checked
 * against the live final scores before it is saved, so a corrupt line can never
 * reach the log (same discipline as the self-play dump).
 */
import { COLOR_ORDER } from '../../game/types';
import type { Color, GameMode, GameState, Placement, ScoringVariant } from '../../game/types';
import { finalScores, determineWinners } from '../../game/scoring';
import { replayGame, type GameRecord, type LoggedMove } from '../../game/ai/selfplay';
import { saveRecord } from './sink';

/** Header the app supplies; mode/scoring are read from the live game state. */
export interface RecorderHeader {
  /** Owner label per color: "human", a bot tier ("easy"/"hard"/…), or "shared". */
  seats: Record<Color, string>;
  /** Provenance tag stored on the record, e.g. "vs-ai". */
  src: string;
}

/** The slice of a boardgame.io client the recorder needs (kept minimal for tests). */
export interface RecorderClient {
  getState(): { G: GameState; ctx: { gameover?: unknown } } | null;
  subscribe(fn: (state: { G: GameState; ctx: { gameover?: unknown } } | null) => void): () => void;
  log: Array<{ action?: { type?: string; payload?: { type?: string; args?: unknown[] } } }>;
}

/** GameOver payload shape from BlokusGame.endIf (= finalScores). */
interface GameOver {
  colors: Record<Color, number>;
}

/**
 * Build a GameRecord from a captured move list. Replays the moves (validating
 * every one — throws on an illegal move) and derives scores + winner colors from
 * the final position, so the stored scores are guaranteed to match a replay.
 */
export function buildAppRecord(
  moves: LoggedMove[],
  opts: {
    seats: Record<Color, string>;
    src: string;
    mode: GameMode;
    scoring: ScoringVariant;
    endedAt?: number;
  },
): GameRecord {
  const finalG = replayGame(moves, undefined, opts.mode, opts.scoring);
  const scores = finalScores(finalG).colors;
  const winnerPlayers = new Set(determineWinners(finalG));
  const owners = finalG.config.owners;
  const winners = COLOR_ORDER.filter(
    (c) => owners[c] !== 'shared' && winnerPlayers.has(owners[c] as string),
  );
  return {
    seed: 0, // app games aren't seed-reproducible; the move list is the source of truth
    mode: opts.mode,
    scoring: opts.scoring,
    seats: opts.seats,
    moves,
    scores,
    winners,
    meta: { src: opts.src, endedAt: opts.endedAt ?? Date.now() },
  };
}

/**
 * Subscribe to a client and persist its game on game-over. Returns an
 * unsubscribe fn. Handles `client.reset()` (Play Again clears `client.log`) by
 * starting a fresh capture, so one attach spans many games.
 */
export function attachRecorder(
  client: RecorderClient,
  header: RecorderHeader,
  sink: (record: GameRecord) => void = (record) => void saveRecord(record),
  /**
   * Called with the finished, replay-validated record the moment a game ends —
   * the same record handed to `sink`. Lets the UI review the game just played
   * (product P2 R0) without re-parsing the log or waiting on persistence.
   */
  onRecord?: (record: GameRecord) => void,
): () => void {
  let consumed = 0;
  let saved = false;
  let moves: LoggedMove[] = [];
  const start = client.getState();
  // Color active *before* the pending move — advances one step behind the state.
  let activeBefore: Color = start ? COLOR_ORDER[start.G.activeColorIndex] : COLOR_ORDER[0];

  const handle = (state: { G: GameState; ctx: { gameover?: unknown } } | null) => {
    if (!state) return;
    const log = client.log ?? [];
    if (log.length < consumed) {
      // client.reset() emptied the log → a new game started.
      consumed = 0;
      saved = false;
      moves = [];
      activeBefore = COLOR_ORDER[state.G.activeColorIndex];
    }
    while (consumed < log.length) {
      const action = log[consumed++]?.action;
      if (action?.type === 'MAKE_MOVE' && action.payload?.type === 'placePiece') {
        const p = action.payload.args?.[0] as Placement | undefined;
        if (p) {
          moves.push({
            color: activeBefore,
            pieceId: p.pieceId,
            rotation: p.rotation,
            reflected: p.reflected,
            x: p.x,
            y: p.y,
          });
        }
      }
      // Each MAKE_MOVE advances the active color; the next move belongs to
      // whoever is active now. Local play dispatches one move per tick, so this
      // stays exact — and the score cross-check below catches any drift anyway.
      activeBefore = COLOR_ORDER[state.G.activeColorIndex];
    }

    if (state.ctx.gameover && !saved && moves.length > 0) {
      saved = true;
      try {
        const { mode, scoring } = state.G.config;
        const record = buildAppRecord(moves.slice(), {
          seats: header.seats,
          src: header.src,
          mode,
          scoring,
        });
        const live = state.ctx.gameover as GameOver;
        const ok = COLOR_ORDER.every((c) => record.scores[c] === live.colors[c]);
        if (!ok) {
          // Replay disagrees with the live result → capture is corrupt; drop it.
          console.warn('[gamelog] replay/live score mismatch — record dropped');
          return;
        }
        sink(record);
        onRecord?.(record);
      } catch (err) {
        console.warn('[gamelog] capture failed:', err);
      }
    }
  };

  const unsub = client.subscribe(handle);
  handle(client.getState()); // capture a game that is already over at attach time
  return unsub;
}
