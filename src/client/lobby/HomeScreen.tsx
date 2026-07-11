import { useEffect, useMemo, useState } from 'react';
import type { Color, GameMode, ScoringVariant } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { ownersFor } from '../../game/modes';
import { loadQuickPlay, saveQuickPlay, MAX_NICK_LEN, type MatchInfo } from './config';
import { DIFFICULTIES, resolveExtremeForBlitz, type Difficulty } from '../ai/difficulty';
import { BLITZ_OPTIONS, type BlitzSeconds } from '../blitz/blitz';
import { CreateMatchForm } from './CreateMatchForm';
import { MatchList } from './MatchList';
import { HeroBoard } from './HeroBoard';
import { ProgressionPanel } from '../progression/ProgressionPanel';
import { SettingsPanel } from '../SettingsPanel';
import { ControlsHelp } from '../ControlsHelp';
import { useWideLayout } from '../hooks/useWideLayout';
import {
  FIELD,
  FONT_MONO,
  FONT_UI,
  GHOST_BTN,
  PANEL,
  PRIMARY_BTN,
  SECONDARY_BTN,
  WELL_ROW,
} from '../theme';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Bot seats (last `aiCount` playerIDs) and the label for each — the color(s) that
 * seat owns per `ownersFor(mode)`. A seat may own two colors (2p). The 3p 'shared'
 * color belongs to no fixed seat, so it doesn't add a label. If a seat owns a
 * shared color's turns too (3p), we note it. Returned in seat order.
 */
function botSeatLabels(mode: GameMode, aiCount: number): { seat: string; label: string }[] {
  const humanCount = Math.max(0, mode - aiCount);
  const owners = ownersFor(mode);
  const colorsForSeat = (seat: string): Color[] =>
    COLOR_ORDER.filter((c) => owners[c] === seat);
  const hasShared = COLOR_ORDER.some((c) => owners[c] === 'shared');

  return Array.from({ length: mode }, (_, i) => String(i))
    .filter((s) => Number(s) >= humanCount)
    .map((seat) => {
      const colors = colorsForSeat(seat);
      let label = colors.map(cap).join(', ') || `Seat ${seat}`;
      if (hasShared) label += ' + shared';
      return { seat, label };
    });
}

const QP_DEFAULT = { mode: 4 as GameMode, aiCount: 3 };

export function HomeScreen({
  matches,
  nickname,
  onNicknameChange,
  onCreate,
  onJoin,
  onRefresh,
  onStartAI,
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
  onStartAI: (
    mode: GameMode,
    aiCount: number,
    botDifficulties: Record<string, Difficulty>,
    blitzSeconds: BlitzSeconds,
  ) => void;
  onOpenTutorial: () => void;
  onOpenPuzzle: () => void;
  joinError?: string | null;
  onDismissError?: () => void;
}) {
  const wide = useWideLayout();
  const saved = useMemo(() => loadQuickPlay(), []);
  const [id, setId] = useState('');
  const [aiMode, setAiMode] = useState<GameMode>(saved?.mode ?? QP_DEFAULT.mode);
  const [aiCount, setAiCount] = useState(saved?.aiCount ?? QP_DEFAULT.aiCount);
  const [blitzSeconds, setBlitzSeconds] = useState<BlitzSeconds>(saved?.blitzSeconds ?? null);
  // Sanitize the saved setup on load: a stored `extreme + blitz` can't race the clock
  // (P25), so drop extreme to hard rather than start an unwinnable game.
  const [botDifficulties, setBotDifficulties] = useState<Record<string, Difficulty>>(() =>
    resolveExtremeForBlitz(saved?.botDifficulties ?? {}, saved?.blitzSeconds ?? null),
  );

  const botSeats = useMemo(() => botSeatLabels(aiMode, aiCount), [aiMode, aiCount]);

  // Keep the map in sync with the current bot seats: every current seat gets an
  // entry (default 'easy'), stale seats are dropped. Runs when players/count change.
  useEffect(() => {
    setBotDifficulties((prev) => {
      const next: Record<string, Difficulty> = {};
      for (const { seat } of botSeats) next[seat] = prev[seat] ?? 'easy';
      return next;
    });
  }, [botSeats]);

  // Persist the setup and launch — used by both Quick Play and the Customize form.
  // Sanitize once more at the boundary so no extreme+blitz combo can ever launch (P25).
  const start = () => {
    const tiers = resolveExtremeForBlitz(botDifficulties, blitzSeconds);
    saveQuickPlay({ mode: aiMode, aiCount, botDifficulties: tiers, blitzSeconds });
    onStartAI(aiMode, aiCount, tiers, blitzSeconds);
  };

  const humanCount = aiMode - aiCount;
  // Human-readable one-liner for the setup: who's playing · the bots' tier(s) ·
  // the clock. Collapses a uniform lineup to "all easy" and names the clock as
  // "untimed" when off, so the summary reads like a sentence, not a debug dump.
  const tiers = botSeats.map(({ seat }) => botDifficulties[seat] ?? 'easy');
  const uniformTier = tiers.length > 0 && tiers.every((t) => t === tiers[0]);
  const setupSummary = [
    aiCount === aiMode
      ? `Watch — ${aiMode} bots`
      : `You${humanCount > 1 ? ` +${humanCount - 1}` : ''} vs ${aiCount} ${aiCount === 1 ? 'bot' : 'bots'}`,
    tiers.length === 0 ? null : uniformTier ? `all ${tiers[0]}` : tiers.join(', '),
    // The clock only ever runs on a human seat, so a watch game stays silent on it.
    humanCount > 0 ? (blitzSeconds != null ? `blitz ${blitzSeconds}s` : 'untimed') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Each home block is built once and arranged by the layout below, so the wide
  // (landscape) and narrow (stacked) layouts render the *same* nodes — no
  // duplicated JSX and no behavior difference between breakpoints (P27).
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

  const hero = (
    <div data-testid="home-hero" style={{ display: 'flex', justifyContent: 'center' }}>
      <HeroBoard size={280} />
    </div>
  );

  // Daily puzzle — a slim one-line hook (P28), not a full card competing with the
  // primary action: title + one line on the left, a secondary CTA on the right.
  const dailyCard = (
    <section
      data-testid="card-daily"
      style={{ ...PANEL, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Daily puzzle</h2>
        <p style={{ margin: '3px 0 0', color: 'var(--mut)', fontSize: 13 }}>
          Same board for everyone today — fit as many pieces as you can.
        </p>
      </div>
      <button data-testid="open-puzzle" onClick={onOpenPuzzle} style={SECONDARY_BTN}>
        Play today's puzzle
      </button>
    </section>
  );

  // Play vs computer — the page's primary action, with the hero board docked
  // beside it (P28) so the most colorful object decorates the main verb. On wide
  // the board sits to the right of the body; on narrow it stacks on top.
  const vsComputerCard = (
    <section data-testid="card-vs-computer" style={{ ...PANEL, padding: 22 }}>
      <div
        style={
          wide
            ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24, alignItems: 'center' }
            : { display: 'flex', flexDirection: 'column', gap: 18 }
        }
      >
        {!wide && hero}
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: '0 0 4px', fontWeight: 800 }}>Play vs computer</h2>
          <p style={{ margin: '0 0 14px', color: 'var(--mut)', fontSize: 13.5 }}>{setupSummary}</p>
          <button data-testid="quick-play" onClick={start} style={{ ...PRIMARY_BTN, width: '100%' }}>
            Quick Play
          </button>

      <details style={{ marginTop: 12 }}>
        <summary
          data-testid="customize-toggle"
          style={{ cursor: 'pointer', color: 'var(--mut)', fontSize: 13.5, fontWeight: 600 }}
        >
          Customize…
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              Players:{' '}
              <select
                data-testid="ai-mode-select"
                value={aiMode}
                onChange={(e) => {
                  const m = Number(e.target.value) as GameMode;
                  setAiMode(m);
                  setAiCount((c) => Math.min(c, m));
                }}
                style={FIELD}
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              AI opponents:{' '}
              <select
                data-testid="ai-count-select"
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                style={FIELD}
              >
                {Array.from({ length: aiMode + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}
              title="Per-move time limit. Run out and a random legal move is played for you."
            >
              Blitz:{' '}
              <select
                data-testid="blitz-select"
                value={blitzSeconds ?? 0}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const next = n === 0 ? null : n;
                  setBlitzSeconds(next);
                  // Turning blitz on retires any extreme seat — it can't race
                  // the clock (P25); keep the UI and the setup consistent.
                  setBotDifficulties((prev) => resolveExtremeForBlitz(prev, next));
                }}
                style={FIELD}
              >
                {BLITZ_OPTIONS.map(({ value, label }) => (
                  <option key={label} value={value ?? 0}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {botSeats.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {botSeats.map(({ seat, label }) => (
                <label key={seat} style={{ ...WELL_ROW, fontSize: 14 }}>
                  <span style={{ minWidth: 140 }}>{label}:</span>
                  <select
                    data-testid={`ai-difficulty-${seat}`}
                    value={botDifficulties[seat] ?? 'easy'}
                    onChange={(e) =>
                      setBotDifficulties((prev) => ({
                        ...prev,
                        [seat]: e.target.value as Difficulty,
                      }))
                    }
                    style={FIELD}
                  >
                    {DIFFICULTIES.map((d) => {
                      // Extreme has no time budget (~12s/move), so it can't be
                      // paced into a blitz clock — disable it and say why in
                      // place, no modal (P25).
                      const blocked = d === 'extreme' && blitzSeconds != null;
                      return (
                        <option key={d} value={d} disabled={blocked}>
                          {blocked ? 'extreme — needs untimed play' : d}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ))}
            </div>
          )}

          <button data-testid="start-ai" onClick={start} style={{ ...SECONDARY_BTN, alignSelf: 'flex-start' }}>
            Start this setup
          </button>
        </div>
      </details>

          <button
            data-testid="open-tutorial"
            onClick={onOpenTutorial}
            style={{ ...GHOST_BTN, display: 'block', marginTop: 12, padding: '6px 0', textDecoration: 'underline' }}
          >
            New to Blokus? Learn how to play →
          </button>
        </div>
        {wide && hero}
      </div>
    </section>
  );

  // Play with friends (P28) — "start a game with people" was one intent split
  // across a Play-online card and a separate Open-matches list; merged into one
  // surface, top-to-bottom in intent order: create a table → browse open tables →
  // join by ID.
  const friendsCard = (
    <section data-testid="card-friends" style={{ ...PANEL, padding: 22 }}>
      <h2 style={{ margin: '0 0 4px', fontWeight: 800 }}>Play with friends</h2>
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
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
    </section>
  );

  // Local progression — lifetime vs-AI stats (P15).
  const progression = <ProgressionPanel />;

  return (
    <div style={{ background: 'var(--table-bg)', minHeight: '100vh', fontFamily: FONT_UI }}>
      {/* TopBar — wordmark · lobby chip · spacer · utility chips (matches the table). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 26px' }}>
        <span style={{ fontWeight: 900, fontSize: 25, color: 'var(--top-ink)' }}>OpenBlokus</span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '.09em',
            color: 'var(--top-mut)',
            border: '1px solid var(--top-bd)',
            borderRadius: 999,
            padding: '5px 12px',
          }}
        >
          Lobby
        </span>
        <span style={{ flex: 1 }} />
        <SettingsPanel docked />
        <ControlsHelp docked />
      </div>

      {/* Wide: a ranked play column (primary → daily hook → friends) beside a
          progress rail; narrow: one centered stack in the same rank order (P28). */}
      <div style={{ maxWidth: wide ? 1180 : 640, margin: '0 auto', padding: '8px 26px 44px' }}>
        {joinBanner}

        {wide ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {vsComputerCard}
              {dailyCard}
              {friendsCard}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{progression}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {vsComputerCard}
            {dailyCard}
            {friendsCard}
            {progression}
          </div>
        )}
      </div>
    </div>
  );
}
