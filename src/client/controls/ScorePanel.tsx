import type { GameState } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { remainingSquares } from '../../game/scoring';
import { FONT_MONO, PIECE_VAR } from '../theme';
import { CountUp } from './CountUp';

/**
 * Compact standings strip: one chip per color, sorted ascending by remaining
 * squares (fewest = leading). The leader is ringed in brass.
 */
export function Standings({
  G,
  showLeader = true,
  divider = true,
}: {
  G: GameState;
  showLeader?: boolean;
  /** Rule above the header — off when nothing sits above it in the panel (P48). */
  divider?: boolean;
}) {
  const ranked = [...COLOR_ORDER].sort(
    (a, b) => remainingSquares(G.colors[a]) - remainingSquares(G.colors[b]),
  );
  const best = remainingSquares(G.colors[ranked[0]]);

  return (
    <div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9.5,
          fontWeight: 900,
          letterSpacing: '.15em',
          color: 'var(--mut)',
          margin: '0 0 8px',
          borderTop: divider ? '1px solid var(--pnl-bd)' : undefined,
          paddingTop: divider ? 10 : 0,
        }}
      >
        REMAINING SQUARES
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {ranked.map((c) => {
          const rem = remainingSquares(G.colors[c]);
          const leader = showLeader && rem === best;
          return (
            <div
              key={c}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--well)',
                borderRadius: 8,
                padding: '6px 9px',
                border: leader ? '1px solid var(--brass)' : '1px solid transparent',
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: PIECE_VAR[c],
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)',
                }}
              />
              <CountUp
                value={rem}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
