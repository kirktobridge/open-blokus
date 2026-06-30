import { test, expect } from '@playwright/test';

// Create a 4p match and enter as P0 (blue), who moves first.
async function createMatchAsBlue(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();
}

test('illegal first move is rejected, legal corner move is accepted', async ({ page }) => {
  await createMatchAsBlue(page);

  // Illegal: I1 not on blue's corner (0,0) — nothing placed, still blue's turn.
  await page.getByTestId('piece-blue-I1').click();
  await page.getByTestId('cell-5-5').click();
  await expect(page.getByTestId('cell-5-5')).toHaveAttribute('data-value', '');
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Legal: I2 on the corner — covers (0,0) and (1,0); turn advances to yellow.
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByTestId('cell-1-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByText(/active yellow/)).toBeVisible();
});
