import { ALL_COLORS, COLORS, DUO_COLORS } from '../shared/constants';

/**
 * Any color any variant can deal: Classic's four plus Duo's `black`/`white`.
 * A *game* only ever holds its variant's subset — see `playColorsOf(G)`.
 */
export type Color = (typeof ALL_COLORS)[number];

/** Classic's color / turn order: blue → yellow → red → green. */
export const COLOR_ORDER: readonly Color[] = COLORS;

/** Duo's color / turn order: black → white (GAME_SPEC_DUO §5). */
export const DUO_COLOR_ORDER: readonly Color[] = DUO_COLORS;

/**
 * A map keyed by color. **Partial by design**: a Duo state has no `blue` entry
 * and a Classic state no `black` one, so every read is a typecheck-visible
 * `undefined` unless the caller has established the color is in play. That is
 * the whole point — the alternative (a total `Record<Color, T>` filled for only
 * some keys) turns a wrong-variant read into silent corruption.
 */
export type ByColor<T> = Partial<Record<Color, T>>;

/**
 * All 21 piece identifiers, grouped by size (1, 2, 3, 4, 5 squares).
 * See GAME_SPEC §2 for the shapes.
 */
export const PIECE_IDS = [
  'I1',
  'I2',
  'I3', 'V3',
  'I4', 'O4', 'T4', 'L4', 'S4',
  'F5', 'I5', 'L5', 'N5', 'P5', 'T5', 'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5',
] as const;

export type PieceId = (typeof PIECE_IDS)[number];

/** A board cell / piece-square coordinate. x = column (0..19), y = row (0..19). */
export interface Cell {
  x: number;
  y: number;
}

/** Number of 90° clockwise rotations applied to a piece. */
export type Rotation = 0 | 1 | 2 | 3;

/**
 * A concrete placement request. The engine resolves this to absolute board cells
 * via resolveCells() — clients never send raw cell lists (anti-cheat, see ARCHITECTURE §5).
 */
export interface Placement {
  pieceId: PieceId;
  rotation: Rotation;
  /** Mirror the piece (across the vertical axis) before rotating. */
  reflected: boolean;
  /** Translation applied to the normalized, oriented piece. */
  x: number;
  y: number;
}

/** Number of human players. See GAME_SPEC §7. */
export type GameMode = 2 | 3 | 4;

/**
 * Which game is being played. `classic` = GAME_SPEC.md (20×20, four colors);
 * `duo` = GAME_SPEC_DUO.md (14×14, black + white, advanced scoring only).
 */
export type Variant = 'classic' | 'duo';

/** Scoring variant. See GAME_SPEC §6. */
export type ScoringVariant = 'basic' | 'advanced';

/** Per-color piece + status tracking. See GAME_SPEC §9 / ARCHITECTURE §3. */
export interface ColorState {
  /** Pieces not yet placed. */
  remaining: PieceId[];
  /** Last piece placed by this color (for the monomino-last bonus); null until first placement. */
  lastPlaced: PieceId | null;
  /** True once this color has made its first (corner) placement. */
  hasStarted: boolean;
  /** True once this color can no longer make any legal move. */
  stuck: boolean;
}

export interface GameConfig {
  mode: GameMode;
  scoring: ScoringVariant;
  /** color → owning human playerID, or 'shared' for the rotating color (3p). */
  owners: ByColor<string | 'shared'>;
  /**
   * Which rule set this game runs. Optional for backward compatibility — states
   * persisted before variants existed are Classic; read it via `variantOf(G)`.
   */
  variant?: Variant;
  /**
   * The colors this game deals, in turn order — `activeColorIndex` indexes into
   * *this*, not `COLOR_ORDER`. Optional for the same backward-compatibility
   * reason (pre-field states are Classic); read it via `playColorsOf(G)`.
   */
  playColors?: Color[];
  /**
   * Side length of the square board. Classic is 20 (GAME_SPEC §1); the Duo variant
   * is 14 (GAME_SPEC_DUO §1). Optional for backward compatibility — states persisted
   * before this field existed are Classic; read it via `boardSizeOf(G)`, never directly.
   */
  boardSize?: number;
  /**
   * color → the cell its first piece must cover (GAME_SPEC §3 / GAME_SPEC_DUO §3).
   * Classic uses the four corners, Duo two interior cells. Optional for the same
   * backward-compatibility reason; read it via `startCellOf(G, color)`.
   */
  startCells?: ByColor<Cell>;
}

/** The full boardgame.io game state (G). Must stay plain-JSON-serializable. */
export interface GameState {
  config: GameConfig;
  /** Flat N×N board (N = config.boardSize, default 20); cell = Color or null. Index = y * N + x. */
  board: (Color | null)[];
  /** Per-color state, present for exactly the variant's `playColors`. */
  colors: ByColor<ColorState>;
  /** Index into `playColorsOf(G)` of the color whose turn it currently is. */
  activeColorIndex: number;
  /** 3p only: index into the human rotation for the next shared-color turn. */
  sharedRotation: number;
  /** Flat board indices of the most recently placed piece (for UI highlight). */
  lastMove: number[];
}
