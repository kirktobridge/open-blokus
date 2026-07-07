import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMode, ScoringVariant } from '../game/types';
import { useLobby } from './lobby/useLobby';
import { loadSession, saveSession, type MatchInfo, type Session } from './lobby/config';
import { HomeScreen } from './lobby/HomeScreen';
import { MatchScreen } from './lobby/MatchScreen';
import { LocalAIGame } from './ai/LocalAIGame';
import { Tutorial } from './tutorial/Tutorial';
import type { Difficulty } from './ai/difficulty';
import { SettingsPanel } from './SettingsPanel';
import { ControlsHelp } from './ControlsHelp';

export function App() {
  const lobby = useLobby();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [aiConfig, setAiConfig] = useState<{
    mode: GameMode;
    aiCount: number;
    botDifficulties: Record<string, Difficulty>;
  } | null>(null);

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

  // Invite deep-link: `?join=<matchID>` on load joins that match, then strips the
  // param so a refresh (which restores via obk:session) won't try to rejoin. Runs
  // once; the ref guards against StrictMode's double-invoke consuming two seats.
  const inviteHandled = useRef(false);
  useEffect(() => {
    if (inviteHandled.current) return;
    inviteHandled.current = true;
    const joinId = new URLSearchParams(window.location.search).get('join');
    if (!joinId) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    window.history.replaceState({}, '', url.toString());
    if (session) return; // already seated (restored session) — ignore the link
    void (async () => {
      try {
        enter(await lobby.join(joinId));
      } catch {
        setJoinError('That table is full or no longer exists.');
      }
    })();
  }, []);

  const onCreate = useCallback(
    async (mode: GameMode, scoring: ScoringVariant) => {
      const matchID = await lobby.createMatch(mode, scoring);
      enter(await lobby.join(matchID));
    },
    [lobby],
  );

  const onJoin = useCallback(
    async (matchID: string) => {
      try {
        enter(await lobby.join(matchID));
      } catch {
        setJoinError('Could not join that table — it may be full or gone.');
      }
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
  if (showTutorial) {
    screen = <Tutorial onExit={() => setShowTutorial(false)} />;
  } else if (aiConfig) {
    screen = (
      <LocalAIGame
        mode={aiConfig.mode}
        aiCount={aiConfig.aiCount}
        botDifficulties={aiConfig.botDifficulties}
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
        onStartAI={(mode, aiCount, botDifficulties) =>
          setAiConfig({ mode, aiCount, botDifficulties })
        }
        onOpenTutorial={() => setShowTutorial(true)}
        joinError={joinError}
        onDismissError={() => setJoinError(null)}
      />
    );
  }
  return (
    <>
      {/* The vs-AI table docks its own chips; the home screen docks its own too.
          Only the online MatchScreen relies on these floating utility triggers. */}
      {session && !aiConfig && (
        <>
          <SettingsPanel />
          <ControlsHelp />
        </>
      )}
      {screen}
    </>
  );
}
