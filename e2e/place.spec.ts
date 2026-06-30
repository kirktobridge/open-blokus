import { test, expect } from '@playwright/test';

test('select a piece and place it on the corner (single-player)', async ({ page }) => {
  await page.goto('/');

  // Player 0 (blue) is active first.
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Select blue's I2 domino and place it on the corner (0,0).
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').hover();
  await page.getByTestId('cell-0-0').click();

  // I2 covers (0,0) and (1,0).
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByTestId('cell-1-0')).toHaveAttribute('data-value', 'blue');

  // Turn advanced to yellow.
  await expect(page.getByText(/active yellow/)).toBeVisible();
});

test('rejects an illegal first placement (not on the corner)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('piece-blue-I1').click();
  // (5,5) does not cover blue's corner — illegal first move, nothing placed.
  await page.getByTestId('cell-5-5').hover();
  await page.getByTestId('cell-5-5').click();
  await expect(page.getByTestId('cell-5-5')).toHaveAttribute('data-value', '');
  await expect(page.getByText(/active blue/)).toBeVisible();
});
