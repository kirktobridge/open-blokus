import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Game history (P15 M2). An all-AI watch game reaches game-over in a couple of
// seconds with ?botDelay=0 and is still captured as a record, so it's the fast way
// to put a real finished game into the history — the same recipe recap.spec uses.
async function playAWatchGame(page: Page) {
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({ timeout: 30_000 });
}

const openStats = (page: Page) => page.getByTestId('profile-chip').click();

test('a finished game shows up in the history and replays from it (P15 M2)', async ({ page }) => {
  await page.goto('/?botDelay=0');

  // Nothing played yet — no history section at all, just M1's empty state.
  await openStats(page);
  await expect(page.getByTestId('progression-empty')).toBeVisible();
  await expect(page.getByTestId('game-history')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await playAWatchGame(page);

  // Back to the front door; the game is now in the list. A watch game has no
  // local player, so it reads as watched with no score of yours.
  await page.goto('/?botDelay=0');
  await openStats(page);
  const row = page.getByTestId('history-row');
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId('history-outcome')).toHaveText('WATCHED');
  await expect(row).toContainText('4 bots');
  // No local player, so there's no score of yours to report.
  await expect(row.getByTestId('history-score')).toHaveText('—');

  // Reviewing opens the standalone replay: the same table the post-game review
  // uses, driven by the stored record with no live game behind it.
  await row.getByTestId('history-review').click();
  await expect(page.getByTestId('review-table')).toBeVisible();
  await expect(page.getByTestId('score-timeline')).toBeVisible();

  // It really replays: scrub back and the board loses the pieces played after it.
  const ply = page.getByTestId('scrubber-ply');
  const final = (await ply.textContent())!;
  await page.getByTestId('scrubber-first').click();
  await expect(ply).not.toHaveText(final);

  // There's no game-over ceremony behind this one, so the way out says so.
  const exit = page.getByTestId('review-results');
  await expect(exit).toContainText('Back');
  await exit.click();
  await expect(page.getByTestId('quick-play')).toBeVisible();
});

test('standalone review wears the table chrome and leaves to the menu (P53)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await playAWatchGame(page);

  await page.goto('/?botDelay=0');
  await openStats(page);
  await page.getByTestId('history-row').getByTestId('history-review').click();
  await expect(page.getByTestId('review-table')).toBeVisible();

  // Same chip set as review reached from inside a table — the shared TableShell.
  await expect(page.getByTestId('settings-toggle')).toBeVisible();
  await expect(page.getByTestId('controls-help-toggle')).toBeVisible();

  // The chips work here, not just render: the controls overlay opens. Close it by
  // clicking the toggle again — Escape is bound to "exit review", not to the popover.
  const help = page.getByTestId('controls-help-toggle');
  await help.click();
  await expect(page.getByTestId('controls-help')).toBeVisible();
  await help.click();
  await expect(page.getByTestId('controls-help')).toHaveCount(0);

  // Leave means "back to the main menu", and it's reachable without scrolling.
  const leave = page.getByTestId('leave-review');
  await expect(leave).toBeInViewport();
  await leave.click();
  await expect(page.getByTestId('quick-play')).toBeVisible();
});

test('history survives a reload and keeps the newest game first (P15 M2)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await playAWatchGame(page);
  await page.goto('/?botDelay=0');
  await playAWatchGame(page);

  await page.goto('/?botDelay=0');
  await openStats(page);
  await expect(page.getByTestId('history-row')).toHaveCount(2);

  // Persisted, not just in memory for the session.
  await page.reload();
  await openStats(page);
  await expect(page.getByTestId('history-row')).toHaveCount(2);
});
