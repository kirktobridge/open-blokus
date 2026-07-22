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
import { boardSizeOf } from './modes';
import type { Color, GameState } from './types';

/**
 * Square glyph per color; empty cells render as a white square. Duo's black and
 * white take the black/white squares — the one place in the app where those two
 * colors already have an exact, theme-free rendering.
 */
export const COLOR_EMOJI: Record<Color, string> = {
  blue: '🟦',
  yellow: '🟨',
  red: '🟥',
  green: '🟩',
  black: '⬛',
  white: '⬜',
};

/**
 * Glyph for an unplayed cell. Duo's `white` piece takes the same square, so a Duo
 * share uses the dotted variant for empty to keep the two readable apart.
 */
export const EMPTY_EMOJI = '⬜';
const EMPTY_EMOJI_DUO = '🔲';

/**
 * The full board as emoji squares, one line per row, top row first — 20 wide for
 * Classic, 14 for Duo.
 *
 * Full fidelity rather than a downscaled block grid: at 20 glyphs a row it still
 * fits a typical chat column, and downscaling would blur exactly the thing worth
 * sharing (who owned which corner). Revisit if it wraps badly where people paste.
 */
export function emojiBoard(G: GameState): string {
  const size = boardSizeOf(G);
  // `white` and the empty glyph would otherwise be the same square in Duo.
  const empty = G.config.playColors?.includes('white') ? EMPTY_EMOJI_DUO : EMPTY_EMOJI;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const cell = G.board[y * size + x];
      row += cell === null ? empty : COLOR_EMOJI[cell];
    }
    rows.push(row);
  }
  return rows.join('\n');
}
