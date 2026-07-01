import { test, expect } from '@playwright/test';

test('two players in separate browsers see each other’s moves', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  try {
    // Player A creates a 4-player match and is seated as P0.
    await a.goto('/');
    await a.getByTestId('mode-select').selectOption('4');
    await a.getByTestId('create-match').click();
    await expect(a.getByTestId('match-id')).toBeVisible();
    const label = (await a.getByTestId('match-id').textContent()) ?? '';
    const matchID = label.replace('Match:', '').trim();
    expect(matchID.length).toBeGreaterThan(0);

    // Player B joins the same match by ID → seated as P1.
    await b.goto('/');
    await b.getByTestId('join-id-input').fill(matchID);
    await b.getByTestId('join-id-submit').click();
    await expect(b.getByTestId('match-id')).toContainText(matchID);

    // A is blue and moves first; B sees the blue piece appear.
    await expect(a.getByText(/active blue/)).toBeVisible();
    await a.getByTestId('piece-blue-I2').click();
    await a.getByTestId('cell-0-0').click(); // stage
    await a.getByTestId('submit-move').click(); // commit
    await expect(b.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue', {
      timeout: 10_000,
    });

    // Now yellow (P1 = B) is active; B places on yellow's corner (19,0).
    await expect(b.getByText(/active yellow/)).toBeVisible();
    await b.getByTestId('piece-yellow-I2').click();
    await b.getByTestId('cell-18-0').click(); // stage — covers (18,0) and (19,0)
    await b.getByTestId('submit-move').click(); // commit
    await expect(a.getByTestId('cell-19-0')).toHaveAttribute('data-value', 'yellow', {
      timeout: 10_000,
    });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
