import type { Color } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { usePaletteColors } from '../palettes';
import { useSessionActions } from '../lobby/sessionContext';

export interface GameOverPayload {
  colors: Record<Color, number>;
  players: Record<string, number>;
  winners: string[];
}

export function GameOverModal({ gameover }: { gameover: GameOverPayload }) {
  const actions = useSessionActions();
  const colors = usePaletteColors();
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
          background: 'var(--surface)',
          color: 'var(--fg)',
          padding: 24,
          borderRadius: 8,
          minWidth: 280,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Game over</h2>
        <p>
          Winner{gameover.winners.length > 1 ? 's' : ''}:{' '}
          <strong>{gameover.winners.map((w) => `P${w}`).join(', ')}</strong>
        </p>
        <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {COLOR_ORDER.map((c) => (
              <tr key={c}>
                <td style={{ color: colors[c], textTransform: 'capitalize', paddingRight: 12 }}>
                  {c}
                </td>
                <td>{gameover.colors[c]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 14 }}>
          Players:{' '}
          {Object.entries(gameover.players)
            .map(([p, v]) => `P${p}: ${v}`)
            .join(' · ')}
        </div>
        {actions && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button data-testid="play-again" onClick={actions.onPlayAgain}>
              Play again
            </button>
            <button data-testid="leave-gameover" onClick={actions.onLeave}>
              Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
