/**
 * Duo guard for the AI layer (P54).
 *
 * The failure mode this exists to catch is *silent*: code that assumes a 20×20
 * board or a four-color playing set stays green through vitest, typecheck and
 * lint while indexing past the end of a 196-cell board (`undefined !== null`, so
 * out-of-range cells read as occupied) or scoring absent colors as beaten. None
 * of that throws, so only an explicit Duo assertion sees it.
 */
import { describe, it, expect } from 'vitest';
import { createInitialState, startCellOf } from '../src/game/modes';
import { DUO_COLOR_ORDER } from '../src/game/types';
import type { Cell, Color, GameState } from '../src/game/types';
import { resolveCells } from '../src/game/pieces';
import { applyPlacement } from '../src/game/placement';
import { generateLegalMoves } from '../src/game/moves';
import { chooseMove } from '../src/game/ai/heuristic';
import { mctsSearch } from '../src/game/ai/mcts';
import { detectEvents, thresholdsFor, EVENT_THRESHOLDS } from '../src/client/drama';
import { playGame, runTournament, mulberry32, randomStrategy, heuristicStrategy } from '../src/game/ai/arena';

const DUO_CELLS = 14 * 14;

const duoState = (): GameState => createInitialState(2, 'advanced', 'duo');

/**
 * Wrap `G.board` so any numeric index outside the Duo board throws instead of
 * quietly returning `undefined`. This is the whole point of the file: it turns
 * the silent corruption into a test failure.
 */
function trapOutOfRange(G: GameState): { G: GameState; reads: () => number[] } {
  const bad: number[] = [];
  const board = new Proxy(G.board, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const i = Number(prop);
        if (i >= DUO_CELLS) bad.push(i);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return { G: { ...G, board }, reads: () => bad };
}

const inBoundsCell = (c: Cell) => c.x >= 0 && c.x < 14 && c.y >= 0 && c.y < 14;

describe('heuristic on a Duo board', () => {
  it('never reads a cell past the 196th', () => {
    const { G, reads } = trapOutOfRange(duoState());
    const move = chooseMove(G, 'black', mulberry32(1));
    expect(move).not.toBeNull();
    expect(reads()).toEqual([]);
  });

  it('opens on the interior start cell, not a corner', () => {
    const G = duoState();
    for (const color of DUO_COLOR_ORDER) {
      const move = chooseMove(G, color, mulberry32(5));
      expect(move).not.toBeNull();
      const cells = resolveCells(move!);
      expect(cells.every(inBoundsCell)).toBe(true);
      // GAME_SPEC_DUO §3: black (4,4), white (9,9) — never (0,0).
      expect(cells).toContainEqual(startCellOf(G, color));
    }
  });
});

describe('MCTS on a Duo board', () => {
  it('returns a legal opening move covering the start cell', () => {
    const G = duoState();
    const { move } = mctsSearch(G, 'black', mulberry32(3), { iterations: 30, rolloutDepth: 4 });
    expect(move).not.toBeNull();
    const cells = resolveCells(move!);
    expect(cells.every(inBoundsCell)).toBe(true);
    expect(cells).toContainEqual(startCellOf(G, 'black'));
  });

  it('stays in bounds mid-game, after both colors have opened', () => {
    const G = duoState();
    const rng = mulberry32(11);
    for (let ply = 0; ply < 6; ply++) {
      const color = DUO_COLOR_ORDER[ply % DUO_COLOR_ORDER.length];
      const moves = generateLegalMoves(G, color);
      const m = moves[Math.floor(rng() * moves.length)];
      applyPlacement(G, color, m.pieceId, resolveCells(m));
    }
    const { move } = mctsSearch(G, 'white', mulberry32(4), { iterations: 30, rolloutDepth: 4 });
    expect(move).not.toBeNull();
    expect(resolveCells(move!).every(inBoundsCell)).toBe(true);
  });
});

describe('drama thresholds on Duo', () => {
  it('applies the Duo cut bar, and only to Duo', () => {
    expect(thresholdsFor(duoState()).CUT_MIN_LOSS).toBe(3);
    expect(thresholdsFor(createInitialState(4)).CUT_MIN_LOSS).toBe(2);
    // Everything not listed as a delta stays at the Classic value.
    expect(thresholdsFor(duoState()).CRAMPED_MAX).toBe(EVENT_THRESHOLDS.CRAMPED_MAX);
  });

  it('keeps cuts from chattering across a real Duo game', () => {
    // At the Classic bar this measured 7.4 cuts/game in games half Classic's
    // length (P54); the Duo bar brings it to ~2.7. The band below fails if the
    // delta is dropped, without pinning an exact count.
    const G = duoState();
    const rng = mulberry32(9);
    let cuts = 0;
    let live = DUO_COLOR_ORDER.length;
    while (live > 0) {
      const color = DUO_COLOR_ORDER[G.activeColorIndex];
      const move = chooseMove(G, color, rng);
      if (!move) {
        G.colors[color]!.stuck = true;
        live--;
      } else {
        const prev = structuredClone(G);
        applyPlacement(G, color, move.pieceId, resolveCells(move));
        cuts += detectEvents(prev, G).filter((e) => e.kind === 'cut').length;
      }
      for (let step = 1; step <= DUO_COLOR_ORDER.length; step++) {
        const i = (G.activeColorIndex + step) % DUO_COLOR_ORDER.length;
        if (!G.colors[DUO_COLOR_ORDER[i]]!.stuck) {
          G.activeColorIndex = i;
          break;
        }
      }
    }
    expect(cuts).toBeGreaterThan(0); // the verb still speaks…
    expect(cuts).toBeLessThanOrEqual(5); // …without chattering
  });
});

describe('arena on Duo', () => {
  it('plays a full 2-color game to a terminal state', () => {
    const played: Cell[] = [];
    const byColor = Object.fromEntries(
      DUO_COLOR_ORDER.map((c) => [c, randomStrategy]),
    ) as Record<Color, typeof randomStrategy>;
    const result = playGame(byColor, {
      variant: 'duo',
      rng: mulberry32(7),
      onMove: (_c, m) => played.push(...resolveCells(m)),
    });

    // Exactly the variant's colors are scored — a Classic walk would report four.
    expect(Object.keys(result.colors).sort()).toEqual([...DUO_COLOR_ORDER].sort());
    expect(result.winners.length).toBeGreaterThanOrEqual(1);
    // Duo seats one color per player (GAME_SPEC_DUO §5).
    for (const w of result.winners) expect(['0', '1']).toContain(w);
    // Every square placed over the whole game sits on the 14×14 board.
    expect(played.every(inBoundsCell)).toBe(true);
    expect(played.length).toBeGreaterThan(20);
  });

  it('forces advanced scoring, so placed squares are recovered from the score', () => {
    const r = runTournament(
      [
        { name: 'heuristic', strategy: heuristicStrategy() },
        { name: 'random', strategy: randomStrategy },
      ],
      { games: 6, variant: 'duo', seed: 2 },
    );
    // Recovered placed-square counts must land in [0, 89] — reading an advanced
    // score as if it were a remaining-square count puts them outside it.
    for (const name of Object.keys(r.placedSquares)) {
      const mean = r.placedSquares[name] / r.played[name];
      expect(mean).toBeGreaterThan(0);
      expect(mean).toBeLessThanOrEqual(89);
    }
    // Ranking agrees with the winner order: the better name wins more.
    expect(r.wins.heuristic).toBeGreaterThan(r.wins.random);
    expect(r.placement.heuristic).toBeLessThan(r.placement.random);
  });

  it('seats exactly the variant’s color count', () => {
    const four = [
      { name: 'a', strategy: randomStrategy },
      { name: 'b', strategy: randomStrategy },
      { name: 'c', strategy: randomStrategy },
      { name: 'd', strategy: randomStrategy },
    ];
    expect(() => runTournament(four, { games: 1, variant: 'duo' })).toThrow(/need 2 contestants/);
    expect(() => runTournament(four.slice(0, 2), { games: 1 })).toThrow(/need 4 contestants/);
  });

  it('is deterministic for a fixed seed', () => {
    const make = () => [
      { name: 'heuristic', strategy: heuristicStrategy() },
      { name: 'random', strategy: randomStrategy },
    ];
    const a = runTournament(make(), { games: 6, variant: 'duo', seed: 42 });
    const b = runTournament(make(), { games: 6, variant: 'duo', seed: 42 });
    expect(a).toEqual(b);
  });
});
