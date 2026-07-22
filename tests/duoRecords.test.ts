import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'boardgame.io/client';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { createInitialState, playColorsOf } from '../src/game/modes';
import { generateLegalMoves } from '../src/game/moves';
import { applyPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { buildRecap } from '../src/game/recap';
import {
  deserializeRecord,
  replayGame,
  serializeRecord,
  type GameRecord,
  type LoggedMove,
} from '../src/game/ai/selfplay';
import { attachRecorder, buildAppRecord, type RecorderClient } from '../src/client/log/recorder';
import { clearHistory, loadHistory, saveToHistory, summarize } from '../src/client/log/history';

/**
 * P56 guards. The persistence layer's failure mode for a structurally-new variant
 * is *silence* by design — the recorder catches and warns, `loadHistory` drops
 * unreadable rows — so these tests assert the silent paths are pass-through for
 * well-formed Duo data, not merely that they don't throw.
 */

const duoClient = () =>
  Client({
    game: { ...BlokusGame, setup: () => createInitialState(2, 'advanced', 'duo') },
    numPlayers: 2,
  }) as unknown as RecorderClient & { start(): void; stop(): void; moves: Record<string, (...a: unknown[]) => void> };

/** Play a whole Duo game on a local client, taking the first legal move each turn. */
function playDuoToEnd(client: ReturnType<typeof duoClient>): void {
  client.start();
  let guard = 0;
  while (!client.getState()!.ctx.gameover && guard++ < 120) {
    const { G } = client.getState()!;
    const moves = generateLegalMoves(G, playColorsOf(G)[G.activeColorIndex]);
    if (moves.length === 0) break;
    client.moves.placePiece(moves[0]);
  }
}

/** A short, genuinely legal Duo opening — generated rather than hand-typed. */
const duoMoves: LoggedMove[] = (() => {
  const G = createInitialState(2, 'advanced', 'duo');
  const out: LoggedMove[] = [];
  for (let ply = 0; ply < 3; ply++) {
    const color = playColorsOf(G)[G.activeColorIndex];
    const m = generateLegalMoves(G, color)[0];
    out.push({ color, ...m });
    applyPlacement(G, color, m.pieceId, resolveCells(m));
    G.activeColorIndex = (G.activeColorIndex + 1) % playColorsOf(G).length;
  }
  return out;
})();

/** Squares those moves cover — the replay must land exactly this many. */
const duoMoveSquares = duoMoves.reduce((n, m) => n + resolveCells(m).length, 0);

const duoRecord = (): GameRecord =>
  buildAppRecord(duoMoves, {
    seats: { black: 'human', white: 'hard' },
    src: 'vs-ai',
    mode: 2,
    scoring: 'advanced',
    variant: 'duo',
    endedAt: 1_000,
  });

describe('Duo records serialize and replay (P56)', () => {
  it('round-trips serialize → deserialize → replay', () => {
    const rec = duoRecord();
    expect(rec.variant).toBe('duo');

    const wire = serializeRecord(rec);
    expect(wire.v).toBe(3);
    expect(wire.variant).toBe('duo');
    // Move colors are indexed against the variant's own play-color list; against
    // COLOR_ORDER black/white would both serialize as −1.
    expect(wire.moves.map((m) => m[0])).toEqual([0, 1, 0]);
    expect(wire.seats).toEqual(['human', 'hard']);

    const back = deserializeRecord(wire);
    expect(back).toEqual(rec);

    const finalG = replayGame(back.moves, undefined, back.mode, back.scoring, back.variant);
    expect(finalG.board).toHaveLength(196);
    expect(finalG.board.filter((c) => c !== null)).toHaveLength(duoMoveSquares);
  });

  it('a v2 (pre-variant) line still reads as Classic', () => {
    const legacy = {
      v: 2 as const,
      seed: 0,
      mode: 4 as const,
      scoring: 'basic' as const,
      seats: ['human', 'easy', 'easy', 'easy'],
      moves: [[0, 'I1', 0, 0, 0, 0] as [0, 'I1', 0, 0, number, number]],
      scores: [1, 2, 3, 4],
      winners: [0],
    };
    const rec = deserializeRecord(legacy);
    expect(rec.variant).toBe('classic');
    expect(rec.seats.blue).toBe('human');
    expect(rec.moves[0].color).toBe('blue');
  });

  it('buildRecap replays a Duo record onto a 14×14 board', () => {
    const frames = buildRecap(duoRecord());
    expect(frames).toHaveLength(duoMoves.length + 1);
    expect(frames[0].board).toHaveLength(196);
    expect(Object.keys(frames[0].placed).sort()).toEqual(['black', 'white']);
    const blackSquares = duoMoves
      .filter((m) => m.color === 'black')
      .reduce((n, m) => n + resolveCells(m).length, 0);
    expect(frames[frames.length - 1].placed.black).toBe(blackSquares);
  });
});

describe('Duo survives the silent persistence paths (P56)', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
    clearHistory();
  });

  it('the recorder captures a finished Duo game rather than dropping it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = duoClient();
    const captured: GameRecord[] = [];
    const detach = attachRecorder(client, { seats: { black: 'human', white: 'hard' }, src: 'vs-ai' }, (r) =>
      captured.push(r),
    );

    playDuoToEnd(client);
    detach();
    client.stop();

    // The replay/live score cross-check must actually compare the Duo colors; if it
    // walked COLOR_ORDER it would compare four undefineds and pass vacuously, and a
    // real mismatch would warn-and-drop instead.
    expect(warn).not.toHaveBeenCalled();
    expect(captured).toHaveLength(1);
    expect(captured[0].variant).toBe('duo');
    expect(Object.keys(captured[0].scores).sort()).toEqual(['black', 'white']);
    warn.mockRestore();
  });

  it('loadHistory reads a stored Duo game back instead of dropping it', () => {
    const rec = duoRecord();
    saveToHistory(rec);
    const rows = loadHistory();
    expect(rows).toHaveLength(1);
    expect(rows[0].record.variant).toBe('duo');
    expect(rows[0].record.moves).toEqual(rec.moves);
  });

  it('summarize reads the Duo seat lineup instead of reporting a watched game', () => {
    const rec = duoRecord();
    const s = summarize({ id: '1', at: 1_000, record: rec });
    expect(s.outcome).not.toBe('watched');
    expect(s.yourScore).not.toBeNull();
    expect(s.lineup).toContain('hard');
  });
});
