import { defineConfig } from '@playwright/test';
import { cpus, freemem, totalmem } from 'node:os';
import { readFileSync } from 'node:fs';

/**
 * Memory actually available to start new processes, in MB. `os.freemem()` reports
 * Linux's MemFree, which counts the page cache as *used* and so wildly understates
 * headroom; /proc/meminfo's MemAvailable is the number the kernel itself uses to
 * answer "can I allocate this". Falls back to freemem() off Linux.
 */
function availableMB(): number {
  try {
    const m = /^MemAvailable:\s+(\d+) kB$/m.exec(readFileSync('/proc/meminfo', 'utf8'));
    if (m) return Number(m[1]) / 1024;
  } catch {
    /* not Linux, or no procfs */
  }
  return freemem() / 1024 / 1024;
}

/**
 * How many browsers this machine can actually afford *right now*.
 *
 * Playwright's default (half the cores) is a CPU heuristic that ignores memory: on a
 * 16-core WSL2 box it launches 8 Chromium instances, which together with the three
 * webServers below — and any parallel dev session sharing the same VM — has OOM-killed
 * the whole WSL2 guest, taking the terminal with it. Workers are memory-bound here, not
 * CPU-bound, so budget them against live MemAvailable and keep a reserve for the servers.
 *
 * Override with `PW_WORKERS=n` when you know what the box can take.
 */
const PER_WORKER_MB = 1024; // a Chromium instance + its page, with slack
const SERVER_RESERVE_MB = 2048; // the 3 webServers, vite's transform cache, the OS
const MAX_WORKERS = 4; // past this the suite is I/O-bound anyway — no upside to risk

function safeWorkers(): number {
  const override = Number(process.env.PW_WORKERS);
  if (Number.isInteger(override) && override > 0) return override;
  const budget = Math.floor((availableMB() - SERVER_RESERVE_MB) / PER_WORKER_MB);
  return Math.max(1, Math.min(MAX_WORKERS, Math.floor(cpus().length / 2), budget));
}

const workers = safeWorkers();
if (workers < MAX_WORKERS) {
  const avail = Math.round(availableMB());
  const total = Math.round(totalmem() / 1024 / 1024);
  console.log(`[playwright] ${workers} worker(s) — ${avail}MB of ${total}MB available.`);
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run serve',
      url: 'http://localhost:8000/games',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    // Admin panel lives on its own port so a developer's own `npm run serve` on
    // :8000 (which lacks the admin creds) can't shadow it. Never reused — Playwright
    // always launches this one with the creds, so admin.spec's auth is deterministic.
    {
      command: 'npm run serve',
      url: 'http://localhost:8001/games',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORT: '8001', OBK_ADMIN_USER: 'admin', OBK_ADMIN_PASS: 'test-pass' },
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
      env: { VITE_BOT_DELAY: '0' }, // instant bots for e2e
    },
  ],
});
