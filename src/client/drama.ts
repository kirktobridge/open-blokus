import type { Color, ColorState, GameState } from '../game/types';
import { COLOR_ORDER, PIECE_IDS } from '../game/types';
import { pieceSize } from '../game/pieces';
import { remainingSquares } from '../game/scoring';
import type { GameOverPayload } from './controls/GameOverModal';

/**
 * In-game drama (P16): pure helpers for the placement/endgame/win ceremony.
 * These sit above the rules core (they read `GameState`) but stay UI-agnostic
 * and side-effect-free so they're unit-testable and reusable by P7 (sound),
 * which hooks the same events.
 */

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/**
 * Total squares across all 21 pieces (89) — the ceiling for board coverage.
 * Derived from the canonical piece table so it can't drift from the rules.
 */
export const TOTAL_SQUARES = PIECE_IDS.reduce((s, p) => s + pieceSize(p), 0);

/** Squares a color has placed so far — the "how much board did you claim" metric. */
export function placedSquares(cs: ColorState): number {
  return TOTAL_SQUARES - remainingSquares(cs);
}

/**
 * Colors that transitioned from having moves to stuck between two states — the
 * trigger for the "X is out of moves" beat. Empty when nothing changed.
 */
export function newlyStuckColors(prev: GameState, cur: GameState): Color[] {
  return COLOR_ORDER.filter((c) => !prev.colors[c].stuck && cur.colors[c].stuck);
}

/** Human-readable "X is out of moves" beat text for a color. */
export function outOfMovesText(color: Color): string {
  return `${cap(color)} is out of moves`;
}

/** One row in the game-over reveal: color, official score, board coverage. */
export interface RevealRow {
  color: Color;
  score: number;
  placed: number;
  isWinner: boolean;
}

/**
 * Reveal rows sorted for drama: winners first, then by board coverage desc.
 * Score is the official per-color score (variant-aware); `placed` drives the
 * racing bar so "more = better" reads consistently regardless of scoring mode.
 */
export function revealRows(G: GameState, gameover: GameOverPayload): RevealRow[] {
  const winnerColors = new Set(
    COLOR_ORDER.filter((c) => {
      const owner = G.config.owners[c];
      return owner !== 'shared' && gameover.winners.includes(owner);
    }),
  );
  return COLOR_ORDER.map((color) => ({
    color,
    score: gameover.colors[color],
    placed: placedSquares(G.colors[color]),
    isWinner: winnerColors.has(color),
  })).sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return b.placed - a.placed;
  });
}

/** Compact, copy-pasteable result summary for sharing the outcome as text. */
export function resultSummary(G: GameState, gameover: GameOverPayload): string {
  const rows = revealRows(G, gameover);
  const winners = rows.filter((r) => r.isWinner).map((r) => cap(r.color));
  const head =
    winners.length === 0
      ? 'OpenBlokus — game over'
      : `OpenBlokus — ${winners.join(' & ')} win${winners.length > 1 ? '' : 's'}`;
  const scores = rows.map((r) => `${cap(r.color)} ${r.score}`).join(' · ');
  return `${head}\n${scores}`;
}
