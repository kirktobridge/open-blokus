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

test('nicknames show on opponent cards and reactions toast across clients', async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  try {
    // A sets a nickname, then creates a 4-player match (seated P0 = blue).
    await a.goto('/');
    await a.getByTestId('nickname-input').fill('Ada');
    await a.getByTestId('mode-select').selectOption('4');
    await a.getByTestId('create-match').click();
    await expect(a.getByTestId('match-id')).toBeVisible();
    const matchID = ((await a.getByTestId('match-id').textContent()) ?? '')
      .replace('Match:', '')
      .trim();

    // B sets a nickname and joins by ID (seated P1 = yellow).
    await b.goto('/');
    await b.getByTestId('nickname-input').fill('Grace');
    await b.getByTestId('join-id-input').fill(matchID);
    await b.getByTestId('join-id-submit').click();
    await expect(b.getByTestId('match-id')).toContainText(matchID);

    // Each sees the other's nickname on the opponent's player card.
    await expect(b.getByText('Ada')).toBeVisible({ timeout: 10_000 });
    await expect(a.getByText('Grace')).toBeVisible({ timeout: 10_000 });

    // A sends a reaction → B sees a toast on A's (blue) card, and A sees its own.
    // Reactions are text-only (P19.1): the toast shows the label, no emoji.
    await a.getByTestId('react-nice').click();
    await expect(b.getByTestId('reaction-blue')).toBeVisible({ timeout: 10_000 });
    await expect(b.getByTestId('reaction-blue')).toHaveText('Nice move');
    await expect(a.getByTestId('reaction-blue')).toBeVisible({ timeout: 10_000 });

    // The bubble is transient — it clears itself after the TTL.
    await expect(b.getByTestId('reaction-blue')).toBeHidden({ timeout: 10_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test('an invite link deep-joins the second player into the match', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  try {
    // A creates a match and is seated as P0.
    await a.goto('/');
    await a.getByTestId('mode-select').selectOption('4');
    await a.getByTestId('create-match').click();
    await expect(a.getByTestId('match-id')).toBeVisible();
    const matchID = ((await a.getByTestId('match-id').textContent()) ?? '')
      .replace('Match:', '')
      .trim();
    expect(matchID.length).toBeGreaterThan(0);

    // B opens the invite deep-link → auto-joins the same match (no manual entry).
    await b.goto(`/?join=${matchID}`);
    await expect(b.getByTestId('match-id')).toContainText(matchID);
    // The join param is stripped from the URL after handling.
    expect(new URL(b.url()).searchParams.get('join')).toBeNull();

    // The two are in the same game: A's opening move shows up for B.
    await expect(a.getByText(/active blue/)).toBeVisible();
    await a.getByTestId('piece-blue-I2').click();
    await a.getByTestId('cell-0-0').click();
    await a.getByTestId('submit-move').click();
    await expect(b.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue', {
      timeout: 10_000,
    });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
