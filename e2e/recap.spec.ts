import { test, expect } from '@playwright/test';

// Post-game review-in-table (P2 R0.2, built on R0's timeline + P34 M1 mobility).
// An all-AI watch game reaches game-over in a couple of seconds with ?botDelay=0
// and is still captured as a record, so it's the fast path to drive the review UI
// end-to-end without playing by hand. On dismissing the ceremony ("Review game")
// the table itself becomes the scrubber — no modal.
test('review a finished game in the table: scrub the board + timelines', async ({ page }) => {
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();

  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({ timeout: 30_000 });

  // Dismiss the ceremony into review mode: the table underneath becomes the
  // scrubber (no second, scaled-down board — the play board IS the replay board).
  await page.getByTestId('review-game').click();
  const table = page.getByTestId('review-table');
  await expect(table).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeHidden();
  await expect(page.getByTestId('score-timeline')).toBeVisible();
  await expect(page.getByTestId('mobility-timeline')).toBeVisible();

  // Opens parked on the final position.
  const ply = page.getByTestId('scrubber-ply');
  const finalReadout = (await ply.textContent())!; // "N / N"
  const total = Number(finalReadout.split('/')[1].trim());
  expect(total).toBeGreaterThan(20); // a real, complete game

  // The mobility chart is seekable: clicking near its left edge jumps back toward
  // the opening (proves onSeek is wired, not just rendered).
  const mobility = page.getByTestId('mobility-timeline');
  const box = (await mobility.boundingBox())!;
  await mobility.click({ position: { x: box.width * 0.12, y: box.height * 0.5 } });
  const afterSeek = Number((await ply.textContent())!.split('/')[0].trim());
  expect(afterSeek).toBeLessThan(total);

  // Jump to the start: empty board, ply 0, caption + disabled First.
  await page.getByTestId('scrubber-first').click();
  await expect(ply).toHaveText(`0 / ${total}`);
  await expect(page.getByTestId('scrubber-caption')).toHaveText(/Start — empty board/);
  await expect(page.getByTestId('scrubber-first')).toBeDisabled();

  // Step forward one move: ply advances and the caption names the move played.
  await page.getByTestId('scrubber-next').click();
  await expect(ply).toHaveText(`1 / ${total}`);
  await expect(page.getByTestId('scrubber-caption')).toHaveText(/Move 1 — \w+ played/);

  // The slider seeks directly to an arbitrary mid-game ply; the player cards
  // re-render from that ply (inventory shrinks from the full 21-piece hand).
  await page.getByTestId('scrubber-slider').fill('10');
  await expect(ply).toHaveText(`10 / ${total}`);

  // Speed toggle cycles 1× → 2× → 5×.
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

  // "Back to results" re-shows the ceremony over the table.
  await page.getByTestId('review-results').click();
  await expect(table).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
});
