import { test, expect } from '@playwright/test';

const CLASSIC_BLUE = 'rgb(37, 99, 235)';
const BLACK = 'rgb(0, 0, 0)';

test('editing a piece color forks the theme; the built-in stays classic', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Place a blue piece; it renders in the classic blue (--piece-blue).
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click();
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', CLASSIC_BLUE);

  // Settings → Piece colors: recoloring blue forks the active built-in (Linen)
  // into a user theme, and the placed piece repaints from the token.
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('user-theme')).toHaveCount(0);
  await page.getByLabel('blue piece color', { exact: true }).fill('#000000');
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', BLACK);
  await expect(page.getByTestId('user-theme')).toHaveCount(1);
  await expect(page.getByLabel('Rename Linen (custom)')).toHaveValue('Linen (custom)');

  // The built-ins are untouched by any amount of tinkering: selecting one restores
  // the classic blue, and the override does not leak into it.
  await page.getByRole('button', { name: 'Lamplight', exact: true }).click();
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', CLASSIC_BLUE);
  await page.getByRole('button', { name: 'Linen', exact: true }).click();
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', CLASSIC_BLUE);

  // Selecting the fork brings the custom color back — it survived, scoped to its
  // own theme.
  await page.getByLabel('Theme Linen (custom)').check();
  await expect(page.getByTestId('cell-0-0')).toHaveCSS('background-color', BLACK);

  // …and persists across a reload (one appearance key, applied before render).
  await page.reload();
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('user-theme')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByLabel('blue piece color', { exact: true })).toHaveValue('#000000');
});
