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

  // Two surfaces carry the shading: the interactive hand (where you pick pieces,
  // identified by testid) and the passive per-color cards (micro thumbs, no
  // testid). "Mine" governs the hand + your own card; "Opponents" the other cards.
  const handX5 = page.getByTestId('piece-blue-X5');
  const cardShaded = page.locator('[data-unplayable="true"]:not([data-testid])');

  // Both overlays are opt-in — off by default, so nothing is shaded anywhere.
  await expect(handX5).not.toHaveAttribute('data-unplayable', 'true');
  await expect(cardShaded).toHaveCount(0);

  // "Mine" shades the local seat (blue): X5 in the hand you pick from *and* in
  // blue's card. This is the fix — the unplayable read reaches the hand tray.
  await setAdvisorPref(page, 'pref-unplayable-self', true);
  await expect(handX5).toHaveAttribute('data-unplayable', 'true');
  await expect(cardShaded).toHaveCount(1); // blue's card

  // "Opponents" adds the other three colors' cards (public info) → 4 cards shaded.
  await setAdvisorPref(page, 'pref-unplayable-opponents', true);
  await expect(cardShaded).toHaveCount(4);
  await expect(handX5).toHaveAttribute('data-unplayable', 'true');

  // Dropping "Mine" clears the hand and blue's card — three opponent cards remain.
  await setAdvisorPref(page, 'pref-unplayable-self', false);
  await expect(handX5).not.toHaveAttribute('data-unplayable', 'true');
  await expect(cardShaded).toHaveCount(3);

  // Both off clears the overlay entirely.
  await setAdvisorPref(page, 'pref-unplayable-opponents', false);
  await expect(cardShaded).toHaveCount(0);
});
