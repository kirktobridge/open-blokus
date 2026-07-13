import { useMemo, useState } from 'react';
import type { GameMode } from '../../game/types';
import { DIFFICULTIES, resolveExtremeForBlitz, type Difficulty } from '../ai/difficulty';
import { BLITZ_OPTIONS } from '../blitz/blitz';
import { FIELD, FONT_UI, GHOST_BTN, PANEL, PRIMARY_BTN, WELL_ROW } from '../theme';
import { botSeatLabels, loadSetup, persistSetup, setupSummary, type AiSetup } from './aiSetup';
import { LobbyTopBar } from './LobbyTopBar';

/**
 * Custom Game (P29) — the vs-AI setup form, promoted from a `<details>` inside the
 * old play card to a screen of its own. It's a setup flow that *leads into a game*,
 * so it takes the view rather than overlaying it; the glance destinations (friends,
 * stats) are modals instead.
 */
export function CustomGameScreen({
  onStart,
  onBack,
}: {
  onStart: (setup: AiSetup) => void;
  onBack: () => void;
}) {
  const [setup, setSetup] = useState<AiSetup>(() => loadSetup());
  const { mode, aiCount, botDifficulties, blitzSeconds } = setup;
  const botSeats = useMemo(() => botSeatLabels(mode, aiCount), [mode, aiCount]);

  const start = () => onStart(persistSetup(setup));

  return (
    <div style={{ background: 'var(--table-bg)', minHeight: '100vh', fontFamily: FONT_UI }}>
      <LobbyTopBar chip="Custom game" />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px 26px 44px' }}>
        <button data-testid="custom-back" onClick={onBack} style={{ ...GHOST_BTN, marginBottom: 10 }}>
          ← Back
        </button>

        <section data-testid="custom-game" style={{ ...PANEL, padding: 22 }}>
          <h2 style={{ margin: '0 0 4px', fontWeight: 800 }}>Custom game</h2>
          <p data-testid="custom-summary" style={{ margin: '0 0 18px', color: 'var(--mut)', fontSize: 13.5 }}>
            {setupSummary(setup)}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                Players:{' '}
                <select
                  data-testid="ai-mode-select"
                  value={mode}
                  onChange={(e) => {
                    const m = Number(e.target.value) as GameMode;
                    // Clamping the bot count here keeps "4 bots" from surviving a
                    // drop to a 2-player game.
                    setSetup((s) => ({ ...s, mode: m, aiCount: Math.min(s.aiCount, m) }));
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
                  onChange={(e) => setSetup((s) => ({ ...s, aiCount: Number(e.target.value) }))}
                  style={FIELD}
                >
                  {Array.from({ length: mode + 1 }, (_, n) => (
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
                    // Turning blitz on retires any extreme seat — it can't race the
                    // clock (P25); keep the UI and the setup consistent.
                    setSetup((s) => ({
                      ...s,
                      blitzSeconds: next,
                      botDifficulties: resolveExtremeForBlitz(s.botDifficulties, next),
                    }));
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
                        setSetup((s) => ({
                          ...s,
                          botDifficulties: {
                            ...s.botDifficulties,
                            [seat]: e.target.value as Difficulty,
                          },
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

            <button
              data-testid="start-ai"
              onClick={start}
              style={{ ...PRIMARY_BTN, marginTop: 8, width: '100%' }}
            >
              Start this setup
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
