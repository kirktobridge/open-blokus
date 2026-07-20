import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Flip the Event Feed switch in Settings → Gameplay (Narration), then close the panel. */
async function setEventFeed(page: Page, on: boolean) {
  await page.getByTestId('settings-toggle').click();
  await page.getByRole('button', { name: 'Gameplay' }).click();
  const box = page.getByTestId('pref-event-feed');
  if (on) await box.check();
  else await box.uncheck();
  await page.getByTestId('settings-toggle').click(); // close
}

test('event feed accumulates the game’s beats as a persistent log (P43)', async ({ page }) => {
  // A 4-AI watch game with instant bots generates real beats (cuts, cramped,
  // out-of-moves, endgame) in seconds. The feed is on by default.
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();

  // The panel is present from the start (default on)...
  await expect(page.getByTestId('event-feed')).toBeVisible();

  // ...and by the time the game ends it holds a history of beats — unlike the
  // transient banners, these persist for review.
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({
    timeout: 30_000,
  });
  expect(await page.getByTestId('event-feed-entry').count()).toBeGreaterThan(0);
});

test('event feed toggle in Settings shows and hides the panel (P43)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Default on: the log panel is beside the board (empty-state until a beat fires).
  await expect(page.getByTestId('event-feed')).toBeVisible();

  // Ambient narration, not an advisor aid — but still user-controllable.
  await setEventFeed(page, false);
  await expect(page.getByTestId('event-feed')).toHaveCount(0);

  await setEventFeed(page, true);
  await expect(page.getByTestId('event-feed')).toBeVisible();
});
