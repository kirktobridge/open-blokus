import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMode, ScoringVariant } from '../game/types';
import { dailyDateKey } from '../game/puzzle/daily';
import { useLobby } from './lobby/useLobby';
import {
  loadNick,
  loadSession,
  saveNick,
  savePuzzleSeen,
  saveSession,
  saveTutorialDone,
  type MatchInfo,
  type Session,
} from './lobby/config';
import { HomeScreen } from './lobby/HomeScreen';
import { CustomGameScreen } from './lobby/CustomGameScreen';
import { MatchScreen } from './lobby/MatchScreen';
import { LocalAIGame } from './ai/LocalAIGame';
import { DailyPuzzleGame } from './puzzle/DailyPuzzleGame';
import { Tutorial } from './tutorial/Tutorial';
import type { AiSetup } from './lobby/aiSetup';
import { ReviewTable } from './recap/ReviewTable';
import type { HistoryGame } from './log/history';
import { SettingsPanel } from './SettingsPanel';
import { ControlsHelp } from './ControlsHelp';
import { TableShell } from './TableShell';

export function App() {
  const lobby = useLobby();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [nickname, setNickname] = useState<string>(() => loadNick());
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiSetup | null>(null);
  // A past game opened from the history list (P15 M2). It's a full-viewport
  // destination like any other table, so it lives here as a screen rather than
  // inside the stats modal that launched it.
  const [reviewGame, setReviewGame] = useState<HistoryGame | null>(null);

  // Starting a game leaves the Custom Game screen behind, so backing out of the game
  // lands on the front door rather than the form you launched from.
  const startAI = useCallback((setup: AiSetup) => {
    setShowCustom(false);
    setAiConfig(setup);
  }, []);

  const openPuzzle = useCallback(() => {
    savePuzzleSeen(dailyDateKey());
    setShowPuzzle(true);
  }, []);

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

  // Read the live nickname from a ref so the once-run invite effect and the
  // memoized join callbacks always send the current name, not a stale closure.
  const nicknameRef = useRef(nickname);
  const changeNickname = useCallback((n: string) => {
    setNickname(n);
    nicknameRef.current = n;
    saveNick(n);
  }, []);

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
        enter(await lobby.join(joinId, nicknameRef.current));
      } catch {
        setJoinError('That table is full or no longer exists.');
      }
    })();
  }, []);

  const onCreate = useCallback(
    async (mode: GameMode, scoring: ScoringVariant) => {
      const matchID = await lobby.createMatch(mode, scoring);
      enter(await lobby.join(matchID, nicknameRef.current));
    },
    [lobby],
  );

  const onJoin = useCallback(
    async (matchID: string) => {
      try {
        enter(await lobby.join(matchID, nicknameRef.current));
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
    enter(await lobby.join(nextMatchID, nicknameRef.current));
  }, [lobby, session]);

  let screen;
  if (showTutorial) {
    screen = <Tutorial onExit={() => setShowTutorial(false)} onComplete={saveTutorialDone} />;
  } else if (showPuzzle) {
    screen = <DailyPuzzleGame onLeave={() => setShowPuzzle(false)} />;
  } else if (aiConfig) {
    screen = (
      <LocalAIGame
        mode={aiConfig.mode}
        aiCount={aiConfig.aiCount}
        botDifficulties={aiConfig.botDifficulties}
        blitzSeconds={aiConfig.blitzSeconds}
        onLeave={() => setAiConfig(null)}
      />
    );
  } else if (session) {
    screen = <MatchScreen session={session} onLeave={onLeave} onPlayAgain={onPlayAgain} />;
  } else if (reviewGame) {
    // Standalone review: no live client behind it, so ReviewTable renders from the
    // record alone and its Play Again (a session action) simply isn't offered.
    // It wears the same TableShell as review-inside-a-table (P53), so both entry
    // paths get the same chips; `fill` pins the transport to the viewport bottom (P52).
    screen = (
      <TableShell
        label="Review"
        fill
        onLeave={() => setReviewGame(null)}
        leaveLabel="Back to menu"
        leaveTestId="leave-review"
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReviewTable
            record={reviewGame.record}
            onExitReview={() => setReviewGame(null)}
            exitLabel="Back"
          />
        </div>
      </TableShell>
    );
  } else if (showCustom) {
    screen = <CustomGameScreen onStart={startAI} onBack={() => setShowCustom(false)} />;
  } else {
    screen = (
      <HomeScreen
        matches={matches}
        nickname={nickname}
        onNicknameChange={changeNickname}
        onCreate={onCreate}
        onJoin={onJoin}
        onRefresh={refresh}
        onStartAI={startAI}
        onOpenCustom={() => setShowCustom(true)}
        onOpenTutorial={() => setShowTutorial(true)}
        onOpenPuzzle={openPuzzle}
        onReviewGame={setReviewGame}
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
