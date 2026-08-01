import { useMemo, useState, type CSSProperties } from 'react';
import type { GameMode, Variant } from '../../game/types';
import { DIFFICULTIES, resolveExtremeForBlitz, type Difficulty } from '../ai/difficulty';
import { formatTierRating, ladderFor } from '../ai/ratings';
import { BLITZ_OPTIONS } from '../blitz/blitz';
import { FIELD, FONT_UI, GHOST_BTN, PANEL, PRIMARY_BTN, WELL_ROW } from '../theme';
import { useProgression, type ProgressionState } from '../progression/progression';
import {
  botSeatLabels,
  launchSetup,
  loadSetup,
  normalizeSetup,
  pinSetup,
  setupDiff,
  setupKey,
  setupSummary,
  type AiSetup,
} from './aiSetup';
import { LobbyTopBar } from './LobbyTopBar';
import { VariantCard } from './VariantCard';

/**
 * What a tier is, said beside the control that picks it (P65 M2): its rating on this
 * variant's ladder, then your record against it. Either clause can be absent — Duo has
 * no ladder (P61 M6) and an untried tier has no record — and with both absent the note
 * is empty rather than a placeholder.
 */
function tierNote(variant: Variant, tier: Difficulty, p: ProgressionState): string {
  const rating = formatTierRating(variant, tier);
  const { played, won } = p.perTier[variant][tier];
  return [
    rating ? `${rating} Elo` : null,
    // "you're 1–4 vs hard" — a record only says something once there is one.
    played > 0 ? `you're ${won}–${played - won} vs ${tier}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * A seat row, accented when it differs from the pinned Quick Play setup (P65 M4).
 * Deliberately quiet — an edge accent on the well, not a badge: the returning player's
 * task is "bump one bot, keep my usual", so this has to be scannable at a glance
 * without competing with the CTA.
 */
function changedRow(changed: boolean | undefined): CSSProperties {
  return {
    ...WELL_ROW,
    fontSize: 14,
    flexWrap: 'wrap',
    boxShadow: changed ? 'inset 3px 0 0 0 var(--brass)' : undefined,
  };
}

/**
 * The same "differs from your default" mark for the inline controls (M4), which sit on
 * the panel rather than in a well and so have no edge to accent. Carries a text twin —
 * a bare colored dot is invisible to a screen reader and to anyone who can't separate
 * it from the label.
 */
function ChangedDot({ changed, field }: { changed: boolean | undefined; field: string }) {
  if (!changed) return null;
  return (
    <span
      data-testid={`changed-${field}`}
      role="img"
      aria-label="changed from your Quick Play default"
      title="Changed from your Quick Play default"
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--brass)',
        flex: '0 0 auto',
      }}
    />
  );
}

/**
 * The variant options, in display order. Captions name the three things the choice
 * actually changes — board size, colors, and where you start — since that is what the
 * cards' boards show and what the old dropdown's `title` tooltip hid from touch.
 */
const VARIANT_CARDS: readonly { value: Variant; label: string; caption: string }[] = [
  { value: 'classic', label: 'Classic', caption: '20×20 · four colours · start in the corners' },
  { value: 'duo', label: 'Duo', caption: '14×14 · two colours · start inside the board' },
];

/**
 * Custom Game (P29) — the vs-AI setup form, promoted from a `<details>` inside the
 * old play card to a screen of its own. It's a setup flow that *leads into a game*,
 * so it takes the view rather than overlaying it; the glance destinations (friends,
 * stats) are modals instead.
 *
 * P65 M1/M3 gave it the front door's character: the variant picks itself from two real
 * boards rather than a dropdown, and the live setup summary is the headline instead of
 * a muted line under a redundant "Custom game" heading.
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
  const ratedVariant = ladderFor(variant) !== undefined;

  // What Quick Play would start right now. Starting a game no longer touches this
  // (P46) — only pinning does — so the screen tracks it separately from the setup
  // being edited, and the pin control can say which of the two you're looking at.
  const [quickPlay, setQuickPlay] = useState<AiSetup>(() => loadSetup());
  const isPinned = setupKey(setup) === setupKey(quickPlay);
  // Which individual rows differ from that default (M4) — the per-field twin of
  // `isPinned`, so a returning player sees *what* they changed, not just that they did.
  const diff = useMemo(() => setupDiff(setup, quickPlay), [setup, quickPlay]);
  const progression = useProgression();
  // Every seat is a bot, so there is nothing to play — you watch (M5). `setupSummary`
  // already calls this state "Watch — N bots"; the CTA and the clock row now agree
  // with it instead of promising a game you'd sit out.
  const isWatch = aiCount === mode;

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
          {/* The summary is the headline (M1/M3). "Custom game" was the largest type
              on screen while duplicating both the top-bar chip and the back button —
              three sayings of the same word and no information. The sentence that
              actually describes what Start will launch takes the slot instead, and it
              updates live as the form changes. */}
          <p
            data-testid="custom-summary"
            style={{ margin: '0 0 18px', color: 'var(--ink)', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}
          >
            {setupSummary(setup)}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* The variant choice shows the two boards it picks between (M1). Its
                changed-mark (M4) sits on the group, not inside a card: the cards
                already carry a selected ring, and a second accent inside one would
                read as part of the selection rather than as "differs from default". */}
            {diff.variant && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--mut)' }}>
                <ChangedDot changed field="variant" />
                Different game from your Quick Play default
              </div>
            )}
            <div
              role="radiogroup"
              aria-label="Game"
              data-testid="variant-cards"
              style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}
            >
              {VARIANT_CARDS.map(({ value, label, caption }) => (
                <VariantCard
                  key={value}
                  variant={value}
                  label={label}
                  caption={caption}
                  selected={variant === value}
                  onSelect={() =>
                    // normalizeSetup pins the seat count and scoring a variant
                    // requires, so a switch can never leave an unstartable form.
                    setSetup((s) => {
                      // Carry the human seats across, not the bot count: pinning Duo
                      // to 2 seats while keeping "3 bots" would silently turn your
                      // game into a watch game.
                      const humans = s.mode - s.aiCount;
                      const next = normalizeSetup({ ...s, variant: value });
                      return normalizeSetup({
                        ...next,
                        aiCount: Math.max(0, next.mode - Math.min(humans, next.mode)),
                      });
                    })
                  }
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
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
                <ChangedDot changed={diff.mode} field="mode" />
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
                <ChangedDot changed={diff.aiCount} field="aiCount" />
              </label>
              {/* In a watch game the clock is inert — it only ever runs on a human
                  seat — so the row recedes rather than disappearing (M5). Removing it
                  would make the setting look unavailable, and it isn't: it applies
                  again the moment you take a seat, and the value you picked is kept.

                  0.55 measured 3.39:1 contrast on the light theme and 5.11:1 on
                  Lamplight (P65 M5, eyes-on + computed). Held to the 3:1 WCAG AA bar
                  for a de-emphasized control, not the 4.5:1 body-text one — the row
                  has to actually read as receded. Raising it fights the milestone;
                  lowering it breaks the bar. */}
              <label
                data-testid="blitz-row"
                data-inert={isWatch || undefined}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: 14,
                  opacity: isWatch ? 0.55 : 1,
                }}
                title={
                  isWatch
                    ? 'The clock only runs on a human seat, so it does nothing in a watch game.'
                    : 'Per-move time limit. Run out and a random legal move is played for you.'
                }
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
                <ChangedDot changed={diff.blitz} field="blitz" />
              </label>
              {isWatch && (
                <span
                  data-testid="blitz-inert-note"
                  style={{ fontSize: 12.5, color: 'var(--mut)', alignSelf: 'center' }}
                >
                  The clock only runs on a human seat.
                </span>
              )}
            </div>

            {botSeats.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {botSeats.map(({ seat, label }) => {
                  const tier = botDifficulties[seat] ?? 'easy';
                  return (
                    <label key={seat} style={changedRow(diff[`seat:${seat}`])}>
                      <span style={{ minWidth: 140 }}>{label}:</span>
                      <select
                        data-testid={`ai-difficulty-${seat}`}
                        value={tier}
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
                          // A blocked extreme still explains itself in the option
                          // rather than advertising a strength you can't select
                          // (P61/P25). The *rating* no longer rides here — it moved
                          // into the row (M2) — so the suffix slot is the blocked
                          // reason alone.
                          return (
                            <option key={d} value={d} disabled={blocked}>
                              {d}
                              {blocked ? ' — needs untimed play' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {/* What the selected tier actually is, beside the control that
                          selects it (M2). In an <option> this was visible only while
                          the menu was open — so the `≈` and the caption explaining it
                          were never on screen together — and native option text renders
                          platform-dependently. */}
                      <span
                        data-testid={`tier-note-${seat}`}
                        style={{ color: 'var(--mut)', fontSize: 12.5, lineHeight: 1.35 }}
                      >
                        {tierNote(variant, tier, progression)}
                      </span>
                    </label>
                  );
                })}
                {/* A bare "1683" is not legible on its own — it needs to say what
                    scale it is on, and (P61 M6) that the scale is Classic-only. Duo
                    reads as deliberately unrated rather than broken. Wording is
                    P61's, unchanged; what changed (P65 M2) is that the `≈` it
                    explains now renders in the rows above instead of inside an
                    <option>, so the mark and its explanation are finally co-visible. */}
                <p
                  data-testid="rating-caption"
                  style={{ margin: '2px 0 0', color: 'var(--mut)', fontSize: 12, lineHeight: 1.45 }}
                >
                  {ratedVariant ? (
                    <>
                      Ratings are Elo from bot-vs-bot play, on the Classic pool.{' '}
                      <strong>≈</strong> marks a tier whose search is time-budgeted, so its
                      rating varies with your machine.
                    </>
                  ) : (
                    <>Duo bots are unrated — the Elo scale is Classic-only, and the two are not comparable.</>
                  )}
                </p>
              </div>
            )}

            <button
              data-testid="start-ai"
              onClick={start}
              style={{ ...PRIMARY_BTN, marginTop: 8, width: '100%' }}
            >
              {isWatch ? 'Watch this game' : 'Start this setup'}
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
