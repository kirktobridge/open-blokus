import { useCallback, useEffect, useState } from 'react';
import type { GameMode, ScoringVariant } from '../game/types';
import { useLobby } from './lobby/useLobby';
import { loadSession, saveSession, type MatchInfo, type Session } from './lobby/config';
import { HomeScreen } from './lobby/HomeScreen';
import { MatchScreen } from './lobby/MatchScreen';

export function App() {
  const lobby = useLobby();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [matches, setMatches] = useState<MatchInfo[]>([]);

  const refresh = useCallback(async () => {
    try {
      setMatches(await lobby.listMatches());
    } catch {
      // server may be down; leave the list empty
    }
  }, [lobby]);

  useEffect(() => {
    if (!session) void refresh();
  }, [session, refresh]);

  const enter = (s: Session) => {
    saveSession(s);
    setSession(s);
  };

  const onCreate = useCallback(
    async (mode: GameMode, scoring: ScoringVariant) => {
      const matchID = await lobby.createMatch(mode, scoring);
      enter(await lobby.join(matchID));
    },
    [lobby],
  );

  const onJoin = useCallback(
    async (matchID: string) => {
      enter(await lobby.join(matchID));
    },
    [lobby],
  );

  const onLeave = useCallback(async () => {
    if (session) await lobby.leave(session);
    saveSession(null);
    setSession(null);
  }, [lobby, session]);

  const onPlayAgain = useCallback(async () => {
    if (!session) return;
    const nextMatchID = await lobby.playAgain(session);
    enter(await lobby.join(nextMatchID));
  }, [lobby, session]);

  if (session) {
    return <MatchScreen session={session} onLeave={onLeave} onPlayAgain={onPlayAgain} />;
  }
  return (
    <HomeScreen matches={matches} onCreate={onCreate} onJoin={onJoin} onRefresh={refresh} />
  );
}
