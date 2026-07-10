import { useEffect, useMemo, useState } from 'react';
import type { Color, GameMode, ScoringVariant } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { ownersFor } from '../../game/modes';
import { loadQuickPlay, saveQuickPlay, type MatchInfo } from './config';
import { DIFFICULTIES, type Difficulty } from '../ai/difficulty';
import { BLITZ_OPTIONS, type BlitzSeconds } from '../blitz/blitz';
import { CreateMatchForm } from './CreateMatchForm';
import { MatchList } from './MatchList';
import { HeroBoard } from './HeroBoard';
import { ProgressionPanel } from '../progression/ProgressionPanel';
import { SettingsPanel } from '../SettingsPanel';
import { ControlsHelp } from '../ControlsHelp';
import {
  FIELD,
  FONT_MONO,
  FONT_UI,
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
  onCreate,
  onJoin,
  onRefresh,
  onStartAI,
  onOpenTutorial,
  joinError,
  onDismissError,
}: {
  matches: MatchInfo[];
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
  joinError?: string | null;
  onDismissError?: () => void;
}) {
  const saved = useMemo(() => loadQuickPlay(), []);
  const [id, setId] = useState('');
  const [aiMode, setAiMode] = useState<GameMode>(saved?.mode ?? QP_DEFAULT.mode);
  const [aiCount, setAiCount] = useState(saved?.aiCount ?? QP_DEFAULT.aiCount);
  const [botDifficulties, setBotDifficulties] = useState<Record<string, Difficulty>>(
    saved?.botDifficulties ?? {},
  );
  const [blitzSeconds, setBlitzSeconds] = useState<BlitzSeconds>(saved?.blitzSeconds ?? null);

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
  const start = () => {
    saveQuickPlay({ mode: aiMode, aiCount, botDifficulties, blitzSeconds });
    onStartAI(aiMode, aiCount, botDifficulties, blitzSeconds);
  };

  const humanCount = aiMode - aiCount;
  const setupSummary =
    `${aiMode} players · ` +
    (aiCount === aiMode ? 'watch (all AI)' : `you${humanCount > 1 ? ` +${humanCount - 1}` : ''} vs ${aiCount} AI`) +
    (botSeats.length > 0
      ? ` · ${botSeats.map(({ seat }) => botDifficulties[seat] ?? 'easy').join(', ')}`
      : '') +
    // The clock only ever runs on a human seat, so a watch game never advertises it.
    (blitzSeconds != null && humanCount > 0 ? ` · blitz ${blitzSeconds}s` : '');

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

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '8px 26px 40px' }}>
        {joinError && (
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
        )}

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <HeroBoard size={280} />

          <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 300 }}>
            {/* Play vs computer — Quick Play hero + collapsible Customize. */}
            <section style={{ ...PANEL, padding: 20 }}>
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
                          setBlitzSeconds(n === 0 ? null : n);
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
                            {DIFFICULTIES.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
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
                style={{
                  marginTop: 12,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--mut)',
                  fontFamily: FONT_UI,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                New to Blokus? Learn how to play →
              </button>
            </section>

            {/* Play online — create a table, then share the invite link. */}
            <section style={{ ...PANEL, padding: 20 }}>
              <h2 style={{ margin: '0 0 12px', fontWeight: 800 }}>Play online</h2>
              <CreateMatchForm onCreate={onCreate} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                <span style={{ color: 'var(--mut)', fontSize: 13 }}>Have a match ID?</span>
                <input
                  data-testid="join-id-input"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="match id"
                  style={{ ...FIELD, cursor: 'text' }}
                />
                <button
                  data-testid="join-id-submit"
                  onClick={() => id && onJoin(id)}
                  style={{ ...SECONDARY_BTN, padding: '7px 14px', fontSize: 13 }}
                >
                  Join
                </button>
              </div>
            </section>

            {/* Local progression — lifetime vs-AI stats (P15). */}
            <ProgressionPanel />
          </div>
        </div>

        <section style={{ ...PANEL, padding: 20, marginTop: 20 }}>
          <MatchList matches={matches} onJoin={onJoin} onRefresh={onRefresh} />
        </section>
      </div>
    </div>
  );
}
