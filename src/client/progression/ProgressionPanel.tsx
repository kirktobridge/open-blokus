import { DIFFICULTIES } from '../ai/difficulty';
import { FONT_MONO, PANEL, WELL_ROW } from '../theme';
import { useProgression, winRate } from './progression';

/**
 * Home-screen "Your progress" card (P15 M1). Lifetime residue of local vs-AI
 * play: games, overall win rate, best score, streaks, and a per-tier win-rate
 * breakdown that makes the difficulty ladder feel earned. Empty until the first
 * recorded game. Reads the localStorage store via useProgression.
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 72 }}>
      <span data-testid={testid} style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700 }}>
        {value}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </span>
    </div>
  );
}

export function ProgressionPanel() {
  const p = useProgression();

  return (
    <section data-testid="progression-panel" style={{ ...PANEL, padding: 20 }}>
      <h2 style={{ margin: '0 0 12px', fontWeight: 800 }}>Your progress</h2>

      {p.gamesPlayed === 0 ? (
        <p data-testid="progression-empty" style={{ margin: 0, color: 'var(--mut)', fontSize: 13.5 }}>
          No games yet — finish a game vs the computer to start tracking wins, streaks and best scores.
        </p>
      ) : (
        <>
          {/* Three headline tiles + a one-line streak read: five equal tiles wrapped
              to an orphaned second row and buried the lead (P28). */}
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
            <Stat label="Games" value={String(p.gamesPlayed)} testid="stat-games" />
            <Stat label="Win rate" value={pct(winRate(p.gamesPlayed, p.wins))} testid="stat-winrate" />
            <Stat label="Best score" value={p.bestScore == null ? '—' : String(p.bestScore)} testid="stat-best-score" />
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
              const t = p.perTier[d];
              const beaten = p.firstWinTiers.includes(d);
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

          {p.perfectClears > 0 && (
            <p data-testid="stat-perfect-clears" style={{ margin: '12px 0 0', color: 'var(--mut)', fontSize: 13 }}>
              Perfect clears: <strong style={{ color: 'var(--ink)' }}>{p.perfectClears}</strong>
            </p>
          )}
        </>
      )}
    </section>
  );
}
