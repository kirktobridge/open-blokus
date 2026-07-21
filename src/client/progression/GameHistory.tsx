import { FONT_MONO, WELL_ROW } from '../theme';
import { summarize, type HistoryGame } from '../log/history';

/**
 * Game history list (P15 M2) — the per-game residue under M1's lifetime counters.
 * The counters say what you've done overall; this says which games they were, and
 * hands any of them to the review table.
 *
 * The list is read by the host panel, which also needs to know whether any games
 * exist to word its own empty state — one read, one answer.
 */
export function GameHistory({
  games,
  onReview,
}: {
  games: HistoryGame[];
  onReview?: (game: HistoryGame) => void;
}) {
  if (games.length === 0) return null;

  return (
    <section data-testid="game-history" style={{ marginTop: 16 }}>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 11.5,
          color: 'var(--mut)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
        }}
      >
        Recent games
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {games.map((g) => {
          const { outcome, yourScore, scoreUnit, lineup, moves } = summarize(g);
          return (
            <div key={g.id} data-testid="history-row" style={{ ...WELL_ROW, fontSize: 13 }}>
              <span style={{ color: 'var(--mut)', minWidth: 52, fontSize: 12 }}>
                {new Date(g.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span style={{ fontWeight: 600, minWidth: 96 }}>{lineup}</span>
              <span
                data-testid="history-outcome"
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '.1em',
                  borderRadius: 999,
                  padding: '3px 7px',
                  // Won earns the brass; the rest stay quiet — a list of losses
                  // shouldn't read as a wall of alarm.
                  background: outcome === 'won' ? 'var(--brass)' : 'transparent',
                  color: outcome === 'won' ? '#fff' : 'var(--mut)',
                  border: outcome === 'won' ? 'none' : '1px solid var(--top-bd)',
                }}
              >
                {outcome.toUpperCase()}
              </span>
              <span style={{ flex: 1 }} />
              <span
                data-testid="history-score"
                title={
                  yourScore == null
                    ? `${moves} moves`
                    : scoreUnit === 'left'
                      ? `${yourScore} squares left — lower is better · ${moves} moves`
                      : `${yourScore} points · ${moves} moves`
                }
                style={{ fontFamily: FONT_MONO, color: 'var(--mut)' }}
              >
                {yourScore == null ? '—' : `${yourScore} ${scoreUnit}`}
              </span>
              {onReview && (
                <button
                  data-testid="history-review"
                  onClick={() => onReview(g)}
                  style={{
                    border: '1px solid var(--top-bd)',
                    background: 'none',
                    borderRadius: 8,
                    padding: '4px 9px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  Review
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
