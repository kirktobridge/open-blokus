import { test, expect } from '@playwright/test';

test('interactive tutorial teaches the rules, incl. the Duo opening, and returns home', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-tutorial').click();

  // Step 1 — start from your corner.
  await expect(page.getByTestId('tutorial-progress')).toHaveText('STEP 1 OF 5');
  await expect(page.getByTestId('tutorial-title')).toHaveText('Start from your corner');
  // Wrong spot (not the corner) is rejected — no Next yet.
  await page.getByTestId('hint-center').first().click();
  await expect(page.getByTestId('tutorial-feedback')).toContainText('touch your own corner');
  await expect(page.getByTestId('tutorial-next')).toHaveCount(0);
  // The corner move advances the step.
  await page.getByTestId('hint-corner').first().click();
  await expect(page.getByTestId('tutorial-next')).toBeVisible();
  await page.getByTestId('tutorial-next').click();

  // Step 2 — no own-edge contact: the edge move is rejected, the diagonal accepted.
  await expect(page.getByTestId('tutorial-progress')).toHaveText('STEP 2 OF 5');
  await page.getByTestId('hint-edge').first().click();
  await expect(page.getByTestId('tutorial-feedback')).toContainText('edge-to-edge');
  await expect(page.getByTestId('tutorial-next')).toHaveCount(0);
  await page.getByTestId('hint-diagonal').first().click();
  await page.getByTestId('tutorial-next').click();

  // Step 3 — many corner options: any highlighted corner advances.
  await expect(page.getByTestId('tutorial-progress')).toHaveText('STEP 3 OF 5');
  await page.locator('[data-testid^="hint-corner-"]').first().click();
  await page.getByTestId('tutorial-next').click();

  // Step 4 — expansion lanes: the cramped move is discouraged, the open one wins.
  await expect(page.getByTestId('tutorial-progress')).toHaveText('STEP 4 OF 5');
  await page.getByTestId('hint-cramped').first().click();
  await expect(page.getByTestId('tutorial-feedback')).toContainText('hugs the top edge');
  await expect(page.getByTestId('tutorial-next')).toHaveCount(0);
  await page.getByTestId('hint-open').first().click();
  await page.getByTestId('tutorial-next').click();

  // Step 5 — Duo opens from the middle: the corner is rejected, the interior cell advances.
  await expect(page.getByTestId('tutorial-progress')).toHaveText('STEP 5 OF 5');
  await expect(page.getByTestId('tutorial-title')).toHaveText('Duo opens from the middle');
  await page.getByTestId('hint-corner').first().click();
  await expect(page.getByTestId('tutorial-feedback')).toContainText('interior cell');
  await expect(page.getByTestId('tutorial-next')).toHaveCount(0);
  await page.getByTestId('hint-interior').first().click();
  await expect(page.getByTestId('tutorial-next')).toHaveText(/Finish/);

  // Finishing returns to the home screen — and marks the tutorial done, so its row
  // now carries the completed badge (P35 (d)).
  await page.getByTestId('tutorial-next').click();
  await expect(page.getByTestId('open-tutorial')).toBeVisible();
  await expect(page.getByTestId('open-tutorial-badge')).toHaveText('Done');
});

test('tutorial can be skipped back to home at any time', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-tutorial').click();
  await expect(page.getByTestId('tutorial-title')).toBeVisible();
  await page.getByTestId('tutorial-exit').click();
  await expect(page.getByTestId('open-tutorial')).toBeVisible();
});
