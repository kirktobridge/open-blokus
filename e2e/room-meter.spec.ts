import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Toggle an Advisor Features switch in Settings → Gameplay (P38), then close the panel. */
async function setAdvisorPref(page: Page, testid: string, on: boolean) {
  await page.getByTestId('settings-toggle').click();
  await page.getByRole('button', { name: 'Gameplay' }).click();
  const box = page.getByTestId(testid);
  if (on) await box.check();
  else await box.uncheck();
  await page.getByTestId('settings-toggle').click(); // close
}

test('Corner Counter is opt-in and shows a per-color open-corner read', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Off by default — no meter.
  await expect(page.getByTestId('room-meter')).toHaveCount(0);

  // Turn it on in Settings → the meter appears with one row per color, each on its
  // opening corner (count 1).
  await setAdvisorPref(page, 'pref-corner-counter', true);
  await expect(page.getByTestId('room-meter')).toBeVisible();
  for (const color of ['blue', 'yellow', 'red', 'green']) {
    await expect(page.getByTestId(`room-count-${color}`)).toHaveText('1');
  }

  // It's an opt-in overlay, independent of Move Options: toggling off hides it,
  // back on restores it.
  await setAdvisorPref(page, 'pref-corner-counter', false);
  await expect(page.getByTestId('room-meter')).toHaveCount(0);
  await setAdvisorPref(page, 'pref-corner-counter', true);
  await expect(page.getByTestId('room-meter')).toBeVisible();

  // Placing a piece grows the mover's room past the others' lone corner.
  await page.getByTestId('piece-blue-V3').click();
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('submit-move').click();
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
  await expect(page.getByTestId('room-count-blue')).not.toHaveText('1');
});
