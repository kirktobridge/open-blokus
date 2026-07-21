import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Toggle an Advisor Features switch in Settings → Gameplay (P38), then close the panel. */
async function setAdvisorPref(page: Page, testid: string, on: boolean) {
  await page.getByTestId('settings-toggle').click();
  await page.getByRole('button', { name: 'Gameplay' }).click();
  const box = page.getByTestId(testid);
  if (on) await box.check();
  else await box.uncheck();
  await page.getByTestId('settings-toggle').click(); // close
}

test('Move Options highlights the selected piece’s legal placements', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Advisor is opt-in: off by default, so selecting a piece shows no hints.
  await page.getByTestId('piece-blue-I2').click();
  await expect(page.getByTestId('hint-legal')).toHaveCount(0);

  // Turn it on in Settings → the I2's legal first-move squares light up:
  // (0,0),(1,0),(0,1).
  await setAdvisorPref(page, 'pref-move-options', true);
  await expect(page.getByTestId('hint-legal')).toHaveCount(3);

  // Toggling off clears the overlay; back on restores it (still blue's turn).
  await setAdvisorPref(page, 'pref-move-options', false);
  await expect(page.getByTestId('hint-legal')).toHaveCount(0);
  await setAdvisorPref(page, 'pref-move-options', true);
  await expect(page.getByTestId('hint-legal')).toHaveCount(3);

  // The overlay is display-only — a highlighted cell still places the piece.
  await page.getByTestId('cell-0-0').click(); // stage on the corner
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
});

test('Move Options marks the anchors under the footprint (P50)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Anchor marks ride on the same opt-in preference — off means neither layer.
  await page.getByTestId('piece-blue-I2').click();
  await expect(page.getByTestId('hint-anchor')).toHaveCount(0);

  // On the first move the only anchor is the start corner, so one pip sits inside
  // the three-cell footprint: the marks are strictly sparser than the reach.
  await setAdvisorPref(page, 'pref-move-options', true);
  await expect(page.getByTestId('hint-legal')).toHaveCount(3);
  await expect(page.getByTestId('hint-anchor')).toHaveCount(1);

  // The pip is a distinct mark, not another cell wash: a small square — square like
  // every other mark on this board — well under half a cell, so a board full of
  // anchors still reads as a scatter of points.
  const pip = page.getByTestId('hint-anchor').first();
  const cell = page.getByTestId('hint-legal').first();
  const pipBox = (await pip.boundingBox())!;
  const cellBox = (await cell.boundingBox())!;
  expect(pipBox.width).toBeLessThan(cellBox.width / 2);
  expect(pipBox.width).toBeCloseTo(pipBox.height, 0); // square, not a circle or a bar
  await expect(pip).toHaveCSS('border-radius', '1px');

  // Both layers ride the one opt-in preference.
  await setAdvisorPref(page, 'pref-move-options', false);
  await expect(page.getByTestId('hint-anchor')).toHaveCount(0);
});
