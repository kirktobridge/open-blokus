import type { GameMode } from '../../game/types';
import type { Difficulty } from '../ai/difficulty';
import type { BlitzSeconds } from '../blitz/blitz';

export const SERVER_URL = import.meta.env.VITE_SERVER ?? 'http://localhost:8000';

export const SESSION_KEY = 'obk:session';
export const QUICKPLAY_KEY = 'obk:quickplay';
export const NICK_KEY = 'obk:nick';

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

/** The shareable app-origin URL that deep-links into joining `matchID`. */
export function inviteUrl(matchID: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?join=${encodeURIComponent(matchID)}`;
}
