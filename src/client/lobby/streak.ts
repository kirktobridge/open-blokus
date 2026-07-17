import { dailyDateKey } from '../../game/puzzle/daily';

/**
 * Daily-puzzle streak (P35 (d)). Pure calendar math over `YYYY-MM-DD` keys —
 * the localStorage wrapper lives in config.ts, mirroring the puzzle-seen split.
 * "Streak" = consecutive local calendar days the puzzle was completed; a gap of
 * a whole day breaks it. Keeping the fold pure makes the day-boundary logic
 * (month/year rollover) unit-testable without touching storage or the clock.
 */

export interface PuzzleStreak {
  /** Last day (`YYYY-MM-DD`) a completion was folded in, or null if never. */
  last: string | null;
  /** Length of the run ending on `last`. */
  count: number;
}

export function emptyStreak(): PuzzleStreak {
  return { last: null, count: 0 };
}

/** The `YYYY-MM-DD` for the calendar day before `key` (handles month/year rollover). */
export function prevDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  // Local Date, mirroring dailyDateKey — day 0 / negative rolls into the prior month.
  return dailyDateKey(new Date(y, m - 1, d - 1));
}

/**
 * Fold one completion on `today` into the streak. Idempotent per day (a second
 * completion the same day is a no-op); a completion the day after `last` extends
 * the run, any larger gap restarts it at 1.
 */
export function foldCompletion(prev: PuzzleStreak, today: string): PuzzleStreak {
  if (prev.last === today) return prev;
  const extends_ = prev.last != null && prevDayKey(today) === prev.last;
  return { last: today, count: extends_ ? prev.count + 1 : 1 };
}

/**
 * The streak still "alive" as of `today`: the stored count when the last
 * completion was today or yesterday (today's puzzle simply isn't done yet), else
 * 0 — an older last completion means the run already lapsed.
 */
export function liveStreak(s: PuzzleStreak, today: string): number {
  if (s.last == null) return 0;
  if (s.last === today || prevDayKey(today) === s.last) return s.count;
  return 0;
}
