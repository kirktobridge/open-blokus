import type { GameState } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { remainingSquares, scorePlayers } from '../../game/scoring';
import { usePaletteColors } from '../palettes';

/** Live remaining-square counts per color and aggregated player totals. */
export function ScorePanel({ G }: { G: GameState }) {
  const players = scorePlayers(G);
  const colors = usePaletteColors();
  return (
    <div>
      <h3 style={{ margin: '0 0 4px' }}>Scores ({G.config.scoring})</h3>
      <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {COLOR_ORDER.map((c) => {
            const owner = G.config.owners[c];
            return (
              <tr key={c}>
                <td style={{ color: colors[c], textTransform: 'capitalize', paddingRight: 12 }}>
                  {c}
                </td>
                <td style={{ paddingRight: 12 }}>{remainingSquares(G.colors[c])} left</td>
                <td>{owner === 'shared' ? 'shared' : `P${owner}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        {Object.entries(players)
          .map(([p, v]) => `P${p}: ${v}`)
          .join(' · ')}
      </div>
    </div>
  );
}
