import { test, expect } from '@playwright/test';
import { generateDailyPuzzle } from '../src/game/puzzle/daily';
import { generateLegalMoves } from '../src/game/moves';

// Pin the day so the seeded position — and the legal move we compute for it — is
// stable regardless of the wall clock.
const DAY = '2026-01-15';

test('daily puzzle: place a piece, score updates, finish shows a result', async ({ page }) => {
  const puzzle = generateDailyPuzzle(DAY);
  const move = generateLegalMoves(puzzle.state, puzzle.playerColor)[0];
  expect(move).toBeTruthy();

  await page.goto(`/?puzzle=${DAY}`);
  await page.getByTestId('open-puzzle').click();

  // Puzzle loads on the pinned day with a zeroed score.
  await expect(page.getByTestId('puzzle-status')).toBeVisible();
  await expect(page.getByTestId('puzzle-cells')).toHaveText('0');
  await expect(page.getByTestId('puzzle-pieces')).toHaveText('0');

  // Select the piece and match the target orientation via the tool buttons.
  await page.getByTestId(`piece-${puzzle.playerColor}-${move.pieceId}`).click();
  for (let i = 0; i < move.rotation; i++) await page.getByTestId('rotate').click();
  if (move.reflected) await page.getByTestId('flip').click();

  // Stage on the move's origin cell, then commit.
  await page.getByTestId(`cell-${move.x}-${move.y}`).click();
  await page.getByTestId('submit-move').click();

  // The placed piece paints the board in the player's color and the score rises.
  await expect(page.getByTestId(`cell-${move.x}-${move.y}`)).toHaveAttribute(
    'data-value',
    puzzle.playerColor,
  );
  await expect(page.getByTestId('puzzle-pieces')).toHaveText('1');
  await expect(page.getByTestId('puzzle-cells')).not.toHaveText('0');

  // Finish early → result dialog with a Copy result action, then back to lobby.
  await page.getByTestId('finish-puzzle').click();
  await expect(page.getByTestId('puzzle-result')).toBeVisible();
  await expect(page.getByTestId('copy-result')).toBeVisible();
  await page.getByTestId('leave-puzzle-result').click();
  await expect(page.getByTestId('open-puzzle')).toBeVisible();
});
