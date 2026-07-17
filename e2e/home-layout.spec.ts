import { test, expect } from '@playwright/test';

// P29 M1 — the front door: one large board carrying the page, one uniform vertical
// menu beside it holding every destination. Asserts the geometry (not pixels) and
// that each menu row lands where it says it does — Custom Game takes the view,
// friends and stats overlay it.
// P35 hierarchy pass: Your Stats left the column for the top-bar profile chip, so the
// menu is five rows; the stats glance now opens from the profile affordance.

async function box(page: import('@playwright/test').Page, testId: string) {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`no bounding box for ${testId}`);
  return b;
}

const ROWS = ['quick-play', 'open-custom', 'open-puzzle', 'open-tutorial', 'open-friends'];

test('wide viewport: board left, action menu right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const board = await box(page, 'home-hero');
  const menu = await box(page, 'action-menu');

  // Two columns: the menu starts to the right of the board, both aligned at the top.
  expect(menu.x).toBeGreaterThan(board.x + board.width - 4);
  expect(Math.abs(menu.y - board.y)).toBeLessThan(4);

  // The board carries the page — it's the largest object on it.
  expect(board.width).toBeGreaterThan(400);

  // Every destination is one click away, in one place, top-to-bottom in menu order.
  let lastY = -1;
  for (const row of ROWS) {
    const b = await box(page, row);
    expect(b.x).toBeGreaterThan(menu.x - 1);
    expect(b.y).toBeGreaterThan(lastY);
    lastY = b.y;
  }
});

test('narrow viewport: board stacked above the menu', async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 1100 });
  await page.goto('/');

  const board = await box(page, 'home-hero');
  const menu = await box(page, 'action-menu');

  expect(menu.y).toBeGreaterThan(board.y + board.height - 4);

  // Still one menu holding every destination — narrow drops nothing.
  for (const row of ROWS) await expect(page.getByTestId(row)).toBeVisible();
});

test('Quick Play says what it will start', async ({ page }) => {
  await page.goto('/');
  // Default saved setup: you against three easy bots, no clock.
  const row = page.getByTestId('quick-play');
  await expect(row).toContainText('You vs 3 bots');
  await expect(row).toContainText('all easy');
  await expect(row).toContainText('untimed');
});

test('Custom Game takes the view; Back returns to the front door', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-custom').click();

  // A screen, not an overlay — the menu is gone, not merely covered.
  await expect(page.getByTestId('custom-game')).toBeVisible();
  await expect(page.getByTestId('action-menu')).toHaveCount(0);

  await page.getByTestId('custom-back').click();
  await expect(page.getByTestId('action-menu')).toBeVisible();
});

test('friends and stats are glances that overlay the front door', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('open-friends').click();
  const friends = page.getByTestId('friends-modal');
  await expect(friends).toBeVisible();
  await expect(friends.getByTestId('create-match')).toBeVisible();
  // The door is still behind it — a glance, not a departure.
  await expect(page.getByTestId('action-menu')).toBeVisible();
  await page.getByTestId('friends-modal-close').click();
  await expect(friends).toHaveCount(0);

  // Stats opens from the top-bar profile chip (P35 (b)), not a menu row.
  await page.getByTestId('profile-chip').click();
  await expect(page.getByTestId('stats-modal')).toBeVisible();
  await expect(page.getByTestId('progression-panel')).toBeVisible();

  // Escape closes a glance.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stats-modal')).toHaveCount(0);
});

test('primary row wears the brass accent; the rest stay neutral (P35 (a))', async ({ page }) => {
  await page.goto('/');

  // The accent must actually *render*, not merely be classed — the first cut lived
  // in CSS and was silently overridden by PANEL's inline border/shadow (P35 fix). The
  // primary's accent is --brass, which is per-theme, so read it live rather than
  // hardcoding a hex; its rgb triplet must also appear in the box-shadow (left bar).
  const borderColor = (id: string) =>
    page.getByTestId(id).evaluate((el) => getComputedStyle(el).borderTopColor);
  const boxShadow = (id: string) =>
    page.getByTestId(id).evaluate((el) => getComputedStyle(el).boxShadow);
  const brass = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--brass)';
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c; // rgb(...)
  });
  const brassTriplet = brass
    .replace(/rgba?\(|\)/g, '')
    .split(',')
    .map((s) => s.trim())
    .slice(0, 3)
    .join(', ');

  await expect(page.getByTestId('quick-play')).toHaveClass(/ob-menu-row--primary/);
  expect(await borderColor('quick-play')).toBe(brass);
  expect(await boxShadow('quick-play')).toContain(brassTriplet);

  // Neutral rows keep the panel border (not brass) — but still carry the molded
  // finish, so their box-shadow is non-empty.
  for (const row of ['open-custom', 'open-puzzle', 'open-tutorial', 'open-friends']) {
    await expect(page.getByTestId(row)).not.toHaveClass(/ob-menu-row--primary/);
    expect(await borderColor(row)).not.toBe(brass);
    expect(await boxShadow(row)).not.toBe('none');
  }
});

test('every row leads with a square icon slot (P35)', async ({ page }) => {
  await page.goto('/');
  for (const row of ['quick-play', 'open-custom', 'open-puzzle', 'open-tutorial', 'open-friends']) {
    const icon = page.getByTestId(`${row}-icon`);
    await expect(icon).toBeVisible();
    const { w, h } = await icon.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(w).toBe(h); // square
    expect(h).toBeLessThanOrEqual(44); // no taller than the label+hint block
  }
});

test('completed tutorial de-emphasizes with a Done badge (P35 (d))', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('obk:tutorial-done', '1'));
  await page.goto('/');

  const row = page.getByTestId('open-tutorial');
  await expect(page.getByTestId('open-tutorial-badge')).toHaveText('Done');
  // Dimmed but still a live destination.
  await expect(row).toHaveCSS('opacity', '0.62');
  await expect(row).toBeEnabled();
});

test('daily puzzle carries the live streak count (P35 (d))', async ({ page }) => {
  // Seed a streak whose last completion is today, so it reads as still alive.
  await page.addInitScript(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    localStorage.setItem('obk:puzzle-streak', JSON.stringify({ last: key, count: 4 }));
  });
  await page.goto('/');

  await expect(page.getByTestId('open-puzzle-streak')).toContainText('4');
});

// P29 M2 — the board plays itself by replaying precomputed games.

test('the board plays itself, opening on a developed position', async ({ page }) => {
  await page.goto('/');
  const board = page.getByTestId('ambient-board');

  // It arrives already dealt in — a front door that opened empty would sell nothing.
  const opening = Number(await board.getAttribute('data-moves'));
  expect(opening).toBeGreaterThan(10);

  // …and then it keeps playing, one move at a time.
  await expect
    .poll(async () => Number(await board.getAttribute('data-moves')), { timeout: 8_000 })
    .toBeGreaterThan(opening);

  // Decorative only: it never takes a click away from the menu behind it.
  await expect(board).toHaveAttribute('aria-hidden', 'true');
});

test('reduced motion: the board snaps to a finished game instead of looping', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const board = page.getByTestId('ambient-board');

  // A whole game's worth of moves, on screen at once, going nowhere.
  const shown = Number(await board.getAttribute('data-moves'));
  expect(shown).toBeGreaterThan(40);
  await page.waitForTimeout(3_000);
  expect(Number(await board.getAttribute('data-moves'))).toBe(shown);
});

test('Daily Puzzle carries a New today badge until you open it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('open-puzzle-badge')).toHaveText('New today');

  // Opening today's puzzle spends the badge — it's gone when you come back.
  await page.getByTestId('open-puzzle').click();
  await expect(page.getByTestId('puzzle-score')).toBeVisible();
  await page.getByTestId('leave-puzzle').click();

  await expect(page.getByTestId('open-puzzle')).toBeVisible();
  await expect(page.getByTestId('open-puzzle-badge')).toHaveCount(0);
});
