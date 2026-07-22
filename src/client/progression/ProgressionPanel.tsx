import { DIFFICULTIES } from '../ai/difficulty';
import { FONT_MONO, PANEL, WELL_ROW } from '../theme';
import {
  VARIANT_KEYS,
  VARIANT_LABEL,
  bestScoreTile,
  hasGames,
  useProgression,
  winRate,
} from './progression';
import type { Variant } from '../../game/types';
import { useState } from 'react';
import { GameHistory } from './GameHistory';
import { loadHistory, type HistoryGame } from '../log/history';

/**
 * Home-screen "Your progress" card (P15 M1). Lifetime residue of local vs-AI
 * play: games, overall win rate, best score, streaks, and a per-tier win-rate
 * breakdown that makes the difficulty ladder feel earned. Empty until the first
 * recorded game. Reads the localStorage store via useProgression.
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

function Stat({
  label,
  value,
  testid,
  title,
}: {
  label: string;
  value: string;
  testid: string;
  title?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 72 }} title={title}>
      <span data-testid={testid} style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700 }}>
        {value}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </span>
    </div>
  );
}

/**
 * Lifetime vs-AI record (P15). `flush` drops the card chrome and the heading for a
 * host that already supplies them — the front door's Your Stats modal (P29) — so the
 * panel doesn't render a card inside a card.
 */
export function ProgressionPanel({
  flush = false,
  onReviewGame,
}: {
  flush?: boolean;
  /** Given, each past game offers a Review that opens it in the review table (M2). */
  onReviewGame?: (game: HistoryGame) => void;
} = {}) {
  const p = useProgression();
  // Classic and Duo are different games, so their tier records and best scores are
  // separate stores (P56) — and separate readouts. The switch appears only once
  // there is a second variant to switch to.
  const [variant, setVariant] = useState<Variant>('classic');
  const playedVariants = VARIANT_KEYS.filter((v) => hasGames(p, v));
  const best = bestScoreTile(p, variant);
  // Read once on mount: the stats modal remounts each time it opens, and nothing
  // can finish a game while you're looking at it.
  const [games] = useState<HistoryGame[]>(() => loadHistory());

  return (
    <section
      data-testid="progression-panel"
      style={flush ? { fontFamily: PANEL.fontFamily } : { ...PANEL, padding: 20 }}
    >
      {!flush && <h2 style={{ margin: '0 0 12px', fontWeight: 800 }}>Your progress</h2>}

      {p.gamesPlayed === 0 ? (
        <p data-testid="progression-empty" style={{ margin: 0, color: 'var(--mut)', fontSize: 13.5 }}>
          {games.length > 0
            ? // Watch games are recorded but have no local player, so they leave a
              // history without touching these counters. Saying "no games yet" over
              // a list of games would just look broken.
              'Nothing tracked yet — these count games you played, not ones you watched.'
            : 'No games yet — finish a game vs the computer to start tracking wins, streaks and best scores.'}
        </p>
      ) : (
        <>
          {playedVariants.length > 1 && (
            <div
              data-testid="progression-variant-switch"
              role="tablist"
              style={{ display: 'flex', gap: 6, margin: '0 0 12px' }}
            >
              {playedVariants.map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={v === variant}
                  data-testid={`progression-variant-${v}`}
                  onClick={() => setVariant(v)}
                  style={{
                    ...WELL_ROW,
                    padding: '4px 11px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border:
                      v === variant ? '1px solid var(--brass)' : '1px solid transparent',
                    color: v === variant ? 'var(--ink)' : 'var(--mut)',
                  }}
                >
                  {VARIANT_LABEL[v]}
                </button>
              ))}
            </div>
          )}
          {/* Three headline tiles + a one-line streak read: five equal tiles wrapped
              to an orphaned second row and buried the lead (P28). */}
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
            <Stat label="Games" value={String(p.gamesPlayed)} testid="stat-games" />
            <Stat label="Win rate" value={pct(winRate(p.gamesPlayed, p.wins))} testid="stat-winrate" />
            <Stat
              label="Best score"
              value={best?.value ?? '—'}
              title={best?.title}
              testid="stat-best-score"
            />
          </div>
          <p style={{ margin: '0 0 14px', color: 'var(--mut)', fontSize: 13 }}>
            Streak:{' '}
            <strong data-testid="stat-streak" style={{ color: 'var(--ink)', fontFamily: FONT_MONO }}>
              {p.currentStreak}
            </strong>{' '}
            current ·{' '}
            <strong data-testid="stat-best-streak" style={{ color: 'var(--ink)', fontFamily: FONT_MONO }}>
              {p.bestStreak}
            </strong>{' '}
            best
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DIFFICULTIES.map((d) => {
              const t = p.perTier[variant][d];
              const beaten = p.firstWinTiers[variant].includes(d);
              return (
                <div key={d} data-testid={`tier-stat-${d}`} style={{ ...WELL_ROW, fontSize: 13 }}>
                  <span style={{ minWidth: 78, fontWeight: 600 }}>{cap(d)}</span>
                  <span style={{ fontFamily: FONT_MONO, color: 'var(--mut)' }}>
                    {t.won}/{t.played}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: FONT_MONO }}>{pct(winRate(t.played, t.won))}</span>
                  {beaten && (
                    <span
                      title="First win earned"
                      aria-label="First win earned"
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 9,
                        letterSpacing: '.1em',
                        background: 'var(--brass)',
                        color: '#fff',
                        borderRadius: 999,
                        padding: '3px 7px',
                      }}
                    >
                      ★ BEATEN
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {p.perfectClears[variant] > 0 && (
            <p data-testid="stat-perfect-clears" style={{ margin: '12px 0 0', color: 'var(--mut)', fontSize: 13 }}>
              Perfect clears: <strong style={{ color: 'var(--ink)' }}>{p.perfectClears[variant]}</strong>
            </p>
          )}
        </>
      )}

      {/* Outside the empty-state branch on purpose: a watch game records history
          but no progression (it has no local player), so a viewer with only
          watched games still has games to look back at. */}
      <GameHistory games={games} onReview={onReviewGame} />
    </section>
  );
}
