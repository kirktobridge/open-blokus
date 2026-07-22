import { BOARD_SIZE, DUO_BOARD_SIZE } from '../shared/constants';
import type {
  ByColor,
  Cell,
  Color,
  ColorState,
  GameMode,
  GameState,
  ScoringVariant,
  Variant,
} from './types';
import { COLOR_ORDER, DUO_COLOR_ORDER, PIECE_IDS } from './types';

const MAX = BOARD_SIZE - 1;

/**
 * Each Classic color's assigned starting corner; the color's first piece must
 * cover it. See GAME_SPEC §3. blue=top-left, yellow=top-right, red=bottom-right,
 * green=bottom-left (play order blue→yellow→red→green traces the corners clockwise).
 */
export const CORNERS: ByColor<Cell> = {
  blue: { x: 0, y: 0 },
  yellow: { x: MAX, y: 0 },
  red: { x: MAX, y: MAX },
  green: { x: 0, y: MAX },
};

/**
 * Duo's two *interior* start cells (GAME_SPEC_DUO §3). Not corners — that is the
 * variant's defining structural difference. The pair is 180°-symmetric about the
 * board centre (`4 + 9 === 13` on both axes); the anti-diagonal `(4,9)`/`(9,4)`
 * is the documented misreading of the retail 1-indexed `5,10` notation and is
 * wrong. `duoStartCellsAreSymmetric` in the tests pins this (spec case D5).
 */
export const DUO_START_CELLS: ByColor<Cell> = {
  black: { x: 4, y: 4 },
  white: { x: DUO_BOARD_SIZE - 1 - 4, y: DUO_BOARD_SIZE - 1 - 4 },
};

/**
 * Everything that distinguishes one variant from another, in one place, so a new
 * variant is a table entry rather than a scatter of conditionals. `scoring: null`
 * means the variant leaves the choice to the lobby; a value pins it and the
 * lobby selection is ignored (Duo — GAME_SPEC_DUO §4).
 */
export interface VariantSpec {
  boardSize: number;
  /** The colors dealt, in turn order. */
  playColors: readonly Color[];
  startCells: ByColor<Cell>;
  /** Forced scoring system, or null when the variant permits either. */
  scoring: ScoringVariant | null;
  /** Human seat counts this variant supports. */
  modes: readonly GameMode[];
}

export const VARIANTS: Record<Variant, VariantSpec> = {
  classic: {
    boardSize: BOARD_SIZE,
    playColors: COLOR_ORDER,
    startCells: CORNERS,
    scoring: null,
    modes: [2, 3, 4],
  },
  duo: {
    boardSize: DUO_BOARD_SIZE,
    playColors: DUO_COLOR_ORDER,
    startCells: DUO_START_CELLS,
    scoring: 'advanced',
    modes: [2],
  },
};

/**
 * The rule set this game runs. Reads `config.variant`, falling back to Classic
 * for states persisted before variants existed (localStorage games, saved logs,
 * shared replays) — those are all Classic by construction.
 */
export const variantOf = (G: GameState): Variant => G.config.variant ?? 'classic';

/**
 * The colors in play, in turn order. `activeColorIndex` indexes into this.
 * Same backward-compatible fallback as `variantOf`.
 */
export const playColorsOf = (G: GameState): readonly Color[] =>
  G.config.playColors ?? COLOR_ORDER;

/**
 * The board's side length. Reads `config.boardSize`, falling back to Classic for
 * states persisted before the field existed.
 */
export const boardSizeOf = (G: GameState): number => G.config.boardSize ?? BOARD_SIZE;

/**
 * The cell `color`'s first piece must cover. Reads `config.startCells` with the same
 * backward-compatible fallback as boardSizeOf: pre-field states are Classic, whose
 * start cells are the corners.
 */
export function startCellOf(G: GameState, color: Color): Cell {
  const cell = G.config.startCells?.[color] ?? CORNERS[color];
  if (!cell) throw new Error(`no start cell for ${color} in this variant`);
  return cell;
}

/**
 * `color`'s per-color state. Throws rather than returning undefined for a color
 * the variant never dealt: reaching for `blue` in a Duo game is a bug in the
 * caller, and the whole reason `GameState['colors']` is partial is to surface it.
 */
export function colorStateOf(G: GameState, color: Color): ColorState {
  const cs = G.colors[color];
  if (!cs) throw new Error(`color ${color} is not in play in this ${variantOf(G)} game`);
  return cs;
}

/** The human playerID that owns `color`, or 'shared' for the rotating color (3p). */
export function ownerOf(G: GameState, color: Color): string | 'shared' {
  const owner = G.config.owners[color];
  if (owner === undefined) {
    throw new Error(`color ${color} is not in play in this ${variantOf(G)} game`);
  }
  return owner;
}

/**
 * Maps each color to the human playerID that owns it, or 'shared' for the
 * rotating color (3p). See GAME_SPEC §7; Duo is one color per seat (GAME_SPEC_DUO §5).
 */
export function ownersFor(mode: GameMode, variant: Variant = 'classic'): ByColor<string | 'shared'> {
  if (variant === 'duo') return { black: '0', white: '1' };
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

/**
 * The scoring system a variant will actually play under, given a lobby choice.
 * Duo pins advanced and ignores the selection (GAME_SPEC_DUO §4 [RULING]).
 */
export const scoringFor = (variant: Variant, chosen: ScoringVariant): ScoringVariant =>
  VARIANTS[variant].scoring ?? chosen;

/** Build a fresh game state for the given mode, scoring variant, and rule set. */
export function createInitialState(
  mode: GameMode,
  scoring: ScoringVariant = 'basic',
  variant: Variant = 'classic',
): GameState {
  const spec = VARIANTS[variant];
  if (!spec.modes.includes(mode)) {
    throw new Error(`${variant} does not support ${mode} players`);
  }

  const colors: ByColor<ColorState> = {};
  for (const color of spec.playColors) {
    colors[color] = {
      remaining: [...PIECE_IDS],
      lastPlaced: null,
      hasStarted: false,
      stuck: false,
    };
  }

  return {
    config: {
      mode,
      scoring: scoringFor(variant, scoring),
      variant,
      owners: ownersFor(mode, variant),
      playColors: [...spec.playColors],
      boardSize: spec.boardSize,
      startCells: { ...spec.startCells },
    },
    board: Array.from({ length: spec.boardSize * spec.boardSize }, () => null),
    colors,
    activeColorIndex: 0,
    sharedRotation: 0,
    lastMove: [],
  };
}
