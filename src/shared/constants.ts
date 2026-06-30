/** Side length of the square board (cells per row and column). */
export const BOARD_SIZE = 20;

/** Registered boardgame.io game name (shared by client, server, and lobby). */
export const GAME_NAME = 'open-blokus';

/** Canonical color and turn order: blue → yellow → red → green. */
export const COLORS = ['blue', 'yellow', 'red', 'green'] as const;
