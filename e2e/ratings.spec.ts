import { test, expect } from '@playwright/test';

/**
 * Difficulty tiers read as strength (P61). The unit tests hold the tier → pool member
 * mapping; these hold the part only the running app can show — that the numbers reach
 * the picker, and that switching to Duo takes them away again (M6).
 */

const openPicker = async (page: import('@playwright/test').Page) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
};

test('the picker rates each tier, marking the approximate ones (P61)', async ({ page }) => {
  await openPicker(page);
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('1');

  const picker = page.getByTestId('ai-difficulty-3');
  // easy/extreme are the tiers whose config the pool measured exactly — bare numbers.
  await expect(picker.locator('option[value="easy"]')).toHaveText('easy — 1549');
  await expect(picker.locator('option[value="extreme"]')).toHaveText('extreme — 2056');
  // medium/hard are time-budgeted stand-ins, so they must not read as measured.
  await expect(picker.locator('option[value="medium"]')).toHaveText('medium — ≈1683');
  await expect(picker.locator('option[value="hard"]')).toHaveText('hard — ≈1796');

  await expect(page.getByTestId('rating-caption')).toContainText('Classic pool');
});

test('a blocked extreme explains itself instead of advertising a rating', async ({ page }) => {
  await openPicker(page);
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('1');
  const extreme = page.getByTestId('ai-difficulty-3').locator('option[value="extreme"]');

  await expect(extreme).toHaveText('extreme — 2056');
  // Blitz retires extreme (P25). Showing "2056" on a tier you cannot pick would be
  // worse than useless, so the reason takes the slot the rating had.
  await page.getByTestId('blitz-select').selectOption({ label: '5s' });
  await expect(extreme).toHaveText('extreme — needs untimed play');
  await expect(extreme).not.toContainText('2056');
});

test('Duo shows no ratings at all — the scale is Classic-only (M6)', async ({ page }) => {
  await openPicker(page);
  await page.getByTestId('variant-select').selectOption('duo');
  await page.getByTestId('ai-count-select').selectOption('1');

  const picker = page.getByTestId('ai-difficulty-1');
  for (const tier of ['easy', 'medium', 'hard', 'extreme']) {
    // Exact text, not "not visible": the failure this guards is a Classic number
    // leaking onto a Duo board, and the tier name alone is the correct rendering.
    await expect(picker.locator(`option[value="${tier}"]`)).toHaveText(tier);
  }
  await expect(page.getByTestId('rating-caption')).toContainText('unrated');
});

test('switching Classic → Duo → Classic puts the ratings back', async ({ page }) => {
  await openPicker(page);
  // Two seats, one bot: Duo is also a 2-seat game, so the bot seat survives the switch
  // (a 4-seat setup would carry 3 humans across, clamp to Duo's 2, and leave no bot —
  // correct, but it unmounts the picker and there is nothing left to assert about).
  await page.getByTestId('ai-mode-select').selectOption('2');
  await page.getByTestId('ai-count-select').selectOption('1');
  // Seat ids renumber across variants — which is the thing being crossed here — so
  // address the first bot picker positionally rather than by a seat that moves.
  const easy = page.locator('[data-testid^="ai-difficulty-"]').first().locator('option[value="easy"]');

  await expect(easy).toHaveText('easy — 1549');
  await page.getByTestId('variant-select').selectOption('duo');
  await expect(easy).toHaveText('easy');
  await page.getByTestId('variant-select').selectOption('classic');
  await expect(easy).toHaveText('easy — 1549');
});
