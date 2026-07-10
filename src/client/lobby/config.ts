import type { GameMode } from '../../game/types';
import type { Difficulty } from '../ai/difficulty';
import type { BlitzSeconds } from '../blitz/blitz';

export const SERVER_URL = import.meta.env.VITE_SERVER ?? 'http://localhost:8000';

export const SESSION_KEY = 'obk:session';
export const QUICKPLAY_KEY = 'obk:quickplay';

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
