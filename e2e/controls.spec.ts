import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function createMatchAsBlue(page: Page) {
  await page.goto('/');
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();
}

const press = async (page: Page, key: string, times: number) => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};

test('keyboard-only: arrows position, WASD rotate, Space lock, Enter submit', async ({
  page,
}) => {
  await createMatchAsBlue(page);

  // Select the domino from the tray (a non-focusable div, so Space/Enter below
  // reach the window handler rather than re-toggling the piece).
  await page.getByTestId('piece-blue-I2').click();

  // Drive the ghost from the board centre (first move key seeds it) to (0,0).
  await press(page, 'ArrowUp', 1); // seed hover at centre (10,10)
  await press(page, 'ArrowLeft', 10); // x: 10 -> 0
  await press(page, 'ArrowUp', 10); // y: 10 -> 0

  // Rotate CW to vertical (D), then lock + submit — all from the keyboard.
  await page.keyboard.press('d');
  await page.keyboard.press('Space'); // stage (lock)
  await page.keyboard.press('Enter'); // commit

  // Vertical I2 on blue's corner covers (0,0) and (0,1); (1,0) stays empty.
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByTestId('cell-0-1')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByTestId('cell-1-0')).toHaveAttribute('data-value', '');
  await expect(page.getByText(/active yellow/)).toBeVisible();
});

test('Submit enables only for a legal, staged placement', async ({ page }) => {
  await createMatchAsBlue(page);

  // Nothing selected → no submit.
  await expect(page.getByTestId('submit-move')).toBeDisabled();

  await page.getByTestId('piece-blue-I2').click();
  await expect(page.getByTestId('submit-move')).toBeDisabled(); // selected, not staged

  // Lock on an illegal spot: staged but Submit stays disabled.
  await page.getByTestId('cell-5-5').click();
  await expect(page.getByTestId('submit-move')).toBeDisabled();

  // Lock on the legal corner: Submit enables; committing advances the turn.
  await page.getByTestId('cell-0-0').click();
  await expect(page.getByTestId('submit-move')).toBeEnabled();
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByText(/active yellow/)).toBeVisible();
});
