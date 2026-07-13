import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The appearance store (themes + design tokens + piece colors) is a module-level
 * singleton that reads localStorage at import, so each case seeds storage then
 * re-imports it fresh. The vitest env is node — no `document` — which is fine:
 * applyAppearance() no-ops there, and the DOM side (inline vars on <html>) is
 * covered by e2e/palette.spec.ts. What's pinned here is the model: fork-on-edit,
 * built-ins staying pristine, and the one-time migration off the four old keys.
 */
function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    has: (k: string) => map.has(k),
  };
}

let storage: ReturnType<typeof fakeStorage>;

async function loadStore(seed: Record<string, string> = {}) {
  storage = fakeStorage(seed);
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  return import('../src/client/appearance');
}

/** What was written to the one appearance key. */
const persisted = () => JSON.parse(storage.getItem('openblokus-appearance') ?? 'null');

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('appearance store', () => {
  it('starts on a pristine built-in (light, absent an OS preference)', async () => {
    const a = await loadStore();
    expect(a.getAppearance()).toEqual({ userThemes: [], activeId: 'light' });
  });

  it('forks the active built-in on the first token edit, leaving it pristine', async () => {
    const a = await loadStore({ 'openblokus-appearance': '{"userThemes":[],"activeId":"dark"}' });
    a.setTokenOverride('--pnl', '#123456');

    const { userThemes, activeId } = a.getAppearance();
    expect(userThemes).toHaveLength(1);
    expect(userThemes[0]).toMatchObject({
      name: 'Lamplight (custom)',
      base: 'dark',
      overrides: { '--pnl': '#123456' },
    });
    expect(activeId).toBe(userThemes[0].id);
    expect(persisted().activeId).toBe(userThemes[0].id);

    // Selecting the built-in again *is* the reset: the override stays on the
    // fork, so it can never leak into 'dark' (or any other theme).
    a.setActiveTheme('dark');
    expect(a.getAppearance().activeId).toBe('dark');
    expect(a.getAppearance().userThemes[0].overrides).toEqual({ '--pnl': '#123456' });
  });

  it('lands later edits on the active fork instead of forking again', async () => {
    const a = await loadStore();
    a.setTokenOverride('--piece-blue', '#000000');
    a.setTokenOverride('--brass', '#ffffff');
    expect(a.getAppearance().userThemes).toHaveLength(1);
    expect(a.getAppearance().userThemes[0].overrides).toEqual({
      '--piece-blue': '#000000',
      '--brass': '#ffffff',
    });

    a.clearTokenOverride('--brass');
    expect(a.getAppearance().userThemes[0].overrides).toEqual({ '--piece-blue': '#000000' });
  });

  it('deletes the active user theme back to the built-in it forked', async () => {
    const a = await loadStore({ 'openblokus-appearance': '{"userThemes":[],"activeId":"walnut"}' });
    a.setTokenOverride('--ink', '#010101');
    a.deleteUserTheme(a.getAppearance().userThemes[0].id);
    expect(a.getAppearance()).toEqual({ userThemes: [], activeId: 'walnut' });
  });

  it('ignores unknown theme ids and drops unknown tokens on reload', async () => {
    const a = await loadStore();
    a.setActiveTheme('nope');
    expect(a.getAppearance().activeId).toBe('light');

    a.setTokenOverride('--ink', '#010101');
    a.setTokenOverride('--not-a-token', 'x');

    const b = await loadStore({ 'openblokus-appearance': JSON.stringify(a.getAppearance()) });
    expect(b.getAppearance().userThemes[0].overrides).toEqual({ '--ink': '#010101' });
  });
});

describe('migration off the pre-unification keys', () => {
  it('folds the selected palette and the token overrides into one user theme', async () => {
    const a = await loadStore({
      'openblokus-theme': 'walnut',
      'openblokus-settings': JSON.stringify({
        tokens: { '--pnl': '#111111', '--bogus': 'x' },
        inventoryDisplay: 'dots',
      }),
      'openblokus-palettes': JSON.stringify([
        {
          id: 'p1',
          name: 'Neon',
          colors: { blue: '#0000ff', yellow: '#ffff00', red: '#ff0000', green: '#00ff00' },
        },
      ]),
      'openblokus-palette-selected': 'p1',
    });

    const { userThemes, activeId } = a.getAppearance();
    expect(userThemes).toHaveLength(1);
    expect(userThemes[0]).toMatchObject({
      name: 'Neon',
      base: 'walnut',
      overrides: {
        '--pnl': '#111111',
        '--piece-blue': '#0000ff',
        '--piece-yellow': '#ffff00',
        '--piece-red': '#ff0000',
        '--piece-green': '#00ff00',
      },
    });
    expect(userThemes[0].overrides['--bogus']).toBeUndefined();
    expect(activeId).toBe(userThemes[0].id);
    expect(persisted().activeId).toBe(activeId);

    // The migrated keys are gone; the prefs key survives (it owns inventoryDisplay).
    expect(storage.has('openblokus-theme')).toBe(false);
    expect(storage.has('openblokus-palettes')).toBe(false);
    expect(storage.has('openblokus-palette-selected')).toBe(false);
    expect(storage.has('openblokus-settings')).toBe(true);
  });

  it('keeps unselected palettes as themes and puts loose token overrides in "Custom"', async () => {
    const a = await loadStore({
      'openblokus-theme': 'dark',
      'openblokus-settings': JSON.stringify({ tokens: { '--brass': '#abcdef' } }),
      'openblokus-palettes': JSON.stringify([
        {
          id: 'p1',
          name: 'Neon',
          colors: { blue: '#0000ff', yellow: '#ffff00', red: '#ff0000', green: '#00ff00' },
        },
      ]),
    });

    const { userThemes, activeId } = a.getAppearance();
    expect(userThemes.map((t) => t.name)).toEqual(['Neon', 'Custom']);
    expect(userThemes[1]).toMatchObject({ base: 'dark', overrides: { '--brass': '#abcdef' } });
    // The tokens were what was actually in effect before, so they stay in effect.
    expect(activeId).toBe(userThemes[1].id);
  });

  it('carries the old theme over when there is nothing else to migrate', async () => {
    const a = await loadStore({ 'openblokus-theme': 'walnut' });
    expect(a.getAppearance()).toEqual({ userThemes: [], activeId: 'walnut' });
  });

  it('survives corrupt storage with clean defaults', async () => {
    const a = await loadStore({ 'openblokus-appearance': '{not json' });
    expect(() => a.initAppearance()).not.toThrow();
    expect(a.getAppearance()).toEqual({ userThemes: [], activeId: 'light' });
  });
});
