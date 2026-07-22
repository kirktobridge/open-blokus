import { useMemo, useState } from 'react';
import type { GameMode, Variant } from '../../game/types';
import { DIFFICULTIES, resolveExtremeForBlitz, type Difficulty } from '../ai/difficulty';
import { BLITZ_OPTIONS } from '../blitz/blitz';
import { FIELD, FONT_UI, GHOST_BTN, PANEL, PRIMARY_BTN, WELL_ROW } from '../theme';
import {
  botSeatLabels,
  launchSetup,
  loadSetup,
  normalizeSetup,
  pinSetup,
  setupKey,
  setupSummary,
  type AiSetup,
} from './aiSetup';
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
  const { mode, aiCount, botDifficulties, blitzSeconds, variant } = setup;
  const botSeats = useMemo(
    () => botSeatLabels(mode, aiCount, variant),
    [mode, aiCount, variant],
  );

  // What Quick Play would start right now. Starting a game no longer touches this
  // (P46) — only pinning does — so the screen tracks it separately from the setup
  // being edited, and the pin control can say which of the two you're looking at.
  const [quickPlay, setQuickPlay] = useState<AiSetup>(() => loadSetup());
  const isPinned = setupKey(setup) === setupKey(quickPlay);

  const start = () => onStart(launchSetup(setup));
  const pin = () => setQuickPlay(pinSetup(setup));

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
              <label
                style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}
                title="Classic is the 20×20 four-colour game. Duo is the two-player 14×14 game: black and white, interior starting points, advanced scoring."
              >
                Game:{' '}
                <select
                  data-testid="variant-select"
                  value={variant}
                  onChange={(e) => {
                    // normalizeSetup pins the seat count and scoring a variant
                    // requires, so a switch can never leave an unstartable form.
                    const v = e.target.value as Variant;
                    setSetup((s) => {
                      // Carry the human seats across, not the bot count: pinning Duo
                      // to 2 seats while keeping "3 bots" would silently turn your
                      // game into a watch game.
                      const humans = s.mode - s.aiCount;
                      const next = normalizeSetup({ ...s, variant: v });
                      return normalizeSetup({
                        ...next,
                        aiCount: Math.max(0, next.mode - Math.min(humans, next.mode)),
                      });
                    });
                  }}
                  style={FIELD}
                >
                  <option value="classic">Classic</option>
                  <option value="duo">Duo</option>
                </select>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                Players:{' '}
                <select
                  data-testid="ai-mode-select"
                  value={mode}
                  // Duo is exactly two seats (GAME_SPEC_DUO §5) — nothing to choose.
                  disabled={variant === 'duo'}
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

            {/* Pinning is a state change with nowhere to navigate to, so the control
                has to report the result itself, settling into a disabled "this is your
                default". Outlined rather than bare text: it stays legible as a control
                in that settled state instead of reading as a caption. Secondary to
                Start — starting a game is still the point of this screen, and pinning
                is the rarer, deliberate act. */}
            <button
              data-testid="pin-default"
              onClick={pin}
              disabled={isPinned}
              style={{
                ...GHOST_BTN,
                width: '100%',
                border: '1px solid var(--top-bd)',
                borderRadius: 8,
                padding: '8px 10px',
                opacity: isPinned ? 0.75 : 1,
                cursor: isPinned ? 'default' : 'pointer',
              }}
            >
              {isPinned ? '✓ Pinned as your Quick Play default' : 'Pin as my Quick Play default'}
            </button>
            {/* Only worth saying when it differs from the setup on screen — once
                pinned, this line and the card's own summary are the same sentence
                twice. */}
            {!isPinned && (
              <p
                data-testid="quick-play-default"
                style={{ margin: 0, color: 'var(--mut)', fontSize: 12.5, textAlign: 'center' }}
              >
                Quick Play starts: {setupSummary(quickPlay)}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
