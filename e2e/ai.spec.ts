import { test, expect } from '@playwright/test';

test('human vs 3 AI: human opens, the three AIs reply on their corners', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('3'); // you = P0 (blue)
  await page.getByTestId('start-ai').click();

  // Human (blue) is up first.
  await expect(page.getByText(/active blue/)).toBeVisible();
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click(); // covers blue's corner

  // The three AI seats each open by covering their own corner.
  await expect(page.getByTestId('cell-19-0')).toHaveAttribute('data-value', 'yellow', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('cell-19-19')).toHaveAttribute('data-value', 'red', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('cell-0-19')).toHaveAttribute('data-value', 'green', {
    timeout: 15_000,
  });

  // Control returns to the human.
  await expect(page.getByText(/active blue/)).toBeVisible();
});

test('all-AI watch game plays to completion with no human input', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();

  // With VITE_BOT_DELAY=0 the whole game runs in a few seconds.
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({
    timeout: 30_000,
  });
});
