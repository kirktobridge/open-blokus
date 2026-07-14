import { test, expect } from '@playwright/test';

test('game-over reveal: glow mosaic, racing score bars, winner tag, shareable result', async ({
  page,
}) => {
  // All-AI watch game runs to completion in seconds with instant bots.
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();

  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({
    timeout: 30_000,
  });

  // The reveal replaces the old static table: a framed mosaic of the finished
  // board, racing per-color score bars, a WINNER tag, and a shareable result.
  await expect(page.getByTestId('reveal-mosaic')).toBeVisible();
  await expect(page.getByTestId('reveal-bars')).toBeVisible();
  await expect(page.getByText('WINNER').first()).toBeVisible();
  await expect(page.getByTestId('copy-result')).toBeVisible();

  // Play again is still reachable from the reveal.
  await expect(page.getByTestId('play-again')).toBeVisible();
});

test('copy result copies a text summary plus the emoji board (P26)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4');
  await page.getByTestId('start-ai').click();

  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId('copy-result').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('OpenBlokus');

  // Caption lines, blank line, then a 20×20 grid of square glyphs. A finished
  // 4-color game must have painted at least one square of every color.
  const grid = clip.split('\n\n')[1].split('\n');
  expect(grid).toHaveLength(20);
  for (const row of grid) expect([...row]).toHaveLength(20);
  for (const glyph of ['🟦', '🟨', '🟥', '🟩']) expect(clip).toContain(glyph);
});
