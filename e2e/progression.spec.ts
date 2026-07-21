import { test, expect } from '@playwright/test';

const SEED = {
  gamesPlayed: 7,
  wins: 3,
  currentStreak: 2,
  bestStreak: 4,
  bestScores: { basic: 32, advanced: null },
  perTier: {
    easy: { played: 3, won: 3 },
    medium: { played: 2, won: 0 },
    hard: { played: 1, won: 0 },
    extreme: { played: 1, won: 0 },
  },
  firstWinTiers: ['easy'],
  perfectClears: 1,
};

test('progression panel renders lifetime stats from storage (P15)', async ({ page }) => {
  // Seed before any app script runs — the store reads localStorage at import time.
  await page.addInitScript((seed) => {
    localStorage.setItem('openblokus-progression', JSON.stringify(seed));
  }, SEED);
  await page.goto('/');
  await page.getByTestId('profile-chip').click();

  const panel = page.getByTestId('progression-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('stat-games')).toHaveText('7');
  await expect(page.getByTestId('stat-winrate')).toHaveText('43%'); // 3/7
  // P51: the tile carries its unit — basic scores squares still in your tray.
  await expect(page.getByTestId('stat-best-score')).toHaveText('32 left');
  await expect(page.getByTestId('stat-streak')).toHaveText('2');
  await expect(page.getByTestId('stat-best-streak')).toHaveText('4');

  // Per-tier breakdown + the "beaten" badge on tiers you've first-won.
  await expect(page.getByTestId('tier-stat-easy')).toContainText('3/3');
  await expect(page.getByTestId('tier-stat-easy')).toContainText('100%');
  await expect(page.getByTestId('tier-stat-easy')).toContainText('BEATEN');
  await expect(page.getByTestId('tier-stat-medium')).toContainText('0/2');
  await expect(page.getByTestId('tier-stat-medium')).not.toContainText('BEATEN');
  await expect(page.getByTestId('stat-perfect-clears')).toContainText('1');
});

test('a pre-P51 stored best score is dropped, not shown (P51)', async ({ page }) => {
  // The old blob's single `bestScore` was a max-fold across variants — under
  // basic that's your worst game, and it can't be repaired, so the tile goes
  // blank until the next game while the honest counters stay put.
  await page.addInitScript((seed) => {
    localStorage.setItem('openblokus-progression', JSON.stringify(seed));
  }, { ...SEED, bestScores: undefined, bestScore: 43 });
  await page.goto('/');
  await page.getByTestId('profile-chip').click();

  await expect(page.getByTestId('stat-best-score')).toHaveText('—');
  await expect(page.getByTestId('stat-games')).toHaveText('7');
});

test('progression panel shows an empty state before any game (P15)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('profile-chip').click();
  await expect(page.getByTestId('progression-panel')).toBeVisible();
  await expect(page.getByTestId('progression-empty')).toBeVisible();
  await expect(page.getByTestId('stat-games')).toHaveCount(0);
});
