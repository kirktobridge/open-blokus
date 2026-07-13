import { test, expect } from '@playwright/test';

// P29 M1 — the front door: one large board carrying the page, one uniform vertical
// menu beside it holding every destination. Asserts the geometry (not pixels) and
// that each menu row lands where it says it does — Custom Game takes the view,
// friends and stats overlay it.

async function box(page: import('@playwright/test').Page, testId: string) {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`no bounding box for ${testId}`);
  return b;
}

const ROWS = ['quick-play', 'open-custom', 'open-puzzle', 'open-tutorial', 'open-friends', 'open-stats'];

test('wide viewport: board left, action menu right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const board = await box(page, 'home-hero');
  const menu = await box(page, 'action-menu');

  // Two columns: the menu starts to the right of the board, both aligned at the top.
  expect(menu.x).toBeGreaterThan(board.x + board.width - 4);
  expect(Math.abs(menu.y - board.y)).toBeLessThan(4);

  // The board carries the page — it's the largest object on it.
  expect(board.width).toBeGreaterThan(400);

  // Every destination is one click away, in one place, top-to-bottom in menu order.
  let lastY = -1;
  for (const row of ROWS) {
    const b = await box(page, row);
    expect(b.x).toBeGreaterThan(menu.x - 1);
    expect(b.y).toBeGreaterThan(lastY);
    lastY = b.y;
  }
});

test('narrow viewport: board stacked above the menu', async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 1100 });
  await page.goto('/');

  const board = await box(page, 'home-hero');
  const menu = await box(page, 'action-menu');

  expect(menu.y).toBeGreaterThan(board.y + board.height - 4);

  // Still one menu holding every destination — narrow drops nothing.
  for (const row of ROWS) await expect(page.getByTestId(row)).toBeVisible();
});

test('Quick Play says what it will start', async ({ page }) => {
  await page.goto('/');
  // Default saved setup: you against three easy bots, no clock.
  const row = page.getByTestId('quick-play');
  await expect(row).toContainText('You vs 3 bots');
  await expect(row).toContainText('all easy');
  await expect(row).toContainText('untimed');
});

test('Custom Game takes the view; Back returns to the front door', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-custom').click();

  // A screen, not an overlay — the menu is gone, not merely covered.
  await expect(page.getByTestId('custom-game')).toBeVisible();
  await expect(page.getByTestId('action-menu')).toHaveCount(0);

  await page.getByTestId('custom-back').click();
  await expect(page.getByTestId('action-menu')).toBeVisible();
});

test('friends and stats are glances that overlay the front door', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('open-friends').click();
  const friends = page.getByTestId('friends-modal');
  await expect(friends).toBeVisible();
  await expect(friends.getByTestId('create-match')).toBeVisible();
  // The door is still behind it — a glance, not a departure.
  await expect(page.getByTestId('action-menu')).toBeVisible();
  await page.getByTestId('friends-modal-close').click();
  await expect(friends).toHaveCount(0);

  await page.getByTestId('open-stats').click();
  await expect(page.getByTestId('stats-modal')).toBeVisible();
  await expect(page.getByTestId('progression-panel')).toBeVisible();

  // Escape closes a glance.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stats-modal')).toHaveCount(0);
});

test('Daily Puzzle carries a New today badge until you open it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('open-puzzle-badge')).toHaveText('New today');

  // Opening today's puzzle spends the badge — it's gone when you come back.
  await page.getByTestId('open-puzzle').click();
  await expect(page.getByTestId('puzzle-score')).toBeVisible();
  await page.getByTestId('leave-puzzle').click();

  await expect(page.getByTestId('open-puzzle')).toBeVisible();
  await expect(page.getByTestId('open-puzzle-badge')).toHaveCount(0);
});
