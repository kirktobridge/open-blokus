import type { Game, Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { GAME_NAME } from '../shared/constants';
import { COLOR_ORDER } from '../game/types';
import type { GameState, Placement } from '../game/types';
import { resolveCells } from '../game/pieces';
import { isLegalPlacement, applyPlacement } from '../game/placement';
import { hasAnyMove } from '../game/moves';
import { finalScores } from '../game/scoring';
import { setup, validateSetupData } from './setup';
import { resolveOwner, seatPos } from './turnOrder';

/**
 * Advance activeColorIndex to the next color that still has a legal move
 * (auto-skip stuck colors). If every color is stuck it is left unchanged and
 * endIf ends the game. Doing this in the move keeps turn advancement
 * deterministic and synchronous (vs. skipping inside turn.onBegin).
 */
function advanceActiveColor(G: GameState): void {
  for (let step = 1; step <= COLOR_ORDER.length; step++) {
    const idx = (G.activeColorIndex + step) % COLOR_ORDER.length;
    if (!G.colors[COLOR_ORDER[idx]].stuck) {
      G.activeColorIndex = idx;
      return;
    }
  }
}

/**
 * Place a piece for the active color. Clients send (pieceId, rotation, reflected,
 * x, y); the engine recomputes the absolute cells, so shapes can't be faked.
 */
const placePiece: Move<GameState> = ({ G, ctx, playerID }, placement: Placement) => {
  const color = COLOR_ORDER[G.activeColorIndex];

  // Authorization: only the human owning the active color may move it.
  if (playerID != null && playerID !== resolveOwner(G)) return INVALID_MOVE;

  const cells = resolveCells(placement);
  if (!isLegalPlacement(G, color, placement.pieceId, cells)) return INVALID_MOVE;

  applyPlacement(G, color, placement.pieceId, cells);

  // Recompute stuck status for every color (the board only ever fills further).
  for (const c of COLOR_ORDER) G.colors[c].stuck = !hasAnyMove(G, c);

  // Advance the shared-color rotation only on an actual placement (GAME_SPEC §9).
  if (G.config.owners[color] === 'shared') {
    G.sharedRotation = (G.sharedRotation + 1) % ctx.numPlayers;
  }

  advanceActiveColor(G);
};

export const BlokusGame: Game<GameState> = {
  name: GAME_NAME,
  setup,
  validateSetupData,

  moves: { placePiece },

  turn: {
    minMoves: 1,
    maxMoves: 1,
    // currentPlayer follows the active color's owner; the active color is kept on
    // a non-stuck color by the move's advanceActiveColor.
    order: {
      first: ({ G }) => seatPos(G, G.activeColorIndex),
      next: ({ G }) => seatPos(G, G.activeColorIndex),
    },
  },

  endIf: ({ G }) =>
    COLOR_ORDER.every((c) => G.colors[c].stuck) ? finalScores(G) : undefined,

  disableUndo: true,
  minPlayers: 2,
  maxPlayers: 4,
};
