/**
 * Single source of truth for placement key bindings. Keep every binding here so
 * conflicts are visible in one place (a unit test guards against duplicates).
 *
 * Keys are stored normalized (see `normalizeKey`): single characters lowercased,
 * the space bar as `'Space'`, and everything else as the raw `KeyboardEvent.key`
 * (`'ArrowLeft'`, `'Enter'`, `'Escape'`, …).
 */
export type PlacementAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'rotateCW'
  | 'rotateCCW'
  | 'flip'
  | 'place'
  | 'submit'
  | 'cancel';

/** Action → the normalized keys that trigger it. */
export const BINDINGS: Record<PlacementAction, string[]> = {
  moveUp: ['ArrowUp'],
  moveDown: ['ArrowDown'],
  moveLeft: ['ArrowLeft'],
  moveRight: ['ArrowRight'],
  rotateCCW: ['a'],
  rotateCW: ['d', 'r'],
  flip: ['w', 's', 'f'],
  place: ['Space'],
  submit: ['Enter'],
  cancel: ['Escape'],
};

/** Normalize a keyboard event into a stable key name used by `BINDINGS`. */
export function normalizeKey(e: Pick<KeyboardEvent, 'key'>): string {
  if (e.key === ' ' || e.key === 'Spacebar') return 'Space';
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

// Reverse lookup, built once. A key mapped to two actions would collide here;
// the unit test asserts that never happens.
const KEY_TO_ACTION: Map<string, PlacementAction> = (() => {
  const map = new Map<string, PlacementAction>();
  for (const action of Object.keys(BINDINGS) as PlacementAction[]) {
    for (const key of BINDINGS[action]) map.set(key, action);
  }
  return map;
})();

/** The placement action bound to this event, or null if none. */
export function matchAction(e: Pick<KeyboardEvent, 'key'>): PlacementAction | null {
  return KEY_TO_ACTION.get(normalizeKey(e)) ?? null;
}

/** Human-readable label for a single normalized key, for on-screen hints. */
function keyLabel(key: string): string {
  switch (key) {
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'Space':
      return 'Space';
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/** Pretty hint of the keys for an action, e.g. `→ / R` — for button labels. */
export function describeKeys(action: PlacementAction): string {
  return BINDINGS[action].map(keyLabel).join(' / ');
}
