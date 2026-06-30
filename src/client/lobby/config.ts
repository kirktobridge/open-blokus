export const SERVER_URL = import.meta.env.VITE_SERVER ?? 'http://localhost:8000';

export const SESSION_KEY = 'obk:session';

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
