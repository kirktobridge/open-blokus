import { Server, Origins, FlatFile } from 'boardgame.io/server';
import { BlokusGame } from '../bgio/BlokusGame';

const PORT = Number(process.env.PORT ?? 8000);

/**
 * Allowed CORS origins. In production set OBK_ORIGINS to a comma-separated list
 * of your site URLs; in dev any localhost page is allowed.
 */
const origins = process.env.OBK_ORIGINS
  ? process.env.OBK_ORIGINS.split(',').map((s) => s.trim())
  : [Origins.LOCALHOST_IN_DEVELOPMENT];

/**
 * Persistent storage. Set OBK_DB_DIR to a directory to keep matches across
 * restarts (FlatFile / node-persist); otherwise the default in-memory store is
 * used (fine for dev and tests).
 */
const dbDir = process.env.OBK_DB_DIR;

const server = Server({
  games: [BlokusGame],
  origins,
  ...(dbDir ? { db: new FlatFile({ dir: dbDir }) } : {}),
});

server.run(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `OpenBlokus server on :${PORT} (storage: ${dbDir ? `flatfile ${dbDir}` : 'in-memory'})`,
  );
});
