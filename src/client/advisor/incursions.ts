import { pieceSize } from '../../game/pieces';
import { generateLegalMoves } from '../../game/moves';
import { COLOR_ORDER } from '../../game/types';
import type { Color, GameState } from '../../game/types';
import { expansionAnchors, placementCells } from './legalMoves';

/**
 * Incursion advisor (P44): a *standing* read of the current position — the open
 * corners `forColor` is relying on that an opponent could legally seize next turn,
 * threading a real piece past your wall into the space behind it. This is the
 * defensive read strong players make and beginners miss.
 *
 * Deliberately **not** an event: an EVENTS.md event is a `(prev, cur)` crossing
 * that fires once on a ply (banner + TTL + sound cue); this is a pure predicate
 * over one `GameState`, silent and recomputed each turn. It sits with the other
 * advisor predicates (`legalMoves.ts`) and leans on the rules core
 * (`generateLegalMoves`, `expansionAnchors`) so it can never drift from the
 * engine's actual legal reach.
 */

/**
 * The one feel-tuned threshold. A single-square nub poking one of your corners is a
 * scratch, not an incursion — an opponent has to be able to thread a *real* piece
 * (this many squares or more) onto the corner for it to read as a threat worth
 * flagging. Analogous to `cut`'s `CUT_MIN_LOSS`: magnitude, tuned by feel.
 */
export const INCURSION_MIN_PIECE = 3;

/** Two colors are the same player's (so not opponents). Shared is nobody's ally. */
function sameOwner(G: GameState, a: Color, b: Color): boolean {
  const oa = G.config.owners[a];
  return oa !== 'shared' && oa === G.config.owners[b];
}

/**
 * Board indices of `forColor`'s open corners that at least one *opponent* could
 * legally cover next turn with a piece of at least `INCURSION_MIN_PIECE` squares —
 * the at-risk corners the overlay highlights. Empty when the color has no open
 * corners or no opponent can reach them.
 *
 * "Your corners" = `expansionAnchors` (the empty cells diagonally adjacent to your
 * pieces where a next piece can hook on — the space you're counting on to grow).
 * "An opponent could seize it" = some opponent's legal placement of a big-enough
 * piece covers that exact cell. Stuck opponents and the color's own teammate
 * (2p multi-color) threaten nothing and are skipped.
 */
export function incursionCorners(G: GameState, forColor: Color): number[] {
  const anchors = new Set(expansionAnchors(G, forColor));
  if (anchors.size === 0) return [];

  const atRisk = new Set<number>();
  for (const opp of COLOR_ORDER) {
    if (opp === forColor || sameOwner(G, opp, forColor)) continue;
    if (G.colors[opp].stuck) continue;
    for (const placement of generateLegalMoves(G, opp)) {
      if (pieceSize(placement.pieceId) < INCURSION_MIN_PIECE) continue;
      for (const cell of placementCells(placement)) {
        if (anchors.has(cell)) atRisk.add(cell);
      }
    }
  }
  return [...atRisk];
}
