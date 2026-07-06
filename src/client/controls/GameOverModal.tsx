import type { Color } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { FONT_MONO, FONT_UI } from '../theme';
import { usePaletteColors } from '../palettes';
import { useSessionActions } from '../lobby/sessionContext';

export interface GameOverPayload {
  colors: Record<Color, number>;
  players: Record<string, number>;
  winners: string[];
}

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

export function GameOverModal({
  gameover,
  winnerColors = [],
}: {
  gameover: GameOverPayload;
  /** Colors owned by a winning player — get the WINNER tag. */
  winnerColors?: Color[];
}) {
  const actions = useSessionActions();
  const colors = usePaletteColors();
  const winnerColorSet = new Set(winnerColors);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--pnl)',
          color: 'var(--ink)',
          padding: 26,
          borderRadius: 16,
          minWidth: 320,
          border: '1px solid var(--pnl-bd)',
          fontFamily: FONT_UI,
          boxShadow: '0 24px 48px rgba(15,9,3,.5)',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontWeight: 900 }}>Game over</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--mut)' }}>
          Winner{gameover.winners.length > 1 ? 's' : ''}:{' '}
          <strong style={{ color: 'var(--ink)' }}>
            {gameover.winners.map((w) => `P${w}`).join(', ')}
          </strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {COLOR_ORDER.map((c) => {
            const isWinner = winnerColorSet.has(c);
            return (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  background: 'var(--well)',
                  borderRadius: 8,
                  padding: '7px 11px',
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: colors[c],
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
                  }}
                />
                <span style={{ fontWeight: 600 }}>{cap(c)}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>{gameover.colors[c]}</span>
                {isWinner && (
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      letterSpacing: '.12em',
                      background: 'var(--brass)',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '3px 8px',
                    }}
                  >
                    WINNER
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--mut)' }}>
          {Object.entries(gameover.players)
            .map(([p, v]) => `P${p}: ${v}`)
            .join(' · ')}
        </div>
        {actions && (
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button
              data-testid="play-again"
              onClick={actions.onPlayAgain}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontFamily: FONT_UI,
                fontWeight: 600,
                background: '#3468cf',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Play again
            </button>
            <button
              data-testid="leave-gameover"
              onClick={actions.onLeave}
              style={{
                borderRadius: 10,
                padding: '10px 18px',
                fontFamily: FONT_UI,
                border: '1px solid var(--pnl-bd)',
                background: 'var(--well)',
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
