import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  ownerOf,
  startCellOf,
  variantOf,
} from '../src/game/modes';
import type { GameState } from '../src/game/types';

/**
 * Behavioral guards in modes.ts — the backward-compatible fallbacks and the
 * "this color isn't in play" throws. The variants-registry test pins the
 * `VARIANTS` table against the docs; this pins the functions that read it.
 */
describe('variantOf', () => {
  it('falls back to classic for states persisted before variants existed', () => {
    // Legacy states (old localStorage, saved logs) have no config.variant.
    expect(variantOf({ config: {} } as unknown as GameState)).toBe('classic');
    expect(variantOf(createInitialState(2, 'advanced', 'duo'))).toBe('duo');
  });
});

describe('ownerOf', () => {
  it('throws for a color the variant never dealt', () => {
    // Duo deals only black/white — reaching for a Classic color is a caller bug,
    // and must throw rather than return undefined.
    const duo = createInitialState(2, 'advanced', 'duo');
    expect(() => ownerOf(duo, 'blue')).toThrow();
    expect(ownerOf(duo, 'black')).toBe('0');
  });
});

describe('startCellOf', () => {
  it('throws when neither the variant nor the corner table has a cell', () => {
    // A Classic game has no start cell for black/white; asking for one is a bug.
    const classic = createInitialState(4, 'basic');
    expect(() => startCellOf(classic, 'black')).toThrow();
    expect(startCellOf(classic, 'blue')).toEqual({ x: 0, y: 0 });
  });
});

describe('createInitialState defaults', () => {
  it('defaults scoring to basic and starts with an empty lastMove', () => {
    const G = createInitialState(4);
    expect(G.config.scoring).toBe('basic');
    expect(G.lastMove).toEqual([]);
  });
});
