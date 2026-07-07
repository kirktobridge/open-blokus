import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { COLOR_ORDER } from '../src/game/types';
import type { Color, GameState } from '../src/game/types';
import { generateLegalMoves } from '../src/game/moves';
import { finalScores } from '../src/game/scoring';
import { replayGame, type GameRecord } from '../src/game/ai/selfplay';
import { attachRecorder, buildAppRecord, type RecorderClient } from '../src/client/log/recorder';

const SEATS: Record<Color, string> = { blue: 'human', yellow: 'hard', red: 'hard', green: 'hard' };

/** Drive a local client to game-over by playing the first legal move each turn. */
function playToEnd(client: ReturnType<typeof Client>): void {
  client.start();
  for (let guard = 0; guard < 500; guard++) {
    const s = client.getState();
    if (!s || s.ctx.gameover) return;
    const G = s.G as GameState;
    const color = COLOR_ORDER[G.activeColorIndex];
    const moves = generateLegalMoves(G, color);
    client.moves.placePiece(moves[0]);
  }
  throw new Error('game did not end within 500 plies');
}

describe('game-log capture (product P1)', () => {
  it('captures a real client game whose replay reproduces the live scores', () => {
    const client = Client({ game: BlokusGame, numPlayers: 4 });
    const captured: GameRecord[] = [];
    const detach = attachRecorder(
      client as unknown as RecorderClient,
      { seats: SEATS, src: 'test' },
      (r) => captured.push(r),
    );

    playToEnd(client);
    detach();

    expect(captured).toHaveLength(1);
    const rec = captured[0];
    expect(rec.moves.length).toBeGreaterThan(20); // a real game, not a stub
    expect(rec.mode).toBe(4);
    expect(rec.scoring).toBe('basic');
    expect(rec.seats).toEqual(SEATS);
    expect(rec.meta?.src).toBe('test');

    // The captured record replays to exactly the scores the live game ended on.
    const live = client.getState()!.ctx.gameover as { colors: Record<Color, number> };
    expect(rec.scores).toEqual(live.colors);
    const replayed = finalScores(replayGame(rec.moves, undefined, rec.mode, rec.scoring)).colors;
    expect(replayed).toEqual(rec.scores);
  });

  it('resets cleanly on client.reset() and captures each game independently', () => {
    const client = Client({ game: BlokusGame, numPlayers: 4 });
    const captured: GameRecord[] = [];
    const detach = attachRecorder(
      client as unknown as RecorderClient,
      { seats: SEATS, src: 'test' },
      (r) => captured.push(r),
    );

    playToEnd(client);
    const firstLen = captured[0].moves.length;
    client.reset();
    playToEnd(client);
    detach();

    expect(captured).toHaveLength(2);
    // The second game's move list is fresh, not accumulated onto the first.
    expect(captured[1].moves.length).toBe(firstLen);
    expect(captured[1].moves[0].color).toBe('blue');
  });

  it('buildAppRecord derives winner colors and a replayable score set', () => {
    const client = Client({ game: BlokusGame, numPlayers: 4 });
    const captured: GameRecord[] = [];
    const detach = attachRecorder(
      client as unknown as RecorderClient,
      { seats: SEATS, src: 'test' },
      (r) => captured.push(r),
    );
    playToEnd(client);
    detach();

    const rebuilt = buildAppRecord(captured[0].moves, {
      seats: SEATS,
      src: 'test',
      mode: 4,
      scoring: 'basic',
      endedAt: 0,
    });
    expect(rebuilt.winners.length).toBeGreaterThan(0);
    // Winners are the colors with the best (lowest, basic) score.
    const best = Math.min(...COLOR_ORDER.map((c) => rebuilt.scores[c]));
    for (const c of rebuilt.winners) expect(rebuilt.scores[c]).toBe(best);
  });
});
