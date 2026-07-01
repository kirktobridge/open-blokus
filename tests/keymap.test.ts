import { describe, it, expect } from 'vitest';
import {
  BINDINGS,
  matchAction,
  normalizeKey,
  type PlacementAction,
} from '../src/client/controls/keymap';

describe('placement keymap', () => {
  it('binds each key to at most one action (no conflicts)', () => {
    const seen = new Map<string, PlacementAction>();
    for (const action of Object.keys(BINDINGS) as PlacementAction[]) {
      for (const key of BINDINGS[action]) {
        expect(seen.has(key), `key "${key}" bound to both ${seen.get(key)} and ${action}`).toBe(
          false,
        );
        seen.set(key, action);
      }
    }
  });

  it('gives every action at least one binding', () => {
    for (const action of Object.keys(BINDINGS) as PlacementAction[]) {
      expect(BINDINGS[action].length).toBeGreaterThan(0);
    }
  });

  it('normalizes space and lowercases single characters', () => {
    expect(normalizeKey({ key: ' ' })).toBe('Space');
    expect(normalizeKey({ key: 'R' })).toBe('r');
    expect(normalizeKey({ key: 'ArrowLeft' })).toBe('ArrowLeft');
  });

  it('matches events to actions (arrows move, WASD orient)', () => {
    expect(matchAction({ key: 'ArrowUp' })).toBe('moveUp');
    expect(matchAction({ key: 'ArrowLeft' })).toBe('moveLeft');
    expect(matchAction({ key: 'a' })).toBe('rotateCCW');
    expect(matchAction({ key: 'd' })).toBe('rotateCW');
    expect(matchAction({ key: 'w' })).toBe('flip');
    expect(matchAction({ key: 's' })).toBe('flip');
    expect(matchAction({ key: ' ' })).toBe('place');
    expect(matchAction({ key: 'Enter' })).toBe('submit');
    expect(matchAction({ key: 'Escape' })).toBe('cancel');
    expect(matchAction({ key: 'z' })).toBeNull();
  });
});
