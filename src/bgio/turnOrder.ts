import type { GameState } from '../game/types';
import { COLOR_ORDER } from '../game/types';

/** The human playerID that owns the color at `colorIndex` right now. */
function humanForColor(G: GameState, colorIndex: number): string {
  const owner = G.config.owners[COLOR_ORDER[colorIndex]];
  return owner === 'shared' ? String(G.sharedRotation) : owner;
}

/** The human who owns the currently active color (used to authorize moves). */
export const resolveOwner = (G: GameState): string =>
  humanForColor(G, G.activeColorIndex);

/**
 * playOrderPos for the color at `colorIndex`. With the default playOrder
 * (['0','1',...]), the position equals the numeric playerID.
 */
export const seatPos = (G: GameState, colorIndex: number): number =>
  Number(humanForColor(G, colorIndex));
