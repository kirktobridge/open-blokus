/**
 * Shared state-transition helpers for search/simulation strategies (alpha-beta,
 * MCTS). All produce or advance a cloned GameState so the live game state is
 * never mutated. Kept in one place so the two strategies can't drift.
 */
import { resolveCells } from '../pieces';
import { applyPlacement } from '../placement';
import { hasAnyMove } from '../moves';
import { COLOR_ORDER } from '../types';
import type { Color, ColorState, GameState, Placement } from '../types';

function cloneColorState(cs: ColorState): ColorState {
  return {
    remaining: cs.remaining.slice(),
    lastPlaced: cs.lastPlaced,
    hasStarted: cs.hasStarted,
    stuck: cs.stuck,
  };
}

/** Deep-enough clone: board + per-color state are copied; immutable config shared. */
export function cloneState(G: GameState): GameState {
  const colors = {} as Record<Color, ColorState>;
  for (const c of COLOR_ORDER) colors[c] = cloneColorState(G.colors[c]);
  return {
    config: G.config, // immutable — safe to share
    board: G.board.slice(),
    colors,
    activeColorIndex: G.activeColorIndex,
    sharedRotation: G.sharedRotation,
    lastMove: [],
  };
}

/** Recompute every color's `stuck` flag (the board only ever fills further). */
export function recomputeStuck(G: GameState): void {
  for (const c of COLOR_ORDER) G.colors[c].stuck = !hasAnyMove(G, c);
}

/** Index of the next non-stuck color after `from` (auto-skips stuck colors). */
export function nextColorIndex(G: GameState, from: number): number {
  for (let step = 1; step <= COLOR_ORDER.length; step++) {
    const i = (from + step) % COLOR_ORDER.length;
    if (!G.colors[COLOR_ORDER[i]].stuck) return i;
  }
  return from;
}

/**
 * Clone `G`, apply `move` for the color at `colorIdx`, recompute stuck flags, and
 * advance the active color to the next non-stuck one. Mirrors BlokusGame's
 * placePiece transition (minus the shared-rotation bookkeeping, which doesn't
 * affect search).
 */
export function applyAndAdvance(G: GameState, colorIdx: number, move: Placement): GameState {
  const G2 = cloneState(G);
  const color = COLOR_ORDER[colorIdx];
  applyPlacement(G2, color, move.pieceId, resolveCells(move));
  recomputeStuck(G2);
  G2.activeColorIndex = nextColorIndex(G2, colorIdx);
  return G2;
}
