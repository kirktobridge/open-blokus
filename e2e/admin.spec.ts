import { test, expect, request as pwRequest } from '@playwright/test';

const SERVER = 'http://localhost:8000';
const CREDS = { username: 'admin', password: 'test-pass' };

/**
 * The admin panel is served by the game server on :8000 (not the Vite app), and
 * is gated by Basic auth (credentials injected via playwright.config webServer env).
 */
test.describe('admin panel', () => {
  test('lists a match and kills it', async ({ browser }) => {
    // Create a match directly through the Lobby API.
    const api = await pwRequest.newContext();
    const res = await api.post(`${SERVER}/games/open-blokus/create`, {
      data: { numPlayers: 2, setupData: { mode: 2, scoring: 'basic' } },
    });
    expect(res.ok()).toBeTruthy();
    const { matchID } = (await res.json()) as { matchID: string };
    expect(matchID.length).toBeGreaterThan(0);

    // Open the admin panel with Basic-auth credentials.
    const ctx = await browser.newContext({ httpCredentials: CREDS });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept()); // auto-accept the kill confirm
    await page.goto(`${SERVER}/admin`);

    // The new match shows up in the table.
    const row = page.locator('tr', { hasText: matchID });
    await expect(row).toBeVisible();

    // Kill it; the row disappears after the panel refreshes.
    await row.getByRole('button', { name: 'Kill' }).click();
    await expect(page.locator('tr', { hasText: matchID })).toHaveCount(0);

    await ctx.close();
    await api.dispose();
  });

  test('requires authentication', async () => {
    const anon = await pwRequest.newContext();
    const res = await anon.get(`${SERVER}/admin`);
    expect(res.status()).toBe(401);
    await anon.dispose();
  });
});
