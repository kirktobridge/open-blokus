/**
 * Shareable board rendering (product P26) — the Wordle-style emoji grid.
 *
 * A finished board is a picture: four colors clawing at each other's corners.
 * Rendering it as emoji squares makes a result paste-able anywhere (chat, social,
 * a commit message) with no image, no link, and no rendering pipeline — it *is*
 * the screenshot. Both share surfaces call this: the vs-AI/multiplayer game-over
 * summary (`resultSummary`) and the daily puzzle (`dailyShareText`).
 *
 * Pure module — lives in the rules core so the puzzle (also core-only) can reach
 * it without importing from `src/client/`.
 */
import { BOARD_SIZE } from '../shared/constants';
import type { Color, GameState } from './types';

/** Square glyph per color; empty cells render as a white square. */
export const COLOR_EMOJI: Record<Color, string> = {
  blue: '🟦',
  yellow: '🟨',
  red: '🟥',
  green: '🟩',
};

/** Glyph for an unplayed cell. */
export const EMPTY_EMOJI = '⬜';

/**
 * The full 20×20 board as emoji squares, one line per row, top row first.
 *
 * Full fidelity rather than a downscaled block grid: at 20 glyphs a row it still
 * fits a typical chat column, and downscaling would blur exactly the thing worth
 * sharing (who owned which corner). Revisit if it wraps badly where people paste.
 */
export function emojiBoard(G: GameState): string {
  const rows: string[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    let row = '';
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = G.board[y * BOARD_SIZE + x];
      row += cell === null ? EMPTY_EMOJI : COLOR_EMOJI[cell];
    }
    rows.push(row);
  }
  return rows.join('\n');
}
