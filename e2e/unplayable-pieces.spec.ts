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

// Unplayable-piece shading (P39): a still-held piece with no legal placement this
// turn is washed red in the inventory. At the opening every color has exactly one
// unplayable piece — the X pentomino, which has no corner cell and so can never
// cover a start corner. That makes move-zero a clean, deterministic fixture: one
// shaded thumb per color. (It's "unplayable now," not permanent — a later move
// opens corners for it.)
test('Unplayable-piece shading marks the X pentomino, split by Self/Opponents', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  const shaded = page.locator('[data-unplayable="true"]');

  // Both overlays are opt-in — off by default, so nothing is shaded.
  await expect(shaded).toHaveCount(0);

  // "Mine" shades only the local seat's inventory (blue owns X5 → 1 shaded thumb).
  await setAdvisorPref(page, 'pref-unplayable-self', true);
  await expect(shaded).toHaveCount(1);

  // "Opponents" adds the other three colors' X5 (public info) → 4 total.
  await setAdvisorPref(page, 'pref-unplayable-opponents', true);
  await expect(shaded).toHaveCount(4);

  // Dropping "Mine" leaves just the three opponents shaded.
  await setAdvisorPref(page, 'pref-unplayable-self', false);
  await expect(shaded).toHaveCount(3);

  // Both off clears the overlay entirely.
  await setAdvisorPref(page, 'pref-unplayable-opponents', false);
  await expect(shaded).toHaveCount(0);
});
