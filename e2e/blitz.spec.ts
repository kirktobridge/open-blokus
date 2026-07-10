import { test, expect } from '@playwright/test';

/**
 * Blitz (P20 M1). `?blitz=<seconds>` forces the per-move limit regardless of the
 * saved setup, the same way `?botDelay=` forces bot pacing.
 */

test('blitz clock counts down on the human turn and hides on the bot turn', async ({ page }) => {
  await page.goto('/?botDelay=0&blitz=30');
  await page.getByTestId('quick-play').click();

  // Human (blue) is up first, so the clock is running.
  await expect(page.getByText(/active blue/)).toBeVisible();
  const clock = page.getByTestId('blitz-clock');
  await expect(clock).toBeVisible();

  // It ticks down — proving it's a live clock, not a static "30.0s" label.
  const first = Number((await clock.textContent())!.replace(/[^\d.]/g, ''));
  await expect
    .poll(async () => Number((await clock.textContent())!.replace(/[^\d.]/g, '')), {
      timeout: 5_000,
    })
    .toBeLessThan(first);

  // Hand the turn to the AI seats: no human is on the clock, so it disappears.
  await page.getByTestId('piece-blue-I2').click();
  await page.getByTestId('cell-0-0').click();
  await page.getByTestId('submit-move').click();
  await expect(clock).toBeHidden();

  // ...and it comes back, refilled, when control returns to the human.
  await expect(page.getByText(/active blue/)).toBeVisible({ timeout: 15_000 });
  await expect(clock).toBeVisible();
  await expect
    .poll(async () => Number((await clock.textContent())!.replace(/[^\d.]/g, '')), {
      timeout: 5_000,
    })
    .toBeGreaterThan(first - 5);
});

test('running out of time auto-plays a legal move for the human', async ({ page }) => {
  await page.goto('/?botDelay=0&blitz=1');
  await page.getByTestId('quick-play').click();

  // Blue is up and on a 1 s clock. We touch nothing.
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Expiry plays a random *legal* move — and blue's first move must cover its own
  // opening corner, so a filled (0,0) proves the auto-move went through the rules.
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue', {
    timeout: 10_000,
  });

  // The turn advanced normally: the AI seats reply, and control comes back to blue.
  await expect(page.getByTestId('cell-19-0')).toHaveAttribute('data-value', 'yellow', {
    timeout: 15_000,
  });
  await expect(page.getByText(/active blue/)).toBeVisible({ timeout: 15_000 });
});

test('a timeout clears the half-composed placement it interrupted', async ({ page }) => {
  // A 3 s clock leaves room to assert *between* the first expiry and the next one:
  // let more blue turns elapse and blitz may auto-play I1 itself, which would clear
  // the ghost for the wrong reason and hide a regression.
  await page.goto('/?botDelay=0&blitz=3');
  await page.getByTestId('quick-play').click();
  await expect(page.getByText(/active blue/)).toBeVisible();

  // Illegal-preview cells paint #ef4444. Stage the monomino mid-board — blue's
  // first move must cover its corner, so this is illegal and the ghost shows red.
  const redGhostCells = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="cell-"]')].filter((el) =>
        getComputedStyle(el).background.includes('rgb(239, 68, 68)'),
      ).length,
    );
  const i1Placed = () => page.getByTestId('piece-blue-I1').getAttribute('data-placed');

  await page.getByTestId('piece-blue-I1').click();
  await page.getByTestId('cell-10-10').hover();
  await page.getByTestId('cell-10-10').click();
  expect(await redGhostCells()).toBeGreaterThan(0);

  // Let the clock run out: blue's opening auto-move lands on its corner, which is
  // how we know the turn ended without a submit. Bots are instant, so control is
  // back with blue and the next expiry is ~3 s away.
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue', {
    timeout: 10_000,
  });
  await expect(page.getByText(/active blue/)).toBeVisible({ timeout: 5_000 });

  // I1 still in hand is what makes this discriminating: it proves the ghost went
  // away because the *turn ended*, not because the staged piece got consumed (which
  // the narrower piece-gone check would also have cleared). Blue's opening has 58
  // legal placements and exactly one is I1, so ~1.7% of runs can't tell the two
  // apart — skip those rather than flake or silently assert something weaker.
  test.skip(
    (await i1Placed()) === 'true',
    'blitz happened to auto-play the staged piece; this run cannot discriminate',
  );
  await expect.poll(redGhostCells, { timeout: 1_500 }).toBe(0);
  await expect(page.getByTestId('submit-move')).toBeDisabled();

  // The tray still works: a fresh selection previews again.
  await page.getByTestId('piece-blue-I5').click();
  await page.getByTestId('cell-10-10').hover();
  await expect.poll(redGhostCells, { timeout: 1_500 }).toBeGreaterThan(0);
});

test('the clock turns urgent in its final seconds', async ({ page }) => {
  await page.goto('/?botDelay=0&blitz=5');
  await page.getByTestId('quick-play').click();

  const clock = page.getByTestId('blitz-clock');
  await expect(clock).toHaveAttribute('data-urgent', 'false');
  await expect(clock).toHaveAttribute('data-urgent', 'true', { timeout: 5_000 });
});

test('blitz off (the default) shows no clock and never moves for you', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('quick-play').click();

  await expect(page.getByText(/active blue/)).toBeVisible();
  await expect(page.getByTestId('blitz-clock')).toBeHidden();

  // Untimed: the human's turn survives well past any blitz limit with an empty board.
  await page.waitForTimeout(2_000);
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', '');
  await expect(page.getByText(/active blue/)).toBeVisible();
});
