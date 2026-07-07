import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Dev-only sink for captured game records (product P1). Appends each POSTed
 * JSON line to `.data/games/vs-ai.jsonl` — plain JSONL on disk, so records are
 * greppable and replayable with the same tooling as self-play (see
 * scripts/games.ts). Only mounted for `vite`/serve, never in the built app.
 */
function gameRecordSink(): Plugin {
  const OUT = '.data/games/vs-ai.jsonl';
  return {
    name: 'obk-game-record-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/games', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            JSON.parse(body); // reject anything that isn't a JSON record
            await mkdir(dirname(OUT), { recursive: true });
            await appendFile(OUT, body.trim() + '\n');
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 400;
            res.end('invalid record');
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), gameRecordSink()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
