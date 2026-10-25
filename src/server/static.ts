import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Context, Next } from 'koa';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

/** Prefixes owned by boardgame.io / the admin router — never shadowed by the SPA. */
const API_PREFIXES = ['/games', '/socket.io', '/admin', '/.well-known'];

/**
 * Serve the built client (`vite build` output) from the game server, so one
 * container hosts both on a single origin. GETs that match a file under `root`
 * get that file; any other non-API GET falls back to `index.html` (the app
 * routes via query string, so this only matters for stray paths). Hashed
 * assets under `/assets/` are cached hard; everything else revalidates.
 */
export function serveStatic(root: string) {
  const base = resolve(root);
  return async (ctx: Context, next: Next) => {
    if ((ctx.method !== 'GET' && ctx.method !== 'HEAD') || isApi(ctx.path)) return next();
    const file = normalize(join(base, decodeURIComponent(ctx.path)));
    if (file !== base && !file.startsWith(base + sep)) return next();
    const target = (await isFile(file)) ? file : join(base, 'index.html');
    ctx.type = TYPES[extname(target)] ?? 'application/octet-stream';
    ctx.set(
      'Cache-Control',
      ctx.path.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    );
    ctx.body = await readFile(target);
  };
}

function isApi(path: string): boolean {
  return API_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
