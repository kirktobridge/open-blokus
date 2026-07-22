import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { BlokusGame } from '../src/bgio/BlokusGame';
import { validateSetupData } from '../src/bgio/setup';
import { DUO_START_CELLS, VARIANTS, colorStateOf, createInitialState, playColorsOf, startCellOf } from '../src/game/modes';
import { resolveCells } from '../src/game/pieces';
import { isLegalPlacement, applyPlacement } from '../src/game/placement';
import { generateLegalMoves } from '../src/game/moves';
import { buildBitBoards, bbLegal } from '../src/game/bitboard';
import { finalScores, scoreColor } from '../src/game/scoring';
import { COLOR_ORDER, PIECE_IDS, type Color } from '../src/game/types';

const duo = () => createInitialState(2, 'advanced', 'duo');

/** `color` may legally place `pieceId` (unrotated, unreflected) with origin at (x,y). */
const canPlace = (
  G: ReturnType<typeof duo>,
  color: Color,
  pieceId: (typeof PIECE_IDS)[number],
  x: number,
  y: number,
): boolean => {
  const p = { pieceId, rotation: 0, reflected: false, x, y } as const;
  return isLegalPlacement(G, color, pieceId, resolveCells(p));
};

describe('Duo start cells (GAME_SPEC_DUO §3)', () => {
  // D5 — the invariant that guards the coordinate convention. Both the main
  // diagonal (4,4)/(9,9) and the anti-diagonal (4,9)/(9,4) are 180°-symmetric, so
  // this pins the pair itself, not just the symmetry.
  it('D5: the start-cell pair is 180°-symmetric about the board centre', () => {
    const black = DUO_START_CELLS.black!;
    const white = DUO_START_CELLS.white!;
    const max = VARIANTS.duo.boardSize - 1;
    expect(black.x + white.x).toBe(max);
    expect(black.y + white.y).toBe(max);
  });

  it('D5: the pair sits on the main diagonal, not the anti-diagonal', () => {
    // The FWG43 diagram puts the dots upper-left and lower-right. Misreading the
    // retail "5,10 / 10,5" notation as top-origin (x,y) yields the anti-diagonal.
    expect(DUO_START_CELLS.black).toEqual({ x: 4, y: 4 });
    expect(DUO_START_CELLS.white).toEqual({ x: 9, y: 9 });
  });

  it('start cells are interior — neither is a board corner', () => {
    const max = VARIANTS.duo.boardSize - 1;
    for (const cell of [DUO_START_CELLS.black!, DUO_START_CELLS.white!]) {
      expect([0, max]).not.toContain(cell.x);
      expect([0, max]).not.toContain(cell.y);
    }
  });
});

describe('Duo first move (GAME_SPEC_DUO §3, §6)', () => {
  it('D1: black may not open on a board corner', () => {
    expect(canPlace(duo(), 'black', 'I1', 0, 0)).toBe(false);
  });

  it('D2: black opens by covering its own start cell (4,4)', () => {
    expect(canPlace(duo(), 'black', 'I1', 4, 4)).toBe(true);
  });

  it('D3: white may not open on black’s start cell', () => {
    const G = duo();
    expect(canPlace(G, 'white', 'I1', 4, 4)).toBe(false);
    expect(canPlace(G, 'white', 'I1', 9, 9)).toBe(true);
  });

  it('every first move enumerated for a color covers that color’s own start cell', () => {
    const G = duo();
    for (const color of playColorsOf(G)) {
      const start = startCellOf(G, color);
      const moves = generateLegalMoves(G, color);
      expect(moves.length).toBeGreaterThan(0);
      for (const m of moves) {
        expect(resolveCells(m).some((c) => c.x === start.x && c.y === start.y)).toBe(true);
      }
    }
  });
});

describe('Duo board (GAME_SPEC_DUO §1, §2, §6)', () => {
  it('D4: nothing may be placed at x = 14 or y = 14', () => {
    const G = duo();
    // Reach the right/bottom edge from the start cell so only bounds can reject it.
    expect(canPlace(G, 'black', 'I1', 14, 4)).toBe(false);
    expect(canPlace(G, 'black', 'I1', 4, 14)).toBe(false);
    // The last in-bounds column/row is 13.
    applyPlacement(G, 'black', 'I1', resolveCells({ pieceId: 'I1', rotation: 0, reflected: false, x: 4, y: 4 }));
    expect(G.board.length).toBe(14 * 14);
  });

  it('is 14×14 with only black and white in play', () => {
    const G = duo();
    expect(G.board).toHaveLength(196);
    expect(playColorsOf(G)).toEqual(['black', 'white']);
    // The Classic colors are absent from the game, not merely unowned (§5).
    for (const c of COLOR_ORDER) {
      expect(G.colors[c]).toBeUndefined();
      expect(G.config.owners[c]).toBeUndefined();
      expect(() => colorStateOf(G, c)).toThrow();
    }
  });

  it('bitboards agree with isLegalPlacement on the 14×14 board', () => {
    // The differential that guarded M2a's size generalization, re-run for Duo:
    // a stale 20-wide mask would let an out-of-bounds cell read as legal.
    const G = duo();
    applyPlacement(G, 'black', 'V5', resolveCells({ pieceId: 'V5', rotation: 0, reflected: false, x: 4, y: 4 }));
    const bb = buildBitBoards(G);
    for (const color of playColorsOf(G)) {
      const cs = colorStateOf(G, color);
      for (const m of generateLegalMoves(G, color)) {
        const cells = resolveCells(m);
        expect(bbLegal(bb, color, cells, cs.hasStarted, startCellOf(G, color))).toBe(
          isLegalPlacement(G, color, m.pieceId, cells),
        );
      }
    }
  });
});

describe('Duo scoring and seats (GAME_SPEC_DUO §4, §5)', () => {
  it('forces advanced scoring even when the lobby asked for basic', () => {
    expect(createInitialState(2, 'basic', 'duo').config.scoring).toBe('advanced');
  });

  it('scores a completed hand with the all-placed and monomino-last bonuses', () => {
    const G = duo();
    const black = colorStateOf(G, 'black');
    black.remaining = [];
    black.lastPlaced = 'I1';
    expect(scoreColor(G, 'black')).toBe(20);
    // White still holds everything: −89 under advanced scoring.
    expect(scoreColor(G, 'white')).toBe(-89);
    expect(finalScores(G).winners).toEqual(['0']);
  });

  it('seats black as player 0 and white as player 1, black to move first', () => {
    const G = duo();
    expect(G.config.owners).toEqual({ black: '0', white: '1' });
    expect(playColorsOf(G)[G.activeColorIndex]).toBe('black');
  });

  it('rejects a 3- or 4-player Duo match at setup', () => {
    expect(validateSetupData({ mode: 4, scoring: 'advanced', variant: 'duo' }, 4)).toMatch(/duo/);
    expect(validateSetupData({ mode: 2, scoring: 'advanced', variant: 'duo' }, 2)).toBeUndefined();
    expect(() => createInitialState(4, 'advanced', 'duo')).toThrow();
  });
});

describe('Duo plays through the engine', () => {
  it('runs a full game to game-over with alternating turns', () => {
    const client = Client({
      game: {
        ...BlokusGame,
        setup: () => createInitialState(2, 'advanced', 'duo'),
      },
      numPlayers: 2,
    });
    client.start();

    let guard = 0;
    while (!client.getState()!.ctx.gameover && guard++ < 100) {
      const { G } = client.getState()!;
      const color = playColorsOf(G)[G.activeColorIndex];
      const moves = generateLegalMoves(G, color);
      expect(moves.length).toBeGreaterThan(0);
      client.moves.placePiece(moves[0]);
    }

    const over = client.getState()!.ctx.gameover as ReturnType<typeof finalScores>;
    expect(over).toBeDefined();
    expect(Object.keys(over.colors).sort()).toEqual(['black', 'white']);
    expect(over.winners.length).toBeGreaterThan(0);
    client.stop();
  });
});
