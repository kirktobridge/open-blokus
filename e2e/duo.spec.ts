import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Start a Duo game against one easy bot from the Custom Game screen. */
async function startDuo(page: Page) {
  await page.getByTestId('open-custom').click();
  await page.getByTestId('variant-select').selectOption('duo');
  await page.getByTestId('ai-count-select').selectOption('1');
  await page.getByTestId('start-ai').click();
}

test('Duo deals a 14×14 board with black and white only (P20 M2b)', async ({ page }) => {
  await page.goto('/?botDelay=0');

  // Duo is a fixed two-seat game, so choosing it pins the player count.
  await page.getByTestId('open-custom').click();
  await page.getByTestId('variant-select').selectOption('duo');
  await expect(page.getByTestId('ai-mode-select')).toHaveValue('2');
  await expect(page.getByTestId('ai-mode-select')).toBeDisabled();
  await expect(page.getByTestId('custom-summary')).toContainText('Duo');

  await page.getByTestId('ai-count-select').selectOption('1');
  await page.getByTestId('start-ai').click();

  // The board is 14 wide, not 20: (13,13) exists and (14,0) does not.
  await expect(page.getByTestId('cell-13-13')).toBeVisible();
  await expect(page.getByTestId('cell-14-0')).toHaveCount(0);
  await expect(page.getByTestId('cell-19-19')).toHaveCount(0);

  // Black moves first and the Classic colors are not seated at all.
  await expect(page.getByText(/active black/)).toBeVisible();
  await expect(page.getByText(/active blue/)).toHaveCount(0);
});

test('Duo opens on its interior start cell, not a corner (P20 M2b)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await startDuo(page);

  // Black's opening piece must cover (4,4) — the interior starting point. A board
  // corner is not a start cell in Duo, which is the variant's defining rule.
  await expect(page.getByTestId('cell-4-4')).toHaveAttribute('data-starthint', 'true');
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-starthint', 'false');

  // Staging I1 on a board corner leaves Submit disabled and the cell empty.
  await page.getByTestId('piece-black-I1').click();
  await page.getByTestId('cell-0-0').click();
  await expect(page.getByTestId('submit-move')).toBeDisabled();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', '');

  // On the start cell it commits. (The first click off a staged cell picks the
  // piece back up — sticky carry, P23 M1 — so staging elsewhere takes two.)
  await page.getByTestId('cell-4-4').click();
  await page.getByTestId('cell-4-4').click();
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-4-4')).toHaveAttribute('data-value', 'black');
});

/** Toggle an Advisor Features switch in Settings → Gameplay (P38), then close. */
async function setAdvisorPref(page: Page, testid: string, on: boolean) {
  await page.getByTestId('settings-toggle').click();
  await page.getByRole('button', { name: 'Gameplay' }).click();
  const box = page.getByTestId(testid);
  if (on) await box.check();
  else await box.uncheck();
  await page.getByTestId('settings-toggle').click();
}

test('Duo keyboard cursor stays on the 14×14 board (P20 M2b)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await startDuo(page);

  // Arrow keys move in *screen* space, and black's view is turned 180°, so ← / ↑
  // walk toward board (13,13). Held against that corner the cursor clamps to the
  // variant's bounds — (13,13), illegal for an opening, so Submit stays disabled.
  await page.getByTestId('piece-black-I1').click();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
  }
  await page.keyboard.press('Space'); // stage where the cursor sits
  await expect(page.getByTestId('submit-move')).toBeDisabled();

  // Exactly 9 steps back lands on black's start cell and the move becomes legal.
  // Under a Classic clamp the cursor would have run to (19,19) and this would
  // land on (10,10) instead — off the board's playable opening entirely.
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Space');
  await expect(page.getByTestId('submit-move')).toBeEnabled();
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-4-4')).toHaveAttribute('data-value', 'black');
});

test('Duo advisor hints key off 14-wide indices (P20 M2b)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await startDuo(page);
  await setAdvisorPref(page, 'pref-move-options', true);

  // Only the start cell fits an opening I1.
  await page.getByTestId('piece-black-I1').click();
  await expect(page.getByTestId('hint-legal')).toHaveCount(1);

  // (0,3) is 14-index 42 but 20-index 60 — the index a Classic stride would have
  // mistaken for (4,4). Hovering it must not erase the real hint.
  await page.getByTestId('cell-0-3').hover();
  await expect(page.getByTestId('hint-legal')).toHaveCount(1);

  // Hovering the start cell itself is what covers it (the piece sits on the hint).
  await page.getByTestId('cell-4-4').hover();
  await expect(page.getByTestId('hint-legal')).toHaveCount(0);
});
