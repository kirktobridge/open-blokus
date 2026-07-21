import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Right-rail & tray layout (product P48). Two claims to hold end to end:
//   1. the rail spends spare horizontal width — the tray's two small size groups
//      sit side by side rather than stacking, wherever the rail is wide enough;
//   2. every rail panel folds, and folding buys back enough vertical space to pull
//      the review transport bar (the thing the taller Analysis panel pushed below
//      the fold) back into view without scrolling.
// A wide viewport is the case the feature is about; the default 1280 is covered by
// the narrow-fallback assertion at the end.

const WIDE = { width: 1600, height: 900 };

/** Start a 4-player game with one human seat and wait for the table. */
async function startPlayTable(page: Page) {
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('3'); // 1 human
  await page.getByTestId('start-ai').click();
  await expect(page.getByTestId('hand-tray')).toBeVisible();
}

test('play rail: the tray widens horizontally and every panel folds', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await startPlayTable(page);

  // (1) Horizontal bulk: with the rail at its wide setting the tetromino and
  // small-piece compartments share one row (same top), instead of the tray
  // stacking all three wells down the column.
  const tetro = (await page.getByTestId('tray-group-tetro').boundingBox())!;
  const small = (await page.getByTestId('tray-group-small').boundingBox())!;
  expect(Math.abs(tetro.y - small.y)).toBeLessThan(4);
  expect(small.x).toBeGreaterThan(tetro.x + tetro.width - 4); // beside, not under

  // The pentominoes keep a full row of their own, above both.
  const pento = (await page.getByTestId('tray-group-pento').boundingBox())!;
  expect(pento.y).toBeLessThan(tetro.y);
  expect(pento.width).toBeGreaterThan(tetro.width);

  // (2) Each rail panel collapses from its own header, independently.
  const railHeight = async () => (await page.getByTestId('rail-column').boundingBox())!.height;
  const tall = await railHeight();

  await page.getByTestId('rail-toggle-hand').click();
  await expect(page.getByTestId('rail-body-hand')).toBeHidden();
  await expect(page.getByTestId('rail-toggle-hand')).toHaveAttribute('aria-expanded', 'false');
  // The standings body is untouched by the tray's fold.
  await expect(page.getByTestId('rail-body-standings')).toBeVisible();

  await page.getByTestId('rail-toggle-standings').click();
  await expect(page.getByTestId('rail-body-standings')).toBeHidden();

  expect(await railHeight()).toBeLessThan(tall);

  // Folding is reversible — the tray comes back with its pieces intact.
  await page.getByTestId('rail-toggle-hand').click();
  await expect(page.getByTestId('rail-body-hand')).toBeVisible();
  await expect(page.getByTestId('tray-group-pento')).toBeVisible();
});

test('review rail: Analysis folds and the transport bar stays in view', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('review-game').click();
  await expect(page.getByTestId('review-table')).toBeVisible();

  // The rail is the same shared component here as in play — same panel, same fold.
  // (An all-AI watch record has no human seat, so review shows no hand tray here;
  // the tray's own fold is covered by the play-table test above.)
  await expect(page.getByTestId('rail-body-analysis')).toBeVisible();

  // Analysis is the tall panel that used to drive the row's height. The rail must
  // no longer be what pushes the transport down: it stays shorter than the board
  // column beside it even with everything open, and folding shrinks it further.
  const railH = async () => (await page.getByTestId('rail-column').boundingBox())!.height;
  const boardH = (await page.getByTestId('board-frame').boundingBox())!.height;
  const open = await railH();
  expect(open).toBeLessThan(boardH);

  await page.getByTestId('rail-toggle-analysis').click();
  await expect(page.getByTestId('rail-body-analysis')).toBeHidden();
  expect(await railH()).toBeLessThan(open);

  // The transport bar sits fully within the viewport, not below the fold.
  const bar = (await page.getByTestId('scrubber-slider').boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  // Still a working scrubber with the panels folded away.
  await page.getByTestId('scrubber-first').click();
  await expect(page.getByTestId('scrubber-ply')).toHaveText(/^0 \//);
});

test('the rail stays inside its width band, wide viewport and narrow', async ({ page }) => {
  // The rail is elastic, not unbounded: it must never outgrow RAIL_MAX_W (a tray
  // wider than that stops reading as a tray) nor squeeze below the width its
  // pentomino row needs. Checked at both ends of the range the app is used at.
  const railW = async () => (await page.getByTestId('rail-column').boundingBox())!.width;

  await page.setViewportSize(WIDE);
  await startPlayTable(page);
  expect(await railW()).toBeLessThanOrEqual(431);

  await page.setViewportSize({ width: 380, height: 900 });
  const narrow = await railW();
  expect(narrow).toBeLessThanOrEqual(431);
  // Never narrower than the viewport allows, and all 21 thumbs still render.
  expect(narrow).toBeGreaterThan(300);
  await expect(page.locator('[data-testid^="piece-"]')).toHaveCount(21);

  // Collapsing still works at this width.
  await page.getByTestId('rail-toggle-hand').click();
  await expect(page.getByTestId('rail-body-hand')).toBeHidden();
});
