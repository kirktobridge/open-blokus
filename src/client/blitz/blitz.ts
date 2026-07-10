import type { Color, GameState, Placement } from '../../game/types';
import { generateLegalMoves } from '../../game/moves';

/**
 * Per-move time limit in seconds, or null for untimed (classic) play.
 *
 * Blitz is a *client* mode: it times a human seat's turn and, on expiry, plays a
 * move for them. It deliberately never touches the rules core — there is no pass
 * move in Blokus (GAME_SPEC §5), so "running out of time" cannot skip a color that
 * still has legal placements. Expiry therefore forfeits *choice*, not the turn:
 * a random legal move is played. See docs/product/BACKLOG.md P20 M1.
 */
export type BlitzSeconds = number | null;

/** Selectable limits, in display order. `null` = off (untimed). */
export const BLITZ_OPTIONS: { value: BlitzSeconds; label: string }[] = [
  { value: null, label: 'off' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
];

/** Below this the countdown reads as urgent (styling + `data-urgent`). */
export const BLITZ_URGENT_MS = 3000;

/**
 * The limit actually in force. A `?blitz=<seconds>` query param wins (so e2e can
 * force a 1 s clock regardless of the saved setup), else the caller's setting;
 * `?blitz=0` forces it off. Mirrors resolveBotDelay in LocalAIGame.
 */
export function resolveBlitzSeconds(setting: BlitzSeconds): BlitzSeconds {
  if (typeof window === 'undefined') return setting;
  const q = new URLSearchParams(window.location.search).get('blitz');
  if (q == null || q === '') return setting;
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * A uniformly random legal placement for `color`, or null if it has none (a stuck
 * color the engine is about to auto-skip). `rand` returns [0, 1) — injected so the
 * pick is testable.
 */
export function pickRandomMove(
  G: GameState,
  color: Color,
  rand: () => number = Math.random,
): Placement | null {
  const moves = generateLegalMoves(G, color);
  if (moves.length === 0) return null;
  const i = Math.min(moves.length - 1, Math.floor(rand() * moves.length));
  return moves[i];
}

/** Countdown label, e.g. `4.3`. Tenths so the last seconds visibly move. */
export function formatRemaining(remainingMs: number): string {
  return (Math.max(0, remainingMs) / 1000).toFixed(1);
}
