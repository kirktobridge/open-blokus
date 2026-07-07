import { test, expect } from '@playwright/test';

test('advisor toggle highlights the selected piece’s legal placements', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Advisor is opt-in: off by default, so selecting a piece shows no hints.
  await page.getByTestId('piece-blue-I2').click();
  await expect(page.getByTestId('hint-legal')).toHaveCount(0);
  await expect(page.getByTestId('advisor-toggle')).toHaveAttribute('aria-pressed', 'false');

  // Turn it on → the I2's legal first-move squares light up: (0,0),(1,0),(0,1).
  await page.getByTestId('advisor-toggle').click();
  await expect(page.getByTestId('advisor-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('hint-legal')).toHaveCount(3);

  // Toggling off clears the overlay; back on restores it (still blue's turn).
  await page.getByTestId('advisor-toggle').click();
  await expect(page.getByTestId('hint-legal')).toHaveCount(0);
  await page.getByTestId('advisor-toggle').click();
  await expect(page.getByTestId('hint-legal')).toHaveCount(3);

  // The overlay is display-only — a highlighted cell still places the piece.
  await page.getByTestId('cell-0-0').click(); // stage on the corner
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
});
