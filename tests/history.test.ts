import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_CAP,
  clearHistory,
  loadHistory,
  saveToHistory,
  summarize,
} from '../src/client/log/history';
import { Client } from 'boardgame.io/client';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { attachRecorder, type RecorderClient } from '../src/client/log/recorder';
import { generateLegalMoves } from '../src/game/moves';
import type { GameRecord } from '../src/game/ai/selfplay';
import { COLOR_ORDER, type Color, type GameState } from '../src/game/types';

/** A minimal but valid record; the fields a history row reads are all explicit. */
function record(over: Partial<GameRecord> = {}): GameRecord {
  return {
    seed: 0,
    mode: 4,
    scoring: 'basic',
    seats: { blue: 'human', yellow: 'easy', red: 'easy', green: 'easy' },
    moves: [{ color: 'blue', pieceId: 'I2', rotation: 0, reflected: false, x: 0, y: 0 }],
    scores: { blue: 12, yellow: 5, red: 4, green: 3 },
    winners: ['blue'],
    meta: { src: 'vs-ai', endedAt: 1_000 },
    ...over,
  };
}

describe('game history store (P15 M2)', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
  });

  it('starts empty and survives a round trip through storage', () => {
    expect(loadHistory()).toEqual([]);
    saveToHistory(record());
    const [g] = loadHistory();
    // Stored serialized, so the check that matters is that a *replayable* record
    // comes back out — the review table gets handed this, not the raw entry.
    expect(g.record.moves).toEqual(record().moves);
    expect(g.record.seats).toEqual(record().seats);
    expect(g.record.winners).toEqual(['blue']);
  });

  it('lists newest first', () => {
    saveToHistory(record({ meta: { endedAt: 1 } }));
    saveToHistory(record({ meta: { endedAt: 2 } }));
    saveToHistory(record({ meta: { endedAt: 3 } }));
    expect(loadHistory().map((g) => g.at)).toEqual([3, 2, 1]);
  });

  it('evicts the oldest past the cap', () => {
    for (let i = 1; i <= HISTORY_CAP + 5; i++) saveToHistory(record({ meta: { endedAt: i } }));
    const games = loadHistory();
    expect(games).toHaveLength(HISTORY_CAP);
    expect(games[0].at).toBe(HISTORY_CAP + 5);
    expect(games[games.length - 1].at).toBe(6); // 1–5 fell off the end
  });

  it('drops an unreadable entry instead of losing the list', () => {
    saveToHistory(record({ meta: { endedAt: 2 } }));
    const stored = JSON.parse(localStorage.getItem('openblokus.gameHistory')!);
    localStorage.setItem(
      'openblokus.gameHistory',
      JSON.stringify([{ at: 3, rec: { v: 99 } }, ...stored]),
    );
    const games = loadHistory();
    expect(games).toHaveLength(1);
    expect(games[0].at).toBe(2);
  });

  it('is a no-op, not a throw, when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveToHistory(record())).not.toThrow();
    expect(loadHistory()).toEqual([]);
  });

  it('clears', () => {
    saveToHistory(record());
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe('history summary (P15 M2)', () => {
  const game = (r: GameRecord) => ({ id: '1', at: 1, record: r });

  it('reads a win against a uniform lineup', () => {
    expect(summarize(game(record()))).toMatchObject({
      outcome: 'won',
      yourScore: 12,
      lineup: 'vs 3 easy',
    });
  });

  it('carries the unit, because what the number means flips with the variant', () => {
    // basic = squares still in your tray (lower better); advanced = points.
    expect(summarize(game(record())).scoreUnit).toBe('left');
    expect(summarize(game(record({ scoring: 'advanced' }))).scoreUnit).toBe('pts');
  });

  it('names a mixed lineup seat by seat', () => {
    const s = summarize(
      game(
        record({
          seats: { blue: 'human', yellow: 'hard', red: 'easy', green: 'easy' },
          winners: ['red'],
        }),
      ),
    );
    expect(s.outcome).toBe('lost');
    expect(s.lineup).toBe('vs hard, easy, easy');
  });

  it('a game with no human seat was watched, and has no score of yours', () => {
    const s = summarize(
      game(
        record({
          seats: { blue: 'easy', yellow: 'easy', red: 'easy', green: 'easy' },
          winners: ['red'],
        }),
      ),
    );
    expect(s).toMatchObject({ outcome: 'watched', yourScore: null, lineup: '4 bots' });
  });

  it('totals every color you owned — a 2p seat plays two', () => {
    const s = summarize(
      game(
        record({
          mode: 2,
          seats: { blue: 'human', green: 'human', yellow: 'hard', red: 'hard' },
          scores: { blue: 10, green: 7, yellow: 2, red: 1 },
          winners: ['blue'],
        }),
      ),
    );
    expect(s.yourScore).toBe(17);
    expect(s.outcome).toBe('won');
  });

  it("ignores 3p's shared color — it is nobody's opponent", () => {
    const s = summarize(
      game(
        record({
          mode: 3,
          seats: { blue: 'human', yellow: 'easy', red: 'easy', green: 'shared' },
          winners: ['blue'],
        }),
      ),
    );
    expect(s.lineup).toBe('vs 2 easy');
  });
});

describe('history is fed by the recorder (P15 M2)', () => {
  it('a finished game reaches the browser history with no dev endpoint present', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
    // No fetch: the dev sink's POST can't even be attempted. The history write is
    // synchronous and independent of it — which is the whole reason this exists,
    // since a built app never has that endpoint.
    vi.stubGlobal('fetch', undefined);

    const client = Client({ game: BlokusGame, numPlayers: 4 });
    const seats: Record<Color, string> = {
      blue: 'human',
      yellow: 'hard',
      red: 'hard',
      green: 'hard',
    };
    // Default sink (no third argument) — the path a real game takes.
    const detach = attachRecorder(client as unknown as RecorderClient, { seats, src: 'vs-ai' });

    client.start();
    for (let guard = 0; guard < 500 && !client.getState()?.ctx.gameover; guard++) {
      const G = client.getState()!.G as GameState;
      client.moves.placePiece(generateLegalMoves(G, COLOR_ORDER[G.activeColorIndex])[0]);
    }
    detach();

    const [g] = loadHistory();
    expect(g).toBeDefined();
    expect(g.record.moves.length).toBeGreaterThan(20); // a real game, not a stub
    expect(summarize(g).lineup).toBe('vs 3 hard');
  });
});
