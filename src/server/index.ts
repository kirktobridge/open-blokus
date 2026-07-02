import { Server, Origins, FlatFile } from 'boardgame.io/server';
import { BlokusGame } from '../bgio/BlokusGame';
import { createAdminRouter } from './admin';

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

/**
 * Optional admin panel at /admin (list/kill/peek/boot matches + health). Gated
 * by HTTP Basic auth; the routes are only mounted when both OBK_ADMIN_USER and
 * OBK_ADMIN_PASS are set, so the panel is disabled by default.
 */
const adminUser = process.env.OBK_ADMIN_USER;
const adminPass = process.env.OBK_ADMIN_PASS;
if (adminUser && adminPass) {
  const admin = createAdminRouter(server.db, { user: adminUser, pass: adminPass });
  server.app.use(admin.routes()).use(admin.allowedMethods());
}

server.run(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `OpenBlokus server on :${PORT} (storage: ${dbDir ? `flatfile ${dbDir}` : 'in-memory'})`,
  );
  console.log(
    adminUser && adminPass
      ? 'Admin panel enabled at /admin'
      : 'Admin panel disabled (set OBK_ADMIN_USER + OBK_ADMIN_PASS to enable)',
  );
});
