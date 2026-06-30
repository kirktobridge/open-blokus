import { test, expect } from '@playwright/test';

test('keyboard rotate places a rotated piece, with last-move highlight', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Select the I2 domino and rotate it to vertical with the keyboard.
  await page.getByTestId('piece-blue-I2').click();
  await page.keyboard.press('r');
  await page.getByTestId('cell-0-0').click();

  // Vertical I2 covers (0,0) and (0,1); (1,0) stays empty.
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByTestId('cell-0-1')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByTestId('cell-1-0')).toHaveAttribute('data-value', '');

  // The placed cells carry the last-move highlight.
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-lastmove', 'true');
  await expect(page.getByTestId('cell-0-1')).toHaveAttribute('data-lastmove', 'true');
});
