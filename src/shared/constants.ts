/** Side length of the Classic square board (cells per row and column). */
export const BOARD_SIZE = 20;

/** Side length of the Duo board (GAME_SPEC_DUO §1). */
export const DUO_BOARD_SIZE = 14;

/** Registered boardgame.io game name (shared by client, server, and lobby). */
export const GAME_NAME = 'open-blokus';

/** Classic's colors, in turn order: blue → yellow → red → green. */
export const COLORS = ['blue', 'yellow', 'red', 'green'] as const;

/** Duo's colors, in turn order — black moves first (GAME_SPEC_DUO §5). */
export const DUO_COLORS = ['black', 'white'] as const;

/**
 * Every color any variant can put in play. Not a turn order and not a per-game
 * color list — a variant's own list is `config.playColors` (read it via
 * `playColorsOf`). Exists so `Color` spans all variants while a game only ever
 * holds the colors its variant actually deals.
 */
export const ALL_COLORS = [...COLORS, ...DUO_COLORS] as const;
