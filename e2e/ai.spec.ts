import { test, expect } from '@playwright/test';

test('human vs 3 AI: human opens, the three AIs reply on their corners', async ({
  page,
}) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('customize-toggle').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('3'); // you = P0 (blue)
  await page.getByTestId('start-ai').click();

  // Human (blue) is up first.
  await expect(page.getByText(/active blue/)).toBeVisible();
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click(); // stage on blue's corner
  await page.getByTestId('submit-move').click(); // commit

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

test('Quick Play starts a vs-AI game in one click (default: you vs 3 AI)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('quick-play').click();

  // Default setup is a 4p game with the human as blue, up first — one click in.
  await expect(page.getByText(/active blue/)).toBeVisible();
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click(); // stage on blue's corner
  await page.getByTestId('submit-move').click(); // commit

  // Proves the seats are AI: yellow replies on its own corner with no further input.
  await expect(page.getByTestId('cell-19-0')).toHaveAttribute('data-value', 'yellow', {
    timeout: 15_000,
  });
});

test('AI thinking indicator shows a live elapsed-seconds counter (P10)', async ({ page }) => {
  // A deliberate 1.5 s bot delay makes the counter observable without needing a
  // slow MCTS tier; the indicator ticks the same way for the real `extreme` wait.
  await page.goto('/?botDelay=1500');
  await page.getByTestId('customize-toggle').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('3'); // you = P0 (blue)
  await page.getByTestId('start-ai').click();

  // Human opens, handing the turn to the AI seats.
  await expect(page.getByText(/active blue/)).toBeVisible();
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('submit-move').click();

  // The indicator counts real elapsed seconds — proving it's not a static label.
  await expect(page.getByTestId('ai-thinking')).toHaveText(/AI thinking… [1-9]\d*s/, {
    timeout: 5_000,
  });
});

test('all-AI watch game plays to completion with no human input', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('customize-toggle').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();

  // ?botDelay=0 → instant bots, so the whole game runs in a couple of seconds.
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({
    timeout: 30_000,
  });
});
