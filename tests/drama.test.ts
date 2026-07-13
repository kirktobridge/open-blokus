import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { finalScores } from '../src/game/scoring';
import { attachCells, attachPoints } from '../src/game/ai/alphabeta';
import type { Cell, Color, GameState } from '../src/game/types';
import { COLOR_ORDER } from '../src/game/types';
import {
  TOTAL_SQUARES,
  placedSquares,
  newlyStuckColors,
  outOfMovesText,
  detectEvents,
  EVENT_IDS,
  EVENT_THRESHOLDS,
  revealRows,
  resultSummary,
} from '../src/client/drama';

describe('placedSquares / TOTAL_SQUARES', () => {
  it('all 21 pieces total 89 squares', () => {
    expect(TOTAL_SQUARES).toBe(89);
  });

  it('coverage = total minus remaining', () => {
    const G = createInitialState(4, 'basic');
    expect(placedSquares(G.colors.blue)).toBe(0); // nothing placed yet
    G.colors.blue.remaining = []; // everything placed
    expect(placedSquares(G.colors.blue)).toBe(TOTAL_SQUARES);
  });
});

describe('newlyStuckColors', () => {
  it('reports only the colors that flipped to stuck this update', () => {
    const prev = createInitialState(4, 'basic');
    const cur = createInitialState(4, 'basic');
    prev.colors.red.stuck = true; // already stuck before → not "newly"
    cur.colors.red.stuck = true;
    cur.colors.yellow.stuck = true; // flipped this update
    expect(newlyStuckColors(prev, cur)).toEqual(['yellow']);
  });

  it('returns [] when nothing changed', () => {
    const G = createInitialState(4, 'basic');
    expect(newlyStuckColors(G, G)).toEqual([]);
  });
});

describe('outOfMovesText', () => {
  it('capitalizes the color', () => {
    expect(outOfMovesText('green')).toBe('Green is out of moves');
  });
});

describe('revealRows', () => {
  it('sorts winners first, then by coverage desc', () => {
    const G = createInitialState(4, 'basic');
    // green covers most but red is the winner (fewest remaining → wins basic).
    G.colors.red.remaining = []; // placed 89, winner
    G.colors.green.remaining = ['I1']; // placed 88
    G.colors.blue.remaining = ['I5', 'V5']; // placed 79
    G.colors.yellow.remaining = ['I1']; // placed 88
    const rows = revealRows(G, finalScores(G));

    expect(rows[0].color).toBe('red');
    expect(rows[0].isWinner).toBe(true);
    // Remaining three ranked by coverage desc: green/yellow (88) before blue (79).
    expect(rows[rows.length - 1].color).toBe('blue');
    expect(rows.every((r) => (r.color === 'red' ? r.isWinner : !r.isWinner))).toBe(true);
  });
});

describe('resultSummary', () => {
  it('names the winner and lists every color score', () => {
    const G = createInitialState(4, 'basic');
    G.colors.blue.remaining = []; // winner (0 remaining)
    const text = resultSummary(G, finalScores(G));
    expect(text).toContain('Blue wins');
    for (const name of ['Blue', 'Yellow', 'Red', 'Green']) expect(text).toContain(name);
  });
});

// --- Event detectors (P32) --------------------------------------------------

/**
 * Detectors read only `board`, per-color `hasStarted`/`stuck`/`remaining`, and
 * `lastMove`, so fixtures paint cells straight onto the board rather than replaying
 * legal games — that keeps each case a single, readable board position.
 */
function paint(G: GameState, color: Color, cells: Cell[]): void {
  for (const c of cells) G.board[c.y * 20 + c.x] = color;
  G.colors[color].hasStarted = true;
}

/** Paint a placement and record it as the move that just happened. */
function play(G: GameState, color: Color, cells: Cell[]): void {
  paint(G, color, cells);
  G.lastMove = cells.map((c) => c.y * 20 + c.x);
}

const clone = (G: GameState): GameState => structuredClone(G);

/** A corner-to-corner monomino staircase — a color with a wide-open frontier. */
const staircase = (x: number, y: number): Cell[] => [
  { x, y },
  { x: x + 1, y: y + 1 },
  { x: x + 2, y: y + 2 },
  { x: x + 3, y: y + 3 },
];

describe('detectEvents — cut', () => {
  it('fires when a placement guts a color’s frontier, and carries the killed cells', () => {
    const prev = createInitialState(4, 'basic');
    paint(prev, 'blue', staircase(2, 2));
    paint(prev, 'red', [{ x: 15, y: 15 }]);
    const frontier = attachCells(prev, 'blue');
    expect(frontier.length).toBe(10);

    const cur = clone(prev);
    play(cur, 'red', frontier.slice(0, 3)); // red lands on three of blue's open corners

    const events = detectEvents(prev, cur);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'cut', color: 'blue', by: 'red' });
    expect(events[0].text).toBe('Red cut off Blue');
    expect(events[0].lostCells).toEqual(frontier.slice(0, 3));
  });

  it('stays quiet for an incidental loss below the minimum', () => {
    const prev = createInitialState(4, 'basic');
    paint(prev, 'blue', staircase(2, 2));
    paint(prev, 'red', [{ x: 15, y: 15 }]);
    const frontier = attachCells(prev, 'blue');

    const cur = clone(prev);
    play(cur, 'red', frontier.slice(0, EVENT_THRESHOLDS.CUT_MIN_LOSS - 1));

    expect(detectEvents(prev, cur)).toEqual([]);
  });

  it('stays quiet when the loss is big but the frontier was bigger still (share bar)', () => {
    const prev = createInitialState(4, 'basic');
    // Blue sprawls across the board: a wide-open frontier shrugs off a few lost corners.
    paint(prev, 'blue', [...staircase(2, 2), ...staircase(12, 2), ...staircase(2, 12)]);
    paint(prev, 'red', [{ x: 19, y: 19 }]);
    const frontier = attachCells(prev, 'blue');
    const lost = frontier.slice(0, EVENT_THRESHOLDS.CUT_MIN_LOSS + 1);
    // The loss clears the flat minimum but not the share bar — that's the case under test.
    expect(lost.length).toBeGreaterThanOrEqual(EVENT_THRESHOLDS.CUT_MIN_LOSS);
    expect(lost.length).toBeLessThan(EVENT_THRESHOLDS.CUT_MIN_SHARE * frontier.length);

    const cur = clone(prev);
    play(cur, 'red', lost);

    expect(detectEvents(prev, cur)).toEqual([]);
  });

  it('names only the worst-hit victim — one cut per placement', () => {
    const prev = createInitialState(4, 'basic');
    paint(prev, 'blue', staircase(2, 2));
    paint(prev, 'yellow', staircase(12, 12));
    paint(prev, 'red', [{ x: 0, y: 19 }]);
    const blueLost = attachCells(prev, 'blue').slice(0, 3);
    const yellowLost = attachCells(prev, 'yellow').slice(0, 4); // the bigger loss

    const cur = clone(prev);
    play(cur, 'red', [...blueLost, ...yellowLost]);

    const cuts = detectEvents(prev, cur).filter((e) => e.kind === 'cut');
    expect(cuts).toHaveLength(1);
    expect(cuts[0].color).toBe('yellow');
  });

  it('yields to out-of-moves when the victim goes stuck on the same placement', () => {
    const prev = createInitialState(4, 'basic');
    paint(prev, 'blue', staircase(2, 2));
    paint(prev, 'red', [{ x: 15, y: 15 }]);

    const cur = clone(prev);
    play(cur, 'red', attachCells(prev, 'blue').slice(0, 3));
    cur.colors.blue.stuck = true;

    const events = detectEvents(prev, cur);
    expect(events.map((e) => e.kind)).toEqual(['out-of-moves']);
    expect(events[0].color).toBe('blue');
  });

  it('never cuts the mover against itself', () => {
    const prev = createInitialState(4, 'basic');
    paint(prev, 'red', staircase(2, 2));

    const cur = clone(prev);
    play(cur, 'red', attachCells(prev, 'red').slice(0, 4)); // red buries its own corners

    expect(detectEvents(prev, cur).some((e) => e.kind === 'cut')).toBe(false);
  });
});

describe('detectEvents — cramped', () => {
  /**
   * Blue squeezed by green to exactly one attach point above the bar — so a single
   * buried corner tips it over, and a one-point loss is far too small to be a cut.
   * Built off the threshold rather than a hand-counted shape, so retuning the bar
   * doesn't quietly turn this into a different test.
   */
  const onTheEdge = (): GameState => {
    const G = createInitialState(4, 'basic');
    paint(G, 'blue', staircase(2, 2));
    paint(G, 'red', [{ x: 19, y: 19 }]);
    const surplus = attachCells(G, 'blue').length - (EVENT_THRESHOLDS.CRAMPED_MAX + 1);
    expect(surplus).toBeGreaterThan(0);
    paint(G, 'green', attachCells(G, 'blue').slice(0, surplus)); // green takes the surplus corners
    expect(attachPoints(G, 'blue')).toBe(EVENT_THRESHOLDS.CRAMPED_MAX + 1);
    return G;
  };

  it('fires on the crossing below the threshold', () => {
    const prev = onTheEdge();
    const cur = clone(prev);
    play(cur, 'red', attachCells(prev, 'blue').slice(0, 1)); // one corner gone: over the bar

    const events = detectEvents(prev, cur);
    expect(events.map((e) => e.kind)).toEqual(['cramped']);
    expect(events[0]).toMatchObject({ color: 'blue' });
    expect(events[0].text).toBe('Blue is running out of room');
  });

  it('does not re-fire while the color stays cramped', () => {
    const start = onTheEdge();
    const corners = attachCells(start, 'blue');
    const prev = clone(start);
    play(prev, 'red', [corners[0]]); // already below the bar
    const cur = clone(prev);
    play(cur, 'red', [corners[1]]); // squeezed further, but no new crossing

    expect(detectEvents(prev, cur)).toEqual([]);
  });

  it('stays quiet for a color that never started', () => {
    const prev = createInitialState(4, 'basic');
    const cur = clone(prev);
    play(cur, 'red', [{ x: 15, y: 15 }]);

    expect(detectEvents(prev, cur)).toEqual([]);
  });
});

describe('detectEvents — endgame', () => {
  const withHands = (counts: Record<Color, number>): GameState => {
    const G = createInitialState(4, 'basic');
    for (const c of COLOR_ORDER) G.colors[c].remaining = G.colors[c].remaining.slice(0, counts[c]);
    return G;
  };

  it('fires once, when the last live color runs its hand down', () => {
    const n = EVENT_THRESHOLDS.ENDGAME_PIECES_LEFT;
    const prev = withHands({ blue: n + 1, yellow: n, red: n, green: 12 });
    prev.colors.green.stuck = true; // out of the game — its fat hand doesn't count

    const cur = clone(prev);
    cur.colors.blue.remaining = cur.colors.blue.remaining.slice(0, n);

    const events = detectEvents(prev, cur);
    expect(events.map((e) => e.kind)).toEqual(['endgame']);
    expect(events[0].color).toBeNull();
    expect(events[0].text).toBe('Final rounds');

    const later = clone(cur);
    later.colors.red.remaining = later.colors.red.remaining.slice(0, n - 1);
    expect(detectEvents(cur, later)).toEqual([]); // the crossing already happened
  });

  it('stays quiet once every color is stuck — that moment belongs to the reveal', () => {
    const prev = withHands({ blue: 6, yellow: 6, red: 6, green: 6 });
    const cur = clone(prev);
    for (const c of COLOR_ORDER) cur.colors[c].stuck = true;

    expect(detectEvents(prev, cur).some((e) => e.kind === 'endgame')).toBe(false);
  });
});

describe('detectEvents — contract', () => {
  it('reports nothing when nothing changed', () => {
    const G = createInitialState(4, 'basic');
    paint(G, 'blue', staircase(2, 2));
    expect(detectEvents(G, G)).toEqual([]);
  });

  it('only ever emits registered ids', () => {
    const prev = createInitialState(4, 'basic');
    paint(prev, 'blue', staircase(2, 2));
    const cur = clone(prev);
    play(cur, 'red', attachCells(prev, 'blue').slice(0, 3));
    cur.colors.yellow.stuck = true;

    const kinds = detectEvents(prev, cur).map((e) => e.kind);
    expect(kinds.length).toBeGreaterThan(0);
    for (const k of kinds) expect(EVENT_IDS).toContain(k);
  });
});

describe('attachCells', () => {
  it('returns exactly the cells attachPoints counts', () => {
    const G = createInitialState(4, 'basic');
    expect(attachCells(G, 'blue')).toEqual([{ x: 0, y: 0 }]); // pre-start: the assigned corner

    paint(G, 'blue', staircase(2, 2));
    paint(G, 'red', [{ x: 15, y: 15 }, { x: 16, y: 16 }]);
    paint(G, 'green', staircase(8, 8));
    for (const c of COLOR_ORDER) {
      const cells = attachCells(G, c);
      expect(cells.length).toBe(attachPoints(G, c));
      for (const cell of cells) expect(G.board[cell.y * 20 + cell.x]).toBeNull();
    }
  });
});
