import Router from '@koa/router';
import type { Context } from 'koa';
import type { Server as ServerTypes, StorageAPI } from 'boardgame.io';
import { adminPage } from './adminPage';

type Db = StorageAPI.Async | StorageAPI.Sync;

export interface AdminOpts {
  user: string;
  pass: string;
}

/** A player seat with its credential stripped. */
export interface AdminSeat {
  id: number;
  name?: string;
  connected: boolean;
}

/** Summary of a match for the admin list (no credentials). */
export interface MatchSummary {
  matchID: string;
  mode?: number;
  scoring?: string;
  seats: AdminSeat[];
  filled: number;
  total: number;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'gameover' | 'empty';
}

/** Metadata with every seat's credential removed (safe to send to the client). */
export function stripCredentials(metadata: ServerTypes.MatchData): ServerTypes.MatchData {
  const players: ServerTypes.MatchData['players'] = {};
  for (const [id, p] of Object.entries(metadata.players)) {
    players[Number(id)] = { ...p, credentials: undefined };
  }
  return { ...metadata, players };
}

/** Pure mapping from stored metadata to an admin list summary. */
export function toMatchSummary(matchID: string, metadata: ServerTypes.MatchData): MatchSummary {
  const seats = Object.values(metadata.players).map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.isConnected === true,
  }));
  const filled = seats.filter((s) => s.name != null && s.name !== '').length;
  const status: MatchSummary['status'] =
    metadata.gameover !== undefined ? 'gameover' : filled > 0 ? 'active' : 'empty';
  return {
    matchID,
    mode: metadata.setupData?.mode,
    scoring: metadata.setupData?.scoring,
    seats,
    filled,
    total: seats.length,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    status,
  };
}

/**
 * Check an `Authorization: Basic <base64>` header against the expected
 * credentials. Returns true only on an exact match.
 */
export function checkBasicAuth(header: string | undefined, opts: AdminOpts): boolean {
  if (!header) return false;
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return user === opts.user && pass === opts.pass;
}

/**
 * Build a Koa router that serves the admin panel and its JSON API. Every route
 * is gated by HTTP Basic auth. Callers should only mount this when credentials
 * are configured (see src/server/index.ts).
 */
export function createAdminRouter(db: Db, opts: AdminOpts): Router {
  const router = new Router();

  router.use(async (ctx: Context, next) => {
    if (!checkBasicAuth(ctx.get('authorization'), opts)) {
      ctx.status = 401;
      ctx.set('WWW-Authenticate', 'Basic realm="OpenBlokus Admin"');
      ctx.body = 'Authentication required';
      return;
    }
    await next();
  });

  router.get('/admin', (ctx: Context) => {
    ctx.type = 'text/html';
    ctx.body = adminPage();
  });

  router.get('/admin/api/health', async (ctx: Context) => {
    const ids = await db.listMatches();
    const mem = process.memoryUsage();
    ctx.body = {
      uptimeSec: Math.round(process.uptime()),
      memoryMB: Math.round(mem.rss / 1024 / 1024),
      matchCount: ids.length,
      node: process.version,
      storage: process.env.OBK_DB_DIR ? `flatfile ${process.env.OBK_DB_DIR}` : 'in-memory',
      now: Date.now(),
    };
  });

  router.get('/admin/api/matches', async (ctx: Context) => {
    const ids = await db.listMatches();
    const matches: MatchSummary[] = [];
    for (const id of ids) {
      const { metadata } = await db.fetch(id, { metadata: true });
      if (metadata) matches.push(toMatchSummary(id, metadata));
    }
    matches.sort((a, b) => b.updatedAt - a.updatedAt);
    ctx.body = { matches };
  });

  router.get('/admin/api/matches/:id', async (ctx: Context) => {
    const { id } = ctx.params;
    const { state, metadata, log } = await db.fetch(id, {
      state: true,
      metadata: true,
      log: true,
    });
    if (!metadata) {
      ctx.status = 404;
      ctx.body = { error: 'match not found' };
      return;
    }
    ctx.body = {
      metadata: stripCredentials(metadata),
      board: state?.G.board ?? null,
      currentPlayer: state?.ctx.currentPlayer ?? null,
      turn: state?.ctx.turn ?? null,
      moveCount: log?.length ?? 0,
      gameover: state?.ctx.gameover ?? null,
    };
  });

  router.delete('/admin/api/matches/:id', async (ctx: Context) => {
    const { id } = ctx.params;
    const { metadata } = await db.fetch(id, { metadata: true });
    if (!metadata) {
      ctx.status = 404;
      ctx.body = { error: 'match not found' };
      return;
    }
    await db.wipe(id);
    ctx.body = { ok: true };
  });

  router.post('/admin/api/matches/:id/boot/:seat', async (ctx: Context) => {
    const { id, seat } = ctx.params;
    const { metadata } = await db.fetch(id, { metadata: true });
    if (!metadata) {
      ctx.status = 404;
      ctx.body = { error: 'match not found' };
      return;
    }
    const seatNum = Number(seat);
    const player = metadata.players[seatNum];
    if (!player) {
      ctx.status = 404;
      ctx.body = { error: 'seat not found' };
      return;
    }
    metadata.players[seatNum] = {
      id: seatNum,
      name: undefined,
      credentials: undefined,
      isConnected: false,
    };
    await db.setMetadata(id, metadata);
    ctx.body = { ok: true };
  });

  return router;
}
