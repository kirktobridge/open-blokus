import type { Color } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';

/**
 * Clockwise quarter-turns that bring each color's home corner to the bottom-right
 * of the board view. The play screen orients to the local seat's color with this
 * (BlokusBoardView), and the post-game replay scrubber reuses it so a reviewed
 * game shows in the same orientation the player actually saw.
 */
export const TURNS_TO_BOTTOM_RIGHT: Record<Color, number> = { blue: 2, yellow: 1, red: 0, green: 3 };

/**
 * The color the local human played, read from a record's seat labels ("human"),
 * or undefined for an all-AI watch game (no human seat → no preferred orientation).
 * Picks the first human color if several are flagged (hot-seat / multi-color seats).
 */
export function humanColor(seats: Record<Color, string>): Color | undefined {
  return COLOR_ORDER.find((c) => seats[c] === 'human');
}
