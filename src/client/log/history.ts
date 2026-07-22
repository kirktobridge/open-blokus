/**
 * Browsable game history (product P15 M2). The dev sink next door writes finished
 * games to disk through a same-origin endpoint that only exists under the dev
 * server — great for grepping a log, useless to a player on a built app. This is
 * the player-facing half: the same `GameRecord`, stored compactly in localStorage,
 * newest first, capped.
 *
 * Stored in the serialized (move-tuple) form so a full history costs a few KB
 * rather than a few hundred, and so anything already able to read a record — the
 * review table, the replay tooling — can read these too. Corrupt entries are
 * dropped on read: a history list is not worth an exception on the stats screen.
 */
import {
  deserializeRecord,
  serializeRecord,
  type GameRecord,
  type SerializedRecord,
} from '../../game/ai/selfplay';
import type { ByColor, Color } from '../../game/types';
import { VARIANTS } from '../../game/modes';

const KEY = 'openblokus.gameHistory';

/** How many games to keep. Twenty is a browsable list, not an archive. */
export const HISTORY_CAP = 20;

interface StoredGame {
  /** Wall-clock ms the game was recorded. Also its identity in the list. */
  at: number;
  rec: SerializedRecord;
}

/** One past game, ready to list or replay. */
export interface HistoryGame {
  id: string;
  at: number;
  record: GameRecord;
}

function read(): StoredGame[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as StoredGame[]) : [];
  } catch {
    return [];
  }
}

/** Newest first, unreadable entries skipped. */
export function loadHistory(): HistoryGame[] {
  const out: HistoryGame[] = [];
  for (const g of read()) {
    try {
      out.push({ id: String(g.at), at: g.at, record: deserializeRecord(g.rec) });
    } catch {
      // A record from an older/broken format shouldn't cost you the whole list.
    }
  }
  return out;
}

/** Add a finished game, evicting the oldest past the cap. */
export function saveToHistory(record: GameRecord): void {
  const entry: StoredGame = {
    at: record.meta?.endedAt ?? Date.now(),
    rec: serializeRecord(record),
  };
  const next = [entry, ...read()].slice(0, HISTORY_CAP);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — the game is still logged to the dev sink,
    // and the next save will try again. Never let this break game-over.
  }
}

export function clearHistory(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // nothing to do
  }
}

export type Outcome = 'won' | 'lost' | 'watched';

/** What a history row says about a game. */
export interface HistorySummary {
  outcome: Outcome;
  /** Your total across the colors you owned; null when you weren't playing. */
  yourScore: number | null;
  /**
   * What that number counts, which flips with the scoring variant: under `basic`
   * it's squares still in your tray and lower is better, under `advanced` it's
   * points and higher is better (GAME_SPEC §6). A bare number next to "LOST"
   * reads as points earned either way, so the unit has to travel with it.
   */
  scoreUnit: 'left' | 'pts';
  /** Who you played, e.g. "vs 3 easy" / "vs easy, hard" / "4 bots". */
  lineup: string;
  moves: number;
}

/** The colors a seat label owns — 'human' can hold two of them in a 2p game. */
const colorsLabelled = (
  seats: ByColor<string>,
  play: readonly Color[],
  label: string,
): Color[] => play.filter((c) => seats[c] === label);

export function summarize({ record }: HistoryGame): HistorySummary {
  // Seats are keyed by the record's *own* colors — filtering COLOR_ORDER would
  // find no human in a Duo game and summarize every one of them as `watched`.
  const play = VARIANTS[record.variant].playColors;
  const yours = colorsLabelled(record.seats, play, 'human');
  // Bot tiers, in seat order. 'shared' is the 3p rotating color — nobody's seat,
  // so it names no opponent.
  const tiers = play
    .filter((c) => record.seats[c] !== 'human' && record.seats[c] !== 'shared')
    .map((c) => record.seats[c] ?? '');
  const uniform = tiers.length > 1 && tiers.every((t) => t === tiers[0]);

  return {
    outcome:
      yours.length === 0 ? 'watched' : yours.some((c) => record.winners.includes(c)) ? 'won' : 'lost',
    yourScore:
      yours.length === 0 ? null : yours.reduce((sum, c) => sum + (record.scores[c] ?? 0), 0),
    scoreUnit: record.scoring === 'basic' ? 'left' : 'pts',
    lineup:
      tiers.length === 0
        ? 'no bots'
        : yours.length === 0
          ? `${tiers.length} bots`
          : `vs ${uniform ? `${tiers.length} ${tiers[0]}` : tiers.join(', ')}`,
    moves: record.moves.length,
  };
}
