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

// Incursion advisor (P44): the overlay marks the active color's open corners an
// opponent could seize next turn. That's a mid/late-game collision — at the opening
// every color sits in its own far corner, so *no* corner is yet reachable by anyone
// else. So the deterministic e2e fixture is the toggle wiring + the correct absence
// of any warning at move zero; the predicate's positive geometry is covered
// exhaustively by tests/incursions.test.ts, and the live orange overlay under a real
// threat is confirmed by /verify.
test('Incursion Warnings toggle is opt-in and shows nothing at the opening', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();

  const warnings = page.getByTestId('hint-incursion');

  // Opt-in: off by default → no incursion markers on the board.
  await expect(warnings).toHaveCount(0);

  // Turning it on at the opening still shows nothing — no opponent can yet reach any
  // of blue's corners (they're all in their own corners), which is the correct read.
  // (setAdvisorPref's .check() would fail if the switch weren't wired.)
  await setAdvisorPref(page, 'pref-incursion-advisor', true);
  await expect(warnings).toHaveCount(0);

  // And the switch round-trips off again.
  await setAdvisorPref(page, 'pref-incursion-advisor', false);
});
