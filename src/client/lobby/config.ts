import type { GameMode, Variant } from '../../game/types';
import type { Difficulty } from '../ai/difficulty';
import type { BlitzSeconds } from '../blitz/blitz';
import { dailyDateKey } from '../../game/puzzle/daily';
import { emptyStreak, foldCompletion, liveStreak, type PuzzleStreak } from './streak';

export const SERVER_URL = import.meta.env.VITE_SERVER ?? 'http://localhost:8000';

export const SESSION_KEY = 'obk:session';
export const QUICKPLAY_KEY = 'obk:quickplay';
export const NICK_KEY = 'obk:nick';
export const PUZZLE_SEEN_KEY = 'obk:puzzle-seen';
export const PUZZLE_STREAK_KEY = 'obk:puzzle-streak';
export const TUTORIAL_DONE_KEY = 'obk:tutorial-done';

/** Trimmed cap on a nickname — long enough for a name, short enough for a card. */
export const MAX_NICK_LEN = 16;

export interface Session {
  matchID: string;
  playerID: string;
  credentials: string;
  numPlayers: number;
}

/** Minimal shape of a match as returned by the Lobby API. */
export interface MatchInfo {
  matchID: string;
  players: { id: number; name?: string }[];
  setupData?: { mode?: number; scoring?: string };
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

/** The locally-saved nickname sent when joining online matches (P19). */
export function loadNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveNick(nick: string): void {
  try {
    const trimmed = nick.trim().slice(0, MAX_NICK_LEN);
    if (trimmed) localStorage.setItem(NICK_KEY, trimmed);
    else localStorage.removeItem(NICK_KEY);
  } catch {
    // storage unavailable; the join just falls back to the default seat name
  }
}

/**
 * A seat name is a "real" nickname only if the player chose it — the lobby sends
 * `Player N` as the default so a seat always counts as occupied (MatchList), so
 * the default reads as "anonymous" for display. Reactions/cards suppress it.
 */
export function isRealName(name: string | undefined): name is string {
  return !!name && !/^Player \d+$/.test(name);
}

/** Last-used vs-AI setup, so Quick Play can start it in one click. */
export interface QuickPlayConfig {
  mode: GameMode;
  aiCount: number;
  botDifficulties: Record<string, Difficulty>;
  /** Blitz per-move limit in seconds; null/absent = untimed (P20 M1). */
  blitzSeconds?: BlitzSeconds;
  /** Rule set; absent = Classic (every setup pinned before Duo existed). */
  variant?: Variant;
}

export function loadQuickPlay(): QuickPlayConfig | null {
  try {
    const raw = localStorage.getItem(QUICKPLAY_KEY);
    return raw ? (JSON.parse(raw) as QuickPlayConfig) : null;
  } catch {
    return null;
  }
}

export function saveQuickPlay(cfg: QuickPlayConfig): void {
  try {
    localStorage.setItem(QUICKPLAY_KEY, JSON.stringify(cfg));
  } catch {
    // storage unavailable; Quick Play just falls back to defaults next time
  }
}

/**
 * The last daily-puzzle day the player actually opened (`YYYY-MM-DD`), which is what
 * the front door's "New today" badge is asking about (P29) — the badge is a nudge
 * toward an unseen puzzle, so opening it is enough to spend; finishing isn't required.
 */
export function loadPuzzleSeen(): string | null {
  try {
    return localStorage.getItem(PUZZLE_SEEN_KEY);
  } catch {
    return null;
  }
}

export function savePuzzleSeen(dateKey: string): void {
  try {
    localStorage.setItem(PUZZLE_SEEN_KEY, dateKey);
  } catch {
    // storage unavailable; the badge just keeps showing
  }
}

/** The stored daily-puzzle streak (P35 (d)); empty when never played. */
function loadPuzzleStreakState(): PuzzleStreak {
  try {
    const raw = localStorage.getItem(PUZZLE_STREAK_KEY);
    if (!raw) return emptyStreak();
    const p = JSON.parse(raw) as Partial<PuzzleStreak>;
    return {
      last: typeof p.last === 'string' ? p.last : null,
      count: typeof p.count === 'number' && Number.isFinite(p.count) ? p.count : 0,
    };
  } catch {
    return emptyStreak();
  }
}

/**
 * Fold a puzzle completion on `dateKey` into the stored streak (idempotent per
 * day). Called when the daily puzzle finishes; the front-door badge reads the
 * result via `loadPuzzleStreak`.
 */
export function recordPuzzleComplete(dateKey: string): void {
  try {
    const next = foldCompletion(loadPuzzleStreakState(), dateKey);
    localStorage.setItem(PUZZLE_STREAK_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable; the streak just doesn't accrue
  }
}

/** The daily-puzzle streak still alive as of today (0 if lapsed or never played). */
export function loadPuzzleStreak(today: string = dailyDateKey()): number {
  return liveStreak(loadPuzzleStreakState(), today);
}

/** Whether the player has finished the tutorial at least once (P35 (d)). */
export function loadTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, '1');
  } catch {
    // storage unavailable; the row just never de-emphasizes
  }
}

/** The shareable app-origin URL that deep-links into joining `matchID`. */
export function inviteUrl(matchID: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?join=${encodeURIComponent(matchID)}`;
}
