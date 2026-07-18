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

// Dead-piece shading (P39): a still-held piece with no legal placement is washed
// red in the inventory. At the opening every color has exactly one dead piece —
// the X pentomino, which has no corner cell and so can never cover a start corner.
// That makes move-zero a clean, deterministic fixture: one dead thumb per color.
test('Dead-piece shading marks the unplayable X pentomino, split by Self/Opponents', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  const dead = page.locator('[data-dead="true"]');

  // Both overlays are opt-in — off by default, so nothing is shaded.
  await expect(dead).toHaveCount(0);

  // "Mine" shades only the local seat's inventory (blue owns X5 → 1 dead thumb).
  await setAdvisorPref(page, 'pref-dead-self', true);
  await expect(dead).toHaveCount(1);

  // "Opponents" adds the other three colors' X5 (public info) → 4 total.
  await setAdvisorPref(page, 'pref-dead-opponents', true);
  await expect(dead).toHaveCount(4);

  // Dropping "Mine" leaves just the three opponents shaded.
  await setAdvisorPref(page, 'pref-dead-self', false);
  await expect(dead).toHaveCount(3);

  // Both off clears the overlay entirely.
  await setAdvisorPref(page, 'pref-dead-opponents', false);
  await expect(dead).toHaveCount(0);
});
