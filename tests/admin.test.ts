import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from 'boardgame.io/server';
import type { Server as ServerTypes, StorageAPI } from 'boardgame.io';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { checkBasicAuth, stripCredentials, toMatchSummary } from '../src/server/admin';

/**
 * These exercise the admin building blocks against a real in-memory boardgame.io
 * store (the same store the server uses in dev/tests), plus the pure helpers.
 * The HTTP layer is a thin wrapper over these, covered by e2e/admin.spec.ts.
 */

function makeMetadata(overrides: Partial<ServerTypes.MatchData> = {}): ServerTypes.MatchData {
  return {
    gameName: 'open-blokus',
    players: {
      0: { id: 0, name: 'Alice', credentials: 'secret-a', isConnected: true },
      1: { id: 1 },
    },
    setupData: { mode: 2, scoring: 'basic' },
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('checkBasicAuth', () => {
  const opts = { user: 'admin', pass: 's3cret' };
  const header = 'Basic ' + Buffer.from('admin:s3cret').toString('base64');

  it('accepts the correct credentials', () => {
    expect(checkBasicAuth(header, opts)).toBe(true);
  });
  it('rejects a wrong password', () => {
    expect(checkBasicAuth('Basic ' + Buffer.from('admin:nope').toString('base64'), opts)).toBe(
      false,
    );
  });
  it('rejects missing / malformed headers', () => {
    expect(checkBasicAuth(undefined, opts)).toBe(false);
    expect(checkBasicAuth('Bearer xyz', opts)).toBe(false);
    expect(checkBasicAuth('Basic', opts)).toBe(false);
    expect(checkBasicAuth('Basic !!!notbase64', opts)).toBe(false);
  });
  it('accepts passwords containing a colon', () => {
    const h = 'Basic ' + Buffer.from('admin:a:b:c').toString('base64');
    expect(checkBasicAuth(h, { user: 'admin', pass: 'a:b:c' })).toBe(true);
  });
});

describe('toMatchSummary', () => {
  it('maps seats, counts filled, and never leaks credentials', () => {
    const s = toMatchSummary('m1', makeMetadata());
    expect(s.matchID).toBe('m1');
    expect(s.mode).toBe(2);
    expect(s.scoring).toBe('basic');
    expect(s.total).toBe(2);
    expect(s.filled).toBe(1);
    expect(s.seats).toEqual([
      { id: 0, name: 'Alice', connected: true },
      { id: 1, name: undefined, connected: false },
    ]);
    expect(JSON.stringify(s)).not.toContain('secret-a');
  });

  it('reports status: empty / active / gameover', () => {
    const empty = makeMetadata({ players: { 0: { id: 0 }, 1: { id: 1 } } });
    expect(toMatchSummary('m', empty).status).toBe('empty');
    expect(toMatchSummary('m', makeMetadata()).status).toBe('active');
    expect(toMatchSummary('m', makeMetadata({ gameover: { winner: 'blue' } })).status).toBe(
      'gameover',
    );
  });
});

describe('stripCredentials', () => {
  it('removes every seat credential but keeps other fields', () => {
    const stripped = stripCredentials(makeMetadata());
    expect(stripped.players[0].credentials).toBeUndefined();
    expect(stripped.players[0].name).toBe('Alice');
    expect(stripped.setupData).toEqual({ mode: 2, scoring: 'basic' });
  });
});

describe('admin operations against the in-memory store', () => {
  let db: StorageAPI.Async | StorageAPI.Sync;

  beforeEach(async () => {
    db = Server({ games: [BlokusGame] }).db;
    await db.connect();
    await db.createMatch('match-a', {
      initialState: { G: { board: [] }, ctx: { turn: 1, currentPlayer: '0' } } as never,
      metadata: makeMetadata(),
    });
    await db.createMatch('match-b', {
      initialState: { G: { board: [] }, ctx: { turn: 1, currentPlayer: '0' } } as never,
      metadata: makeMetadata({ createdAt: 5, updatedAt: 6 }),
    });
  });

  it('lists all created matches', async () => {
    const ids = await db.listMatches();
    expect(ids.sort()).toEqual(['match-a', 'match-b']);
  });

  it('wipe removes a single match (kill)', async () => {
    await db.wipe('match-a');
    expect((await db.listMatches()).sort()).toEqual(['match-b']);
    const { metadata } = await db.fetch('match-a', { metadata: true });
    expect(metadata).toBeUndefined();
  });

  it('booting a seat clears its name and credentials', async () => {
    const { metadata } = await db.fetch('match-a', { metadata: true });
    metadata.players[0] = { id: 0, name: undefined, credentials: undefined, isConnected: false };
    await db.setMetadata('match-a', metadata);

    const after = (await db.fetch('match-a', { metadata: true })).metadata;
    expect(after.players[0].name).toBeUndefined();
    expect(after.players[0].credentials).toBeUndefined();
    expect(toMatchSummary('match-a', after).filled).toBe(0);
  });
});
