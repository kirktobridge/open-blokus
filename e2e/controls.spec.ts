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

  // Blue (seat 0) is oriented with its corner bottom-right, so the board view is
  // rotated 180°. Arrow keys are screen-relative, so screen right/down drive the
  // ghost toward blue's true corner (0,0).
  await expect(page.getByTestId('board-rotator')).toHaveCSS(
    'transform',
    'matrix(-1, 0, 0, -1, 0, 0)',
  );

  // Select the domino from the tray (a non-focusable div, so Space/Enter below
  // reach the window handler rather than re-toggling the piece).
  await page.getByTestId('piece-blue-I2').click();

  // Drive the ghost from centre to the visual (screen) corner = true (0,0).
  await press(page, 'ArrowDown', 1); // seed hover at centre (10,10)
  await press(page, 'ArrowRight', 10); // screen-right -> board x: 10 -> 0
  await press(page, 'ArrowDown', 10); // screen-down -> board y: 10 -> 0

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

test('rotate-board button turns the board view 90°', async ({ page }) => {
  await createMatchAsBlue(page);
  const rotator = page.getByTestId('board-rotator');

  // Blue is oriented bottom-right = 180°.
  await expect(rotator).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');

  // Each click adds a 90° clockwise turn (180° -> 270°).
  await page.getByTestId('rotate-board').click();
  await expect(rotator).toHaveCSS('transform', 'matrix(0, -1, 1, 0, 0, 0)');
});
