import type { Color } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { COLOR_HEX } from '../theme';

export interface GameOverPayload {
  colors: Record<Color, number>;
  players: Record<string, number>;
  winners: string[];
}

export function GameOverModal({ gameover }: { gameover: GameOverPayload }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
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
                <td style={{ color: COLOR_HEX[c], textTransform: 'capitalize', paddingRight: 12 }}>
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
      </div>
    </div>
  );
}
