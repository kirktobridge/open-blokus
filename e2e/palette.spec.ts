import { test, expect } from '@playwright/test';

test('custom palette recolors placed pieces; default stays selectable', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Place a blue piece; it renders in the classic blue (#2563eb).
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click();
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', 'rgb(37, 99, 235)');

  // Create a custom palette (clones the active one) and recolor blue to black.
  await page.getByTestId('palette-toggle').click();
  await page.getByTestId('palette-new').click();
  await page.getByLabel('Custom 1 blue').fill('#000000');
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', 'rgb(0, 0, 0)');

  // Switching back to the immutable default restores the classic color.
  await page.getByRole('radio').first().check();
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
});
