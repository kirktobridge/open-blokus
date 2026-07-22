/**
 * Shared state-transition helpers for search/simulation strategies (alpha-beta,
 * MCTS). All produce or advance a cloned GameState so the live game state is
 * never mutated. Kept in one place so the two strategies can't drift.
 */
import { resolveCells } from '../pieces';
import { applyPlacement } from '../placement';
import { hasAnyMove } from '../moves';
import { colorStateOf, playColorsOf } from '../modes';
import type { ByColor, ColorState, GameState, Placement } from '../types';

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
  const colors: ByColor<ColorState> = {};
  for (const c of playColorsOf(G)) colors[c] = cloneColorState(colorStateOf(G, c));
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
  for (const c of playColorsOf(G)) colorStateOf(G, c).stuck = !hasAnyMove(G, c);
}

/** Index of the next non-stuck color after `from` (auto-skips stuck colors). */
export function nextColorIndex(G: GameState, from: number): number {
  const play = playColorsOf(G);
  for (let step = 1; step <= play.length; step++) {
    const i = (from + step) % play.length;
    if (!colorStateOf(G, play[i]).stuck) return i;
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
  const color = playColorsOf(G)[colorIdx];
  applyPlacement(G2, color, move.pieceId, resolveCells(move));
  recomputeStuck(G2);
  G2.activeColorIndex = nextColorIndex(G2, colorIdx);
  return G2;
}
