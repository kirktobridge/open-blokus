import { test, expect } from '@playwright/test';

// P27 + P28 — the home screen ranks itself into a play column (primary → daily
// hook → friends) beside a progress rail on wide viewports, and collapses to one
// centered stack in the same order on narrow ones. Assert the geometry, not pixels.

async function box(page: import('@playwright/test').Page, testId: string) {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`no bounding box for ${testId}`);
  return b;
}

test('wide viewport: ranked play column beside a progress rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const vs = await box(page, 'card-vs-computer');
  const daily = await box(page, 'card-daily');
  const friends = await box(page, 'card-friends');
  const rail = await box(page, 'progression-panel');

  // Play column: the three cards stack in one column, same left edge, top→bottom
  // in rank order (primary → daily → friends).
  expect(Math.abs(vs.x - daily.x)).toBeLessThan(4);
  expect(Math.abs(daily.x - friends.x)).toBeLessThan(4);
  expect(daily.y).toBeGreaterThan(vs.y);
  expect(friends.y).toBeGreaterThan(daily.y);

  // Rail sits to the right of the play column, aligned to the top card.
  expect(rail.x).toBeGreaterThan(vs.x + vs.width - 4);
  expect(Math.abs(rail.y - vs.y)).toBeLessThan(4);

  // Hero board is docked inside the primary card, not floating on its own.
  const hero = await box(page, 'home-hero');
  expect(hero.x + hero.width).toBeLessThanOrEqual(vs.x + vs.width + 1);
  expect(hero.y).toBeGreaterThanOrEqual(vs.y - 1);
});

test('narrow viewport: one centered stack in rank order', async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 1100 });
  await page.goto('/');

  const vs = await box(page, 'card-vs-computer');
  const daily = await box(page, 'card-daily');
  const friends = await box(page, 'card-friends');
  const rail = await box(page, 'progression-panel');

  // Single column: same left edge, stacked top→bottom, rail last.
  for (const b of [daily, friends, rail]) {
    expect(Math.abs(b.x - vs.x)).toBeLessThan(4);
  }
  expect(daily.y).toBeGreaterThan(vs.y);
  expect(friends.y).toBeGreaterThan(daily.y);
  expect(rail.y).toBeGreaterThan(friends.y);

  // Hero still docked inside the primary card (stacked on top of its body here).
  const hero = await box(page, 'home-hero');
  expect(hero.y).toBeGreaterThanOrEqual(vs.y - 1);
  expect(hero.y).toBeLessThan(daily.y);
});
