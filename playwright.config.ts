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
      env: { OBK_ADMIN_USER: 'admin', OBK_ADMIN_PASS: 'test-pass' }, // enable admin panel
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
