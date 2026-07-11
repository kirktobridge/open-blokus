import { test, expect } from '@playwright/test';

// P27 — the home screen switches between a landscape (row) layout on wide
// viewports and the original single-column stack on narrow ones. Assert the
// geometry, not the pixels: cards side-by-side vs stacked.

async function box(page: import('@playwright/test').Page, testId: string) {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`no bounding box for ${testId}`);
  return b;
}

test('wide viewport lays the three action cards out in a row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const daily = await box(page, 'card-daily');
  const vs = await box(page, 'card-vs-computer');
  const online = await box(page, 'card-online');

  // Same row: tops aligned, left→right in reading order.
  expect(Math.abs(daily.y - vs.y)).toBeLessThan(4);
  expect(Math.abs(vs.y - online.y)).toBeLessThan(4);
  expect(vs.x).toBeGreaterThan(daily.x);
  expect(online.x).toBeGreaterThan(vs.x);

  // Hero is decorative — it sits below the action row, not beside it.
  const hero = await box(page, 'home-hero');
  expect(hero.y).toBeGreaterThan(daily.y + daily.height);
});

test('narrow viewport stacks the cards in one column, hero on top', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 1000 });
  await page.goto('/');

  const hero = await box(page, 'home-hero');
  const daily = await box(page, 'card-daily');
  const vs = await box(page, 'card-vs-computer');
  const online = await box(page, 'card-online');

  // Single column: same left edge, stacked top→bottom.
  expect(Math.abs(daily.x - vs.x)).toBeLessThan(4);
  expect(Math.abs(vs.x - online.x)).toBeLessThan(4);
  expect(vs.y).toBeGreaterThan(daily.y);
  expect(online.y).toBeGreaterThan(vs.y);

  // Portrait keeps the hero above the stack (unchanged from before P27).
  expect(hero.y).toBeLessThan(daily.y);
});
