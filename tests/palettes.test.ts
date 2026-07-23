import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PIECE_PALETTES, pieceOverridesOf } from '../src/client/palettes';
import { ALL_COLORS } from '../src/shared/constants';
import { PIECE_TOKEN } from '../src/client/theme';

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * The preset registry is the inventory (CLAUDE.md: inventories live in a test,
 * not prose): a palette that forgets a color or ships a non-hex is caught here,
 * not by eye. Applying one is exercised against the appearance store, which is a
 * module singleton read at import, so each case re-imports it on fresh storage
 * (same idiom as appearance.test.ts).
 */
describe('preset piece palettes (registry)', () => {
  it('has unique ids and names', () => {
    expect(new Set(PIECE_PALETTES.map((p) => p.id)).size).toBe(PIECE_PALETTES.length);
    expect(new Set(PIECE_PALETTES.map((p) => p.name)).size).toBe(PIECE_PALETTES.length);
  });

  it('assigns every semantic color a #rrggbb hex', () => {
    for (const p of PIECE_PALETTES) {
      for (const c of ALL_COLORS) {
        expect(p.colors[c], `${p.id}.${c}`).toMatch(HEX6);
      }
    }
  });

  it('leads with the colorblind-safe preset', () => {
    expect(PIECE_PALETTES[0].id).toBe('okabe-ito');
  });

  it('maps a palette onto exactly the six --piece-* tokens', () => {
    const overrides = pieceOverridesOf(PIECE_PALETTES[0]);
    expect(Object.keys(overrides).sort()).toEqual(ALL_COLORS.map((c) => PIECE_TOKEN[c]).sort());
    expect(overrides[PIECE_TOKEN.blue]).toBe(PIECE_PALETTES[0].colors.blue);
  });
});

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

async function loadStore(seed: Record<string, string> = {}) {
  vi.stubGlobal('localStorage', fakeStorage(seed));
  vi.resetModules();
  return import('../src/client/appearance');
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('applyPiecePalette', () => {
  const dracula = PIECE_PALETTES.find((p) => p.id === 'dracula')!;
  const overrides = pieceOverridesOf(dracula);

  it('forks a pristine built-in, naming the fork "<Mat> · <Palette>"', async () => {
    const a = await loadStore({ 'openblokus-appearance': '{"userThemes":[],"activeId":"walnut"}' });
    a.applyPiecePalette('dracula');

    const { userThemes, activeId } = a.getAppearance();
    expect(userThemes).toHaveLength(1);
    expect(userThemes[0]).toMatchObject({ name: 'Walnut · Dracula', base: 'walnut', overrides });
    expect(activeId).toBe(userThemes[0].id);
  });

  it('overlays the piece tokens on an active fork, keeping its other overrides', async () => {
    const a = await loadStore();
    a.setTokenOverride('--brass', '#abcdef'); // forks Linen
    a.applyPiecePalette('dracula');

    const { userThemes } = a.getAppearance();
    expect(userThemes).toHaveLength(1); // overlaid, not a second fork
    expect(userThemes[0].overrides).toEqual({ '--brass': '#abcdef', ...overrides });
  });

  it('ignores an unknown palette id', async () => {
    const a = await loadStore();
    a.applyPiecePalette('nope');
    expect(a.getAppearance()).toEqual({ userThemes: [], activeId: 'light' });
  });
});
