import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { idx } from '../src/game/board';
import type { Color, GameState } from '../src/game/types';
import { expansionAnchors } from '../src/client/advisor/legalMoves';
import { incursionCorners } from '../src/client/advisor/incursions';
import { SIGNAL_THRESHOLDS } from '../src/client/signals';
import { colorStateOf } from '../src/game/modes';
import { BOARD_SIZE } from '../src/shared/constants';

/**
 * Incursion advisor (P44): the open corners `forColor` relies on that an opponent
 * could legally seize next turn with a real (>= INCURSION_MIN_PIECE) piece. These
 * craft positions directly — paint a couple of cells, mark the color started — so
 * the geometry is deterministic; `generateLegalMoves` (inside the predicate) still
 * does the real legality work over the painted board.
 */

/** Paint `color` onto board cells and mark it started (enough for the predicate). */
function paint(G: GameState, color: Color, cells: [number, number][]): void {
  for (const [x, y] of cells) G.board[idx(x, y, BOARD_SIZE)] = color;
  colorStateOf(G, color).hasStarted = true;
}

/** A 4p board with yellow + red benched, so a test isolates blue vs green. */
function blueVsGreen(): GameState {
  const G = createInitialState(4);
  colorStateOf(G, 'yellow').stuck = true;
  colorStateOf(G, 'red').stuck = true;
  return G;
}

describe('incursionCorners (P44 incursion advisor)', () => {
  it('opening board: no incursions — nobody has grown a wall yet', () => {
    // Blue has no cells, so it has no open corners to be threatened.
    expect(incursionCorners(createInitialState(4), 'blue')).toEqual([]);
  });

  it('flags a blue corner an opponent can thread a real piece onto', () => {
    const G = blueVsGreen();
    paint(G, 'blue', [[5, 5]]); // blue's open corners: (4,4) (6,4) (4,6) (6,6)
    paint(G, 'green', [[7, 7]]); // green attaches diagonally at (6,6), (8,6), …

    const cells = incursionCorners(G, 'blue');
    // Green can hook an I3/L4/… onto (6,6) — a blue corner — so it's at risk.
    expect(cells).toContain(idx(6, 6, BOARD_SIZE));

    // Every flagged cell is an empty corner blue actually owns (never a false mark).
    const anchors = new Set(expansionAnchors(G, 'blue'));
    for (const c of cells) {
      expect(G.board[c], `cell ${c} must be empty`).toBeNull();
      expect(anchors.has(c), `cell ${c} must be a blue corner`).toBe(true);
    }
  });

  it('a corner an opponent can only reach with an undersized piece is not flagged', () => {
    const G = blueVsGreen();
    paint(G, 'blue', [[5, 5]]);
    paint(G, 'green', [[7, 7]]);
    // Green holds only a 2-square piece — it can touch (6,6) but that's a scratch,
    // not an incursion (below INCURSION_MIN_PIECE), so nothing is flagged.
    expect(SIGNAL_THRESHOLDS.INCURSION_MIN_PIECE).toBeGreaterThan(2);
    colorStateOf(G, 'green').remaining = ['I2'];
    expect(incursionCorners(G, 'blue')).toEqual([]);
  });

  it("a teammate's reach doesn't count (2p multi-color)", () => {
    // 2p: blue + red are one player, yellow + green the other. Bench the opponents;
    // red (blue's own color) can reach blue's corner, but that's not an incursion.
    const G = createInitialState(2);
    colorStateOf(G, 'yellow').stuck = true;
    colorStateOf(G, 'green').stuck = true;
    paint(G, 'blue', [[5, 5]]);
    paint(G, 'red', [[7, 7]]);
    expect(incursionCorners(G, 'blue')).toEqual([]);
  });

  it('a stuck opponent threatens nothing', () => {
    const G = blueVsGreen();
    paint(G, 'blue', [[5, 5]]);
    paint(G, 'green', [[7, 7]]);
    colorStateOf(G, 'green').stuck = true; // the only reacher can no longer move
    expect(incursionCorners(G, 'blue')).toEqual([]);
  });
});
