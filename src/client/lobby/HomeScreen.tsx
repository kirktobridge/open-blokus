import { useMemo, useState } from 'react';
import type { GameMode, ScoringVariant } from '../../game/types';
import { dailyDateKey } from '../../game/puzzle/daily';
import { loadPuzzleSeen, loadPuzzleStreak, loadTutorialDone, MAX_NICK_LEN, type MatchInfo } from './config';
import { launchSetup, loadSetup, setupSummary, type AiSetup } from './aiSetup';
import { ActionMenu, type ActionRow } from './ActionMenu';
import { CreateMatchForm } from './CreateMatchForm';
import { AmbientBoard } from './AmbientBoard';
import { LobbyTopBar } from './LobbyTopBar';
import { MatchList } from './MatchList';
import { Modal } from './Modal';
import { ProgressionPanel } from '../progression/ProgressionPanel';
import { useWideLayout } from '../hooks/useWideLayout';
import { useViewport } from '../hooks/useViewport';
import { FIELD, FONT_UI, GHOST_BTN, SECONDARY_BTN, WELL_ROW } from '../theme';

/** Which glance is overlaying the front door, if any. */
type Glance = 'friends' | 'stats' | null;

/**
 * The front door (P29): one large board carrying the page, one uniform vertical menu
 * saying where you can go. Destinations split by kind — Custom Game leads into a
 * game so it takes the view (a screen, owned by App); friends and stats are glances,
 * so they overlay.
 */
export function HomeScreen({
  matches,
  nickname,
  onNicknameChange,
  onCreate,
  onJoin,
  onRefresh,
  onStartAI,
  onOpenCustom,
  onOpenTutorial,
  onOpenPuzzle,
  joinError,
  onDismissError,
}: {
  matches: MatchInfo[];
  nickname: string;
  onNicknameChange: (nick: string) => void;
  onCreate: (mode: GameMode, scoring: ScoringVariant) => void;
  onJoin: (matchID: string) => void;
  onRefresh: () => void;
  onStartAI: (setup: AiSetup) => void;
  onOpenCustom: () => void;
  onOpenTutorial: () => void;
  onOpenPuzzle: () => void;
  joinError?: string | null;
  onDismissError?: () => void;
}) {
  const wide = useWideLayout();
  const [glance, setGlance] = useState<Glance>(null);
  const [id, setId] = useState('');

  // The pinned setup (or the built-in one), read once on mount — Quick Play launches
  // exactly this, and its subtitle says so. Custom Game owns pinning it; returning here
  // remounts the screen and re-reads, so the row always describes what it will start.
  const saved = useMemo(() => loadSetup(), []);
  const puzzleIsNew = useMemo(() => loadPuzzleSeen() !== dailyDateKey(), []);
  const puzzleStreak = useMemo(() => loadPuzzleStreak(), []);
  const tutorialDone = useMemo(() => loadTutorialDone(), []);

  // P35 hierarchy pass: Quick Play is the single primary (the only precondition-free
  // action, so it doubles as the fallback); Your Stats left the column for the top bar
  // (P35 (b)). Rows stay put and adapt by badge, not order — the completed tutorial
  // de-emphasizes, the daily puzzle carries its streak.
  const rows: ActionRow[] = [
    {
      testid: 'quick-play',
      label: 'Quick Play',
      hint: setupSummary(saved),
      primary: true,
      onClick: () => onStartAI(launchSetup(saved)),
    },
    {
      testid: 'open-custom',
      label: 'Custom Game',
      hint: 'Players, bots, difficulty, blitz clock',
      onClick: onOpenCustom,
    },
    {
      testid: 'open-puzzle',
      label: 'Daily Puzzle',
      hint: 'Same board for everyone today',
      badge: puzzleIsNew ? 'New today' : undefined,
      streak: puzzleStreak,
      onClick: onOpenPuzzle,
    },
    {
      testid: 'open-tutorial',
      label: 'Tutorial',
      hint: tutorialDone ? "You've finished this" : 'New to Blokus? Learn how to play',
      badge: tutorialDone ? 'Done' : undefined,
      dim: tutorialDone,
      onClick: onOpenTutorial,
    },
    {
      testid: 'open-friends',
      label: 'Play with Friends',
      hint: 'Create a table or join one',
      onClick: () => setGlance('friends'),
    },
  ];

  const joinBanner = joinError && (
    <div
      data-testid="join-error"
      style={{
        ...WELL_ROW,
        background: 'rgba(220, 38, 38, 0.12)',
        border: '1px solid rgba(220, 38, 38, 0.4)',
        color: 'var(--ink)',
        marginBottom: 16,
      }}
    >
      <span style={{ flex: 1 }}>{joinError}</span>
      {onDismissError && (
        <button
          onClick={onDismissError}
          aria-label="Dismiss"
          style={{ ...SECONDARY_BTN, padding: '4px 10px', fontSize: 12 }}
        >
          Dismiss
        </button>
      )}
    </div>
  );

  // Play with friends — P28's card body, unchanged, now the friends glance: name
  // yourself → create a table → browse open tables → join by ID.
  const friendsBody = (
    <>
      <p style={{ margin: '0 0 14px', color: 'var(--mut)', fontSize: 13.5 }}>
        Create a table and share the invite link, or join one below.
      </p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 12 }}>
        Nickname:{' '}
        <input
          data-testid="nickname-input"
          value={nickname}
          maxLength={MAX_NICK_LEN}
          onChange={(e) => onNicknameChange(e.target.value)}
          placeholder="shown to opponents"
          style={{ ...FIELD, cursor: 'text', flex: 1, minWidth: 0 }}
        />
      </label>
      <CreateMatchForm onCreate={onCreate} />

      <div style={{ borderTop: '1px solid var(--pnl-bd)', margin: '18px 0 16px' }} />

      <MatchList matches={matches} onJoin={onJoin} onRefresh={onRefresh} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--mut)', fontSize: 13 }}>Have a match ID?</span>
        <input
          data-testid="join-id-input"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="match id"
          style={{ ...FIELD, cursor: 'text', width: 130 }}
        />
        <button data-testid="join-id-submit" onClick={() => id && onJoin(id)} style={GHOST_BTN}>
          Join →
        </button>
      </div>
    </>
  );

  // The board carries the page, the menu points — and both are sized off the
  // *viewport*, not off constants: a fixed-px front door leaves a large screen mostly
  // empty. The board takes the height the page gives it (bounded so it can't outrun
  // its column), and the menu column scales with width.
  const { w, h } = useViewport();
  const CHROME = 130; // top bar + the row's own vertical padding
  const boardSize = wide
    ? Math.max(380, Math.min(h - CHROME, w * 0.46, 900))
    : Math.max(260, Math.min(w - 56, 420));
  const menuWidth = wide ? Math.max(330, Math.min(w * 0.3, 500)) : undefined;

  const board = (
    <div
      data-testid="home-hero"
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <AmbientBoard size={boardSize} />
    </div>
  );

  return (
    <div
      style={{
        background: 'var(--table-bg)',
        // The shell owns the full page: top bar takes what it needs, the board+menu
        // row takes everything left, so nothing huddles at the top of a big screen.
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT_UI,
      }}
    >
      <LobbyTopBar chip="Lobby" onOpenStats={() => setGlance('stats')} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: wide ? '4px 40px 28px' : '8px 26px 40px',
        }}
      >
        {joinBanner}

        <div
          style={
            wide
              ? {
                  display: 'grid',
                  gridTemplateColumns: `${boardSize}px ${menuWidth}px`,
                  justifyContent: 'center',
                  gap: 44,
                  // Stretch, not start — the menu stands as tall as the board.
                  alignItems: 'stretch',
                }
              : {
                  // Stretch (not center) so the menu buttons take the column's full
                  // width; the board centers itself inside it.
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                  width: '100%',
                  maxWidth: 480,
                  margin: '0 auto',
                }
          }
        >
          {board}
          <ActionMenu rows={rows} />
        </div>
      </div>

      {glance === 'friends' && (
        <Modal title="Play with friends" testid="friends-modal" onClose={() => setGlance(null)}>
          {friendsBody}
        </Modal>
      )}
      {glance === 'stats' && (
        <Modal title="Your stats" testid="stats-modal" onClose={() => setGlance(null)}>
          <ProgressionPanel flush />
        </Modal>
      )}
    </div>
  );
}
