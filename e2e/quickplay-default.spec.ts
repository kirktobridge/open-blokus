import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** An odd one-off: 2 players, one hard bot, on a 10s clock. */
async function composeOddSetup(page: Page) {
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('2');
  await page.getByTestId('ai-count-select').selectOption('1');
  await page.getByTestId('blitz-select').selectOption('10');
  await page.getByTestId('ai-difficulty-1').selectOption('hard');
}

test('playing a one-off setup does not become the Quick Play default (P46)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await expect(page.getByTestId('quick-play')).toContainText('You vs 3 bots · all easy · untimed');

  await composeOddSetup(page);
  await page.getByTestId('start-ai').click();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Back home — the one-click path is exactly where it was. This is the whole
  // feature: an experiment you play once must not silently replace it.
  await page.goto('/?botDelay=0');
  await expect(page.getByTestId('quick-play')).toContainText('You vs 3 bots · all easy · untimed');
});

test('pinning sets the Quick Play default, and it survives a reload (P46)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await composeOddSetup(page);

  // The screen says what Quick Play would start, and the control offers to change it.
  const pin = page.getByTestId('pin-default');
  await expect(page.getByTestId('quick-play-default')).toContainText('You vs 3 bots');
  await expect(pin).toBeEnabled();

  await pin.click();

  // Pinning has nowhere to navigate to, so it reports itself: the control settles
  // into the pinned state and the line names the new default.
  await expect(pin).toBeDisabled();
  await expect(pin).toContainText('Pinned as your Quick Play default');
  // The "Quick Play starts:" line only earns its space while the default differs
  // from the setup on screen; once they agree it would just repeat the card summary.
  await expect(page.getByTestId('quick-play-default')).toHaveCount(0);
  await expect(page.getByTestId('custom-summary')).toContainText(
    'You vs 1 bot · all hard · blitz 10s',
  );

  await page.goto('/?botDelay=0');
  await expect(page.getByTestId('quick-play')).toContainText('You vs 1 bot · all hard · blitz 10s');

  // And it really is what launches — one click gives the 2p game, not the built-in 4p.
  await page.getByTestId('quick-play').click();
  await expect(page.getByText(/active blue/)).toBeVisible();
  await expect(page.getByTestId('cell-19-19')).toHaveAttribute('data-value', '');
});

test('editing away from the pinned setup re-offers the pin (P46)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();

  // Untouched, the form already *is* the default, so there is nothing to pin.
  await expect(page.getByTestId('pin-default')).toBeDisabled();

  await page.getByTestId('blitz-select').selectOption('30');
  await expect(page.getByTestId('pin-default')).toBeEnabled();

  // Coming back to the same game re-settles it — the check is what would start,
  // not how you got there.
  await page.getByTestId('blitz-select').selectOption('0');
  await expect(page.getByTestId('pin-default')).toBeDisabled();
});

test('a pinned setup is still normalized — no invalid default can start (P46)', async ({
  page,
}) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-count-select').selectOption('1');
  await page.getByTestId('ai-difficulty-3').selectOption('extreme');
  await page.getByTestId('pin-default').click();

  // Extreme can't race a clock (P25), so adding one retires it — and what gets
  // pinned is the resolved setup, not the impossible one.
  await page.getByTestId('blitz-select').selectOption('10');
  await page.getByTestId('pin-default').click();
  await page.goto('/?botDelay=0');
  await expect(page.getByTestId('quick-play')).toContainText('hard');
  await expect(page.getByTestId('quick-play')).not.toContainText('extreme');
});

test('changed rows are marked against your pinned default (P65 M4)', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();

  // Fresh: the form *is* the default, so nothing is marked. The mark has to mean
  // "you changed this", which it cannot if it is on before you touch anything.
  await expect(page.getByTestId('changed-blitz')).toHaveCount(0);
  await expect(page.getByTestId('changed-aiCount')).toHaveCount(0);

  // Bump one bot — the returning player's whole task. Only that row marks.
  await page.getByTestId('ai-difficulty-1').selectOption('hard');
  await expect(page.getByTestId('changed-blitz')).toHaveCount(0);
  await expect(page.getByTestId('changed-aiCount')).toHaveCount(0);

  // A second, different kind of edit marks its own control too.
  await page.getByTestId('blitz-select').selectOption('10');
  await expect(page.getByTestId('changed-blitz')).toBeVisible();

  // Pinning makes the current setup the default, so every mark clears — the marks
  // and the pin button are two readings of the same comparison and cannot disagree.
  await page.getByTestId('pin-default').click();
  await expect(page.getByTestId('pin-default')).toBeDisabled();
  await expect(page.getByTestId('changed-blitz')).toHaveCount(0);
  await expect(page.getByTestId('changed-aiCount')).toHaveCount(0);
});

