import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Start a Duo game against one easy bot from the Custom Game screen. */
async function startDuo(page: Page) {
  await page.getByTestId('open-custom').click();
  await page.getByTestId('variant-select').selectOption('duo');
  await page.getByTestId('ai-count-select').selectOption('1');
  await page.getByTestId('start-ai').click();
}

test('Duo deals a 14×14 board with black and white only (P20 M2b)', async ({ page }) => {
  await page.goto('/?botDelay=0');

  // Duo is a fixed two-seat game, so choosing it pins the player count.
  await page.getByTestId('open-custom').click();
  await page.getByTestId('variant-select').selectOption('duo');
  await expect(page.getByTestId('ai-mode-select')).toHaveValue('2');
  await expect(page.getByTestId('ai-mode-select')).toBeDisabled();
  await expect(page.getByTestId('custom-summary')).toContainText('Duo');

  await page.getByTestId('ai-count-select').selectOption('1');
  await page.getByTestId('start-ai').click();

  // The board is 14 wide, not 20: (13,13) exists and (14,0) does not.
  await expect(page.getByTestId('cell-13-13')).toBeVisible();
  await expect(page.getByTestId('cell-14-0')).toHaveCount(0);
  await expect(page.getByTestId('cell-19-19')).toHaveCount(0);

  // Black moves first and the Classic colors are not seated at all.
  await expect(page.getByText(/active black/)).toBeVisible();
  await expect(page.getByText(/active blue/)).toHaveCount(0);
});

test('Duo opens on its interior start cell, not a corner (P20 M2b)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await startDuo(page);

  // Black's opening piece must cover (4,4) — the interior starting point. A board
  // corner is not a start cell in Duo, which is the variant's defining rule.
  await expect(page.getByTestId('cell-4-4')).toHaveAttribute('data-starthint', 'true');
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-starthint', 'false');

  // Staging I1 on a board corner leaves Submit disabled and the cell empty.
  await page.getByTestId('piece-black-I1').click();
  await page.getByTestId('cell-0-0').click();
  await expect(page.getByTestId('submit-move')).toBeDisabled();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', '');

  // On the start cell it commits. (The first click off a staged cell picks the
  // piece back up — sticky carry, P23 M1 — so staging elsewhere takes two.)
  await page.getByTestId('cell-4-4').click();
  await page.getByTestId('cell-4-4').click();
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-4-4')).toHaveAttribute('data-value', 'black');
});
