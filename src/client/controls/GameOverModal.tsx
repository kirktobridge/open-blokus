import { useEffect, useState } from 'react';
import type { Color, GameState } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX, FONT_MONO, FONT_UI, SECONDARY_BTN } from '../theme';
import { usePaletteColors } from '../palettes';
import { useSessionActions } from '../lobby/sessionContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Board } from '../board/Board';
import { CountUp } from './CountUp';
import { revealRows, resultSummary } from '../drama';

export interface GameOverPayload {
  colors: Record<Color, number>;
  players: Record<string, number>;
  winners: string[];
}

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/** Board pixel size and the mosaic's shrink factor for the reveal. */
const BOARD_PX = BOARD_SIZE * CELL_PX;
const MOSAIC_SCALE = 0.42;

/**
 * Game-over reveal (P16) — the win ceremony that replaces the old static table.
 * The finished board is presented as a framed mosaic with the winner's pieces
 * glowing; score bars race out and the scores count up; a "Copy result" button
 * makes the outcome shareable as text.
 */
export function GameOverModal({
  G,
  gameover,
  winnerColors = [],
}: {
  G: GameState;
  gameover: GameOverPayload;
  /** Colors owned by a winning player — glow in the mosaic + get the WINNER tag. */
  winnerColors?: Color[];
}) {
  const actions = useSessionActions();
  const colors = usePaletteColors();
  const reduce = useReducedMotion();

  const rows = revealRows(G, gameover);
  const maxPlaced = Math.max(1, ...rows.map((r) => r.placed));
  const winnerNames = rows.filter((r) => r.isWinner).map((r) => cap(r.color));

  // Bars/counters start at zero and settle to their targets one frame after
  // mount, so the reveal animates in. Reduced motion skips straight to the end.
  const [revealed, setRevealed] = useState(reduce);
  useEffect(() => {
    if (reduce) {
      setRevealed(true);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [reduce]);

  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const share = async () => {
    const text = resultSummary(G, gameover);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFallback(text);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--pnl)',
          color: 'var(--ink)',
          padding: 26,
          borderRadius: 16,
          minWidth: 340,
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--pnl-bd)',
          fontFamily: FONT_UI,
          boxShadow: '0 24px 48px rgba(15,9,3,.5)',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontWeight: 900 }}>Game over</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--mut)' }}>
          {winnerNames.length === 0 ? (
            'No winner.'
          ) : (
            <>
              Winner{winnerNames.length > 1 ? 's' : ''}:{' '}
              <strong style={{ color: 'var(--ink)' }}>{winnerNames.join(' & ')}</strong>
            </>
          )}
        </p>

        {/* Finished board as a framed, shareable mosaic (winners glow). */}
        <div
          data-testid="reveal-mosaic"
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              background: 'linear-gradient(160deg, var(--frame-a), var(--frame-b))',
              borderRadius: 12,
              padding: 10,
              boxShadow: 'inset 0 1px 0 var(--frame-hi), 0 16px 30px rgba(15,9,3,.4)',
            }}
          >
            <div
              style={{
                width: BOARD_PX * MOSAIC_SCALE,
                height: BOARD_PX * MOSAIC_SCALE,
                overflow: 'hidden',
                borderRadius: 5,
              }}
            >
              <div
                style={{
                  transform: `scale(${MOSAIC_SCALE})`,
                  transformOrigin: 'top left',
                  width: BOARD_PX,
                  height: BOARD_PX,
                }}
              >
                <Board board={G.board} activeColor={rows[0].color} glowColors={winnerColors} />
              </div>
            </div>
          </div>
        </div>

        {/* Racing score bars — one per color, winners emphasized. */}
        <div data-testid="reveal-bars" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.color} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 4,
                  background: colors[r.color],
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
                  flexShrink: 0,
                }}
              />
              <span style={{ width: 52, fontWeight: 600, fontSize: 13 }}>{cap(r.color)}</span>
              <div
                style={{
                  flex: 1,
                  height: 14,
                  background: 'var(--well)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(revealed ? r.placed / maxPlaced : 0) * 100}%`,
                    background: colors[r.color],
                    borderRadius: 999,
                    transition: reduce
                      ? undefined
                      : `width 850ms cubic-bezier(.22,1,.36,1) ${i * 110}ms`,
                    boxShadow: r.isWinner ? `0 0 10px ${colors[r.color]}` : undefined,
                  }}
                />
              </div>
              <CountUp
                value={revealed ? r.score : 0}
                style={{
                  fontFamily: FONT_MONO,
                  fontWeight: 700,
                  fontSize: 14,
                  width: 30,
                  textAlign: 'right',
                }}
              />
              {/* Fixed-width trailing slot so every row's bar track ends at the
                  same x — otherwise the winner's inline tag shrinks its track and
                  the 100%-coverage bar reads as the shortest. */}
              <span style={{ width: 58, flexShrink: 0, textAlign: 'right' }}>
                {r.isWinner && (
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      letterSpacing: '.12em',
                      background: 'var(--brass)',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '3px 7px',
                    }}
                  >
                    WINNER
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Per-player totals (matters for 2p, where one human owns two colors). */}
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--mut)' }}>
          {Object.entries(gameover.players)
            .map(([p, v]) => `P${p}: ${v}`)
            .join(' · ')}
        </div>

        {fallback ? (
          <textarea
            data-testid="result-text"
            readOnly
            value={fallback}
            onFocus={(e) => e.currentTarget.select()}
            rows={2}
            style={{ ...SECONDARY_BTN, cursor: 'text', width: '100%', marginTop: 14, resize: 'none' }}
          />
        ) : null}

        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            data-testid="copy-result"
            onClick={share}
            style={{ ...SECONDARY_BTN, fontSize: 13 }}
          >
            {copied ? 'Copied ✓' : 'Copy result'}
          </button>
          <span style={{ flex: 1 }} />
          {actions && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
