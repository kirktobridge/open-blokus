import { test, expect } from '@playwright/test';

/**
 * Difficulty tiers read as strength (P61). The unit tests hold the tier → pool member
 * mapping; these hold the part only the running app can show — that the numbers reach
 * the picker, and that switching to Duo takes them away again (M6).
 *
 * P65 M2 moved the rating out of `<option>` text into the row beside the select, so
 * these read `tier-note-<seat>` rather than option text. The claims are unchanged:
 * which tiers are rated, which are approximate, and that no Classic number reaches a
 * Duo board.
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
  const note = page.getByTestId('tier-note-3');

  // The rating is now on screen without opening the menu (M2) — that is the point of
  // the milestone, so assert it against the resting row, not the option list.
  // easy/extreme are the tiers whose config the pool measured exactly — bare numbers.
  await picker.selectOption('easy');
  await expect(note).toHaveText('1549 Elo');
  await picker.selectOption('extreme');
  await expect(note).toHaveText('2056 Elo');
  // medium/hard are time-budgeted stand-ins, so they must not read as measured.
  await picker.selectOption('medium');
  await expect(note).toHaveText('≈1683 Elo');
  await picker.selectOption('hard');
  await expect(note).toHaveText('≈1796 Elo');

  await expect(page.getByTestId('rating-caption')).toContainText('Classic pool');
});

test('a blocked extreme explains itself instead of advertising a rating', async ({ page }) => {
  await openPicker(page);
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('1');
  const picker = page.getByTestId('ai-difficulty-3');
  const extreme = picker.locator('option[value="extreme"]');

  await picker.selectOption('extreme');
  await expect(page.getByTestId('tier-note-3')).toHaveText('2056 Elo');
  // Blitz retires extreme (P25). The option still explains itself in place, and the
  // seat falls back off extreme — so no "2056" is left advertising a tier you cannot
  // pick, wherever it renders.
  await page.getByTestId('blitz-select').selectOption({ label: '5s' });
  await expect(extreme).toHaveText('extreme — needs untimed play');
  // `toBeDisabled` doesn't apply to <option>; the attribute is the real claim.
  await expect(extreme).toHaveAttribute('disabled', '');
  await expect(page.getByTestId('custom-game')).not.toContainText('2056');
});

test('Duo shows no ratings at all — the scale is Classic-only (M6)', async ({ page }) => {
  await openPicker(page);
  await page.getByTestId('variant-card-duo').click();
  await page.getByTestId('ai-count-select').selectOption('1');

  const picker = page.getByTestId('ai-difficulty-1');
  for (const tier of ['easy', 'medium', 'hard', 'extreme']) {
    // Exact text, not "not visible": the failure this guards is a Classic number
    // leaking onto a Duo board, and the tier name alone is the correct rendering.
    await expect(picker.locator(`option[value="${tier}"]`)).toHaveText(tier);
    // Same claim at the row, where M2 put the number: no Elo clause on Duo at all.
    await picker.selectOption(tier);
    await expect(page.getByTestId('tier-note-1')).not.toContainText('Elo');
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
  const note = page.locator('[data-testid^="tier-note-"]').first();

  await expect(note).toHaveText('1549 Elo');
  await page.getByTestId('variant-card-duo').click();
  await expect(note).not.toContainText('Elo');
  await page.getByTestId('variant-card-classic').click();
  await expect(note).toHaveText('1549 Elo');
});
