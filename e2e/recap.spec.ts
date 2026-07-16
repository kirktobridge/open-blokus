import { test, expect } from '@playwright/test';

// Post-game replay scrubber (P2 R0 + P34 M1). An all-AI watch game reaches game-over
// in a couple of seconds with ?botDelay=0, and it's still captured as a record, so
// it's the fast path to exercise the Review UI end-to-end without playing by hand.
test('review a finished game: scrub the board and the score timeline', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();

  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({ timeout: 30_000 });

  // Open the review scrubber; it opens on the final position.
  await page.getByTestId('review-game').click();
  const scrubber = page.getByTestId('replay-scrubber');
  await expect(scrubber).toBeVisible();
  await expect(page.getByTestId('score-timeline')).toBeVisible();
  // Mobility ("room") timeline sits beside the score plot (P34 M1).
  const mobility = page.getByTestId('mobility-timeline');
  await expect(mobility).toBeVisible();

  const ply = page.getByTestId('scrubber-ply');
  const finalReadout = (await ply.textContent())!; // "N / N"
  const total = Number(finalReadout.split('/')[1].trim());
  expect(total).toBeGreaterThan(20); // a real, complete game

  // The mobility chart is seekable too: clicking near its left edge jumps the
  // scrubber back toward the opening (proves onSeek is wired, not just rendered).
  const box = (await mobility.boundingBox())!;
  await mobility.click({ position: { x: box.width * 0.12, y: box.height * 0.5 } });
  const afterSeek = Number((await ply.textContent())!.split('/')[0].trim());
  expect(afterSeek).toBeLessThan(total); // moved off the final ply

  // Jump to the start: empty board, ply 0.
  await page.getByTestId('scrubber-first').click();
  await expect(ply).toHaveText(`0 / ${total}`);
  await expect(page.getByTestId('scrubber-caption')).toHaveText(/Start — empty board/);
  await expect(page.getByTestId('scrubber-first')).toBeDisabled();

  // Step forward one move: ply advances and the caption names the move played.
  await page.getByTestId('scrubber-next').click();
  await expect(ply).toHaveText(`1 / ${total}`);
  await expect(page.getByTestId('scrubber-caption')).toHaveText(/Move 1 — \w+ played/);

  // The slider seeks directly to an arbitrary mid-game ply.
  await page.getByTestId('scrubber-slider').fill('10');
  await expect(ply).toHaveText(`10 / ${total}`);

  // Standings (P2 R0.1) are ranked vertically leader-first and re-rank as you scrub.
  await expect(page.getByTestId('scrubber-standings')).toBeVisible();

  // Speed toggle cycles 1× → 2× → 5× → 1×.
  const speed = page.getByTestId('scrubber-speed');
  await expect(speed).toHaveText('1×');
  await speed.click();
  await expect(speed).toHaveText('2×');
  await speed.click();
  await expect(speed).toHaveText('5×');

  // Auto-play from a few plies before the end runs to the final position and stops.
  await page.getByTestId('scrubber-slider').fill(String(total - 5));
  const play = page.getByTestId('scrubber-play');
  await expect(play).toHaveText(/Play/);
  await play.click();
  await expect(ply).toHaveText(`${total} / ${total}`, { timeout: 10_000 });
  await expect(play).toHaveText(/Play/); // auto-stopped at the end

  // Close returns to the game-over screen (still visible behind the scrubber).
  await page.getByTestId('close-scrubber').click();
  await expect(scrubber).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
});
