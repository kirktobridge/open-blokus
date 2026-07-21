import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function createMatchAsBlue(page: Page) {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();
}

const press = async (page: Page, key: string, times: number) => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};

/** Where a board cell actually sits on screen — the only honest read of the view
 *  orientation now that it lives in the data rather than in a CSS transform (P49). */
async function cellAt(page: Page, x: number, y: number) {
  const box = await page.getByTestId(`cell-${x}-${y}`).boundingBox();
  if (!box) throw new Error(`cell ${x},${y} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The screen corner a board cell is drawn in, relative to the board's centre. */
async function cornerOf(page: Page, x: number, y: number) {
  const [c, mid] = [await cellAt(page, x, y), await cellAt(page, 10, 10)];
  return `${c.y < mid.y ? 'top' : 'bottom'}-${c.x < mid.x ? 'left' : 'right'}`;
}

test('keyboard-only: arrows position, WASD rotate, Space lock, Enter submit', async ({
  page,
}) => {
  await createMatchAsBlue(page);

  // Blue (seat 0) is oriented with its corner bottom-right, so the board view is
  // turned 180°. Arrow keys are screen-relative, so screen right/down drive the
  // ghost toward blue's true corner (0,0).
  expect(await cornerOf(page, 0, 0)).toBe('bottom-right');

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

  // Relocating a staged piece costs two clicks (P23 M1): the first board click picks
  // it back up (unstage) rather than silently relocating; the second re-stages at the
  // new cell. Unstage, then lock the legal corner — Submit enables and commits.
  await page.getByTestId('cell-0-0').click(); // pick it back up (unstage)
  await expect(page.getByTestId('submit-move')).toBeDisabled();
  await page.getByTestId('cell-0-0').click(); // re-stage on the legal corner
  await expect(page.getByTestId('submit-move')).toBeEnabled();
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByText(/active yellow/)).toBeVisible();
});

test('controls reference lists keyboard + mouse bindings (read-only)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('controls-help-toggle').click();
  const help = page.getByTestId('controls-help');
  await expect(help).toContainText('Submit move');
  await expect(help).toContainText('Enter'); // from the central keymap
  await expect(help).toContainText('Space');
  await expect(help).toContainText('Right-click');
  // No editing affordances — it's view-only (no inputs).
  await expect(help.locator('input')).toHaveCount(0);
});

test('rotate-board button turns the board view 90°, and settles upright (P49)', async ({
  page,
}) => {
  await createMatchAsBlue(page);
  const rotator = page.getByTestId('board-rotator');

  // The frame turns *with* the grid — it's inside the rotator, not around it — so
  // the spin reads as one rigid object rather than contents spinning loose.
  await expect(rotator.getByTestId('board-frame')).toBeVisible();

  // Blue is oriented bottom-right, and at rest that orientation is a fact about the
  // contents: nothing is left rotated by CSS.
  expect(await cornerOf(page, 0, 0)).toBe('bottom-right');
  await expect(rotator).toHaveCSS('transform', 'none');

  // Each click adds a clockwise quarter-turn — blue's corner walks bottom-right ->
  // bottom-left — and the grid settles upright again.
  await page.getByTestId('rotate-board').click();
  await expect.poll(() => cornerOf(page, 0, 0)).toBe('bottom-left');
  await expect(rotator).toHaveCSS('transform', 'none');

  // The re-index leaves one pointer space: the cell that looks like blue's corner
  // is the cell that plays as it.
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  expect(await cornerOf(page, 0, 0)).toBe('bottom-left');

  // The landing flash belongs to the *placement*, not to the view. Turning the
  // board re-indexes where that flash would be drawn, which is enough to remount
  // it and make a long-settled piece bloom white as though it had just been
  // played — caught by driving the real app, invisible to the rest of the suite.
  const settle = page.locator('.ob-settle');
  await expect(settle).toHaveCount(1);
  await page.waitForTimeout(900); // the one-shot flash decays in ~600ms
  await page.getByTestId('rotate-board').click();
  let peak = 0;
  for (let i = 0; i < 14; i++) {
    peak = Math.max(peak, Number(await settle.evaluate((el) => getComputedStyle(el).opacity)));
    await page.waitForTimeout(60);
  }
  expect(peak).toBeLessThan(0.05);
});

test('rotate-view control (P41) is faint at rest, revealed on hover and focus', async ({
  page,
}) => {
  await createMatchAsBlue(page);
  const rotate = page.getByTestId('rotate-board');

  // Icon-only: no "Rotate board" label, and an accessible name for screen readers.
  await expect(rotate).toHaveText('⟲');
  await expect(rotate).toHaveAttribute('aria-label', /rotate the board view/i);

  // Persistent target, but faint at rest so it recedes until wanted.
  await expect(rotate).toHaveCSS('opacity', '0.4');

  // Hovering the board frame reveals it to full opacity...
  await page.getByTestId('board-rotator').hover();
  await expect(rotate).toHaveCSS('opacity', '1');

  // ...and keyboard focus reveals it even with the mouse away (never stranded).
  await page.mouse.move(0, 0);
  await rotate.focus();
  await expect(rotate).toHaveCSS('opacity', '1');
});
