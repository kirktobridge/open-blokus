import { pieceSize } from './pieces';
import type { Color, ColorState, GameState } from './types';
import { COLOR_ORDER } from './types';

/** Sum of square-counts of a color's unplaced pieces (GAME_SPEC §6). */
export const remainingSquares = (cs: ColorState): number =>
  cs.remaining.reduce((sum, p) => sum + pieceSize(p), 0);

/**
 * Score for a single color under the active scoring variant (GAME_SPEC §6).
 * - basic: remaining squares (lower is better)
 * - advanced: -remaining + 15 if all placed + 5 more if the monomino was last
 *   (higher is better)
 */
export function scoreColor(G: GameState, color: Color): number {
  const cs = G.colors[color];
  const rem = remainingSquares(cs);
  if (G.config.scoring === 'basic') return rem;
  if (cs.remaining.length > 0) return -rem;
  return 15 + (cs.lastPlaced === 'I1' ? 5 : 0);
}

/**
 * Totals per human playerID, aggregating the colors they control. The shared
 * color (3p) is ignored — it counts for no one (GAME_SPEC §6.3, §7).
 */
export function scorePlayers(G: GameState): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const color of COLOR_ORDER) {
    const owner = G.config.owners[color];
    if (owner === 'shared') continue;
    totals[owner] = (totals[owner] ?? 0) + scoreColor(G, color);
  }
  return totals;
}

/**
 * The winning playerID(s). Lowest total wins under basic scoring, highest under
 * advanced. Ties return all co-winners (GAME_SPEC §6.3).
 */
export function determineWinners(G: GameState): string[] {
  const entries = Object.entries(scorePlayers(G));
  if (entries.length === 0) return [];
  const values = entries.map(([, v]) => v);
  const best = G.config.scoring === 'basic' ? Math.min(...values) : Math.max(...values);
  return entries.filter(([, v]) => v === best).map(([p]) => p);
}

/** Per-color scores, per-player totals, and winners — for the game-over payload. */
export function finalScores(G: GameState): {
  colors: Record<Color, number>;
  players: Record<string, number>;
  winners: string[];
} {
  const colors = {} as Record<Color, number>;
  for (const color of COLOR_ORDER) colors[color] = scoreColor(G, color);
  return { colors, players: scorePlayers(G), winners: determineWinners(G) };
}
