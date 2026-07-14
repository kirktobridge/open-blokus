import type { Cell, Color, ColorState, GameState } from '../game/types';
import { COLOR_ORDER, PIECE_IDS } from '../game/types';
import { pieceSize } from '../game/pieces';
import { remainingSquares } from '../game/scoring';
import { attachCells } from '../game/ai/alphabeta';
import { emojiBoard } from '../game/share';
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

// --- Event vocabulary (P32) -------------------------------------------------

/**
 * The game's dramatic verbs. Every id here has a row in `docs/EVENTS.md`
 * (tests/events-registry.test.ts enforces both directions), and consumers —
 * beats today, sound (P7) and recap (P2 R1) next — key off these ids.
 */
export const EVENT_IDS = ['out-of-moves', 'cut', 'cramped', 'endgame'] as const;
export type EventId = (typeof EVENT_IDS)[number];

/**
 * Anti-spam thresholds. Feel-tuned, not research-derived — but they live here and
 * nowhere else, and `docs/EVENTS.md` mirrors these exact values (enforced by test).
 *
 * Calibrated against 20 heuristic self-play games (1436 plies): a single placement
 * can bury at most ~3 of a color's attach points, and a live color's frontier runs
 * ~13 wide, so the bars below land the beats at roughly 2.8 cuts, 1 cramped and 1
 * endgame per game — a vocabulary that speaks without chattering.
 */
export const EVENT_THRESHOLDS = {
  /** A cut needs to bury at least this many attach points… */
  CUT_MIN_LOSS: 2,
  /** …and at least this share of the victim's frontier (so a scratch on a wide-open
   *  color doesn't read as a cut). */
  CUT_MIN_SHARE: 0.15,
  /** At or below this many attach points, a color is boxed in. */
  CRAMPED_MAX: 5,
  /** Endgame framing once every live color is down to this many pieces. */
  ENDGAME_PIECES_LEFT: 5,
} as const;

/** One detected event. `color` is the subject (null for board-wide events). */
export interface DramaEvent {
  kind: EventId;
  color: Color | null;
  text: string;
  /** `cut` only: the victim's attach points the placement destroyed. */
  lostCells?: Cell[];
  /** `cut` only: the color that did the cutting. */
  by?: Color;
}

/** The color that made the placement carried in `G.lastMove`, if any. */
function moverColor(G: GameState): Color | null {
  const first = G.lastMove[0];
  return first === undefined ? null : G.board[first];
}

/** True when `cur.lastMove` describes a different placement than `prev.lastMove`. */
function placedThisUpdate(prev: GameState, cur: GameState): boolean {
  if (cur.lastMove.length === 0) return false;
  if (prev.lastMove.length !== cur.lastMove.length) return true;
  return cur.lastMove.some((c, i) => c !== prev.lastMove[i]);
}

const cellKey = (c: Cell) => c.y * 20 + c.x;

/** Attach points present for `color` in `prev` but gone in `cur`. */
function lostAttachCells(prev: GameState, cur: GameState, color: Color): Cell[] {
  const survives = new Set(attachCells(cur, color).map(cellKey));
  return attachCells(prev, color).filter((c) => !survives.has(cellKey(c)));
}

function crampedText(color: Color): string {
  return `${cap(color)} is running out of room`;
}

function cutText(by: Color, victim: Color): string {
  return `${cap(by)} cut off ${cap(victim)}`;
}

/** Every live color is down to its last few pieces — the "last rounds" crossing. */
function inEndgame(G: GameState): boolean {
  const live = COLOR_ORDER.filter((c) => !G.colors[c].stuck);
  if (live.length === 0) return false; // game's over; that's the reveal's job, not a beat
  return live.every(
    (c) => G.colors[c].remaining.length <= EVENT_THRESHOLDS.ENDGAME_PIECES_LEFT,
  );
}

/**
 * The event detector: pure and stateless over one `prev → cur` step. Events fire on
 * the ply where their condition *becomes* true (crossing transitions, like
 * `newlyStuckColors`), which keeps them replay-safe — P2 R1 can run these same
 * functions over a logged game ply by ply and get the identical beats.
 *
 * Anti-spam is structural, not timer-based: at most one beat per color per ply
 * (priority: out-of-moves > cut > cramped) and at most one cut per placement (the
 * worst-hit victim).
 */
export function detectEvents(prev: GameState, cur: GameState): DramaEvent[] {
  const events: DramaEvent[] = [];
  const spoken = new Set<Color>();

  for (const color of newlyStuckColors(prev, cur)) {
    events.push({ kind: 'out-of-moves', color, text: outOfMovesText(color) });
    spoken.add(color);
  }

  const mover = placedThisUpdate(prev, cur) ? moverColor(cur) : null;
  const frontierBefore = {} as Record<Color, number>;
  const frontierAfter = {} as Record<Color, number>;
  for (const color of COLOR_ORDER) {
    frontierBefore[color] = attachCells(prev, color).length;
    frontierAfter[color] = attachCells(cur, color).length;
  }

  if (mover) {
    let worst: DramaEvent | null = null;
    let worstLoss = 0;
    for (const victim of COLOR_ORDER) {
      if (victim === mover || spoken.has(victim)) continue;
      const before = frontierBefore[victim];
      const lost = before - frontierAfter[victim];
      if (lost < EVENT_THRESHOLDS.CUT_MIN_LOSS) continue;
      if (lost < EVENT_THRESHOLDS.CUT_MIN_SHARE * before) continue;
      if (lost <= worstLoss) continue;
      worstLoss = lost;
      worst = {
        kind: 'cut',
        color: victim,
        text: cutText(mover, victim),
        lostCells: lostAttachCells(prev, cur, victim),
        by: mover,
      };
    }
    if (worst?.color) {
      events.push(worst);
      spoken.add(worst.color);
    }
  }

  for (const color of COLOR_ORDER) {
    if (spoken.has(color)) continue;
    const cs = cur.colors[color];
    if (!cs.hasStarted || cs.stuck) continue;
    const crossed =
      frontierBefore[color] > EVENT_THRESHOLDS.CRAMPED_MAX &&
      frontierAfter[color] <= EVENT_THRESHOLDS.CRAMPED_MAX;
    if (!crossed) continue;
    events.push({ kind: 'cramped', color, text: crampedText(color) });
    spoken.add(color);
  }

  if (!inEndgame(prev) && inEndgame(cur)) {
    events.push({ kind: 'endgame', color: null, text: 'Final rounds' });
  }

  return events;
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

/**
 * Compact, copy-pasteable result summary: headline + final scores as caption
 * lines, then the board itself as a Wordle-style emoji grid (P26).
 */
export function resultSummary(G: GameState, gameover: GameOverPayload): string {
  const rows = revealRows(G, gameover);
  const winners = rows.filter((r) => r.isWinner).map((r) => cap(r.color));
  const head =
    winners.length === 0
      ? 'OpenBlokus — game over'
      : `OpenBlokus — ${winners.join(' & ')} win${winners.length > 1 ? '' : 's'}`;
  const scores = rows.map((r) => `${cap(r.color)} ${r.score}`).join(' · ');
  return `${head}\n${scores}\n\n${emojiBoard(G)}`;
}
