import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
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
