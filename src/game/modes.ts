import { BOARD_SIZE } from '../shared/constants';
import type {
  Cell,
  Color,
  ColorState,
  GameMode,
  GameState,
  ScoringVariant,
} from './types';
import { COLOR_ORDER, PIECE_IDS } from './types';

const MAX = BOARD_SIZE - 1;

/**
 * Each color's assigned starting corner; the color's first piece must cover it.
 * See GAME_SPEC §3. blue=top-left, yellow=top-right, red=bottom-right, green=bottom-left
 * (play order blue→yellow→red→green traces the corners clockwise).
 */
export const CORNERS: Record<Color, Cell> = {
  blue: { x: 0, y: 0 },
  yellow: { x: MAX, y: 0 },
  red: { x: MAX, y: MAX },
  green: { x: 0, y: MAX },
};

/**
 * Maps each color to the human playerID that owns it, or 'shared' for the
 * rotating color (3p). See GAME_SPEC §7.
 */
export function ownersFor(mode: GameMode): Record<Color, string | 'shared'> {
  switch (mode) {
    case 4:
      return { blue: '0', yellow: '1', red: '2', green: '3' };
    case 2:
      return { blue: '0', yellow: '1', red: '0', green: '1' };
    case 3:
      return { blue: '0', yellow: '1', red: '2', green: 'shared' };
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unsupported mode: ${_exhaustive}`);
    }
  }
}

/** Build a fresh game state for the given mode and scoring variant. */
export function createInitialState(
  mode: GameMode,
  scoring: ScoringVariant = 'basic',
): GameState {
  const colors = {} as Record<Color, ColorState>;
  for (const color of COLOR_ORDER) {
    colors[color] = {
      remaining: [...PIECE_IDS],
      lastPlaced: null,
      hasStarted: false,
      stuck: false,
    };
  }

  return {
    config: { mode, scoring, owners: ownersFor(mode) },
    board: Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null),
    colors,
    activeColorIndex: 0,
    sharedRotation: 0,
  };
}
