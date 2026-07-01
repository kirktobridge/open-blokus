import { useCallback, useEffect, useState } from 'react';
import type { GameMode, ScoringVariant } from '../game/types';
import { useLobby } from './lobby/useLobby';
import { loadSession, saveSession, type MatchInfo, type Session } from './lobby/config';
import { HomeScreen } from './lobby/HomeScreen';
import { MatchScreen } from './lobby/MatchScreen';
import { LocalAIGame } from './ai/LocalAIGame';
import { ThemeToggle } from './ThemeToggle';
import { PalettePicker } from './PalettePicker';

export function App() {
  const lobby = useLobby();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [aiConfig, setAiConfig] = useState<{ mode: GameMode; aiCount: number } | null>(null);

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

  let screen;
  if (aiConfig) {
    screen = (
      <LocalAIGame
        mode={aiConfig.mode}
        aiCount={aiConfig.aiCount}
        onLeave={() => setAiConfig(null)}
      />
    );
  } else if (session) {
    screen = <MatchScreen session={session} onLeave={onLeave} onPlayAgain={onPlayAgain} />;
  } else {
    screen = (
      <HomeScreen
        matches={matches}
        onCreate={onCreate}
        onJoin={onJoin}
        onRefresh={refresh}
        onStartAI={(mode, aiCount) => setAiConfig({ mode, aiCount })}
      />
    );
  }
  return (
    <>
      <ThemeToggle />
      <PalettePicker />
      {screen}
    </>
  );
}
