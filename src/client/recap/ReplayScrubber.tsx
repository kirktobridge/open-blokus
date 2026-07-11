import { useEffect, useMemo, useState } from 'react';
import type { Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import type { GameRecord } from '../../game/ai/selfplay';
import { buildRecap } from '../../game/recap';
import { Board } from '../board/Board';
import { ScoreTimeline } from './ScoreTimeline';
import { usePaletteColors } from '../palettes';
import { CELL_PX, FONT_MONO, FONT_UI, SECONDARY_BTN } from '../theme';

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

const BOARD_PX = BOARD_SIZE * CELL_PX;
const BOARD_SCALE = 0.5;

/**
 * Post-game replay scrubber (product P2 R0) — step through the game move by move
 * and watch the score-over-time timeline to see "when did I fall behind?". A
 * standalone modal over a finished `GameRecord`, so it serves both the game-over
 * "Review game" entry point here and P15 M2's history-list replay. No AI/eval —
 * every frame is a pure replay of the recorded moves (src/game/recap.ts).
 */
export function ReplayScrubber({ record, onClose }: { record: GameRecord; onClose: () => void }) {
  const colors = usePaletteColors();
  const frames = useMemo(() => buildRecap(record), [record]);
  const lastPly = frames.length - 1;
  const [ply, setPly] = useState(lastPly); // open on the final position

  const clamp = (p: number) => Math.max(0, Math.min(lastPly, p));
  const frame = frames[ply];

  // Arrow keys step; Home/End jump to the ends; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPly((p) => clamp(p - 1));
      else if (e.key === 'ArrowRight') setPly((p) => clamp(p + 1));
      else if (e.key === 'Home') setPly(0);
      else if (e.key === 'End') setPly(lastPly);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPly]);

  const caption = frame.move
    ? `Move ${ply} — ${cap(frame.move.color)} played ${frame.move.pieceId}`
    : 'Start — empty board';

  // Colors that took part, ordered by squares placed at the current ply (leader first).
  const legend = useMemo(
    () =>
      (Object.keys(frame.placed) as Color[])
        .filter((c) => frames[lastPly].placed[c] > 0)
        .sort((a, b) => frame.placed[b] - frame.placed[a]),
    [frame, frames, lastPly],
  );

  return (
    <div
      data-testid="replay-scrubber"
      role="dialog"
      aria-label="Game replay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 16,
        fontFamily: FONT_UI,
      }}
    >
      <div
        style={{
          background: 'var(--pnl)',
          color: 'var(--ink)',
          padding: 22,
          borderRadius: 16,
          width: 'min(520px, 96vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid var(--pnl-bd)',
          boxShadow: '0 24px 48px rgba(15,9,3,.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: 20 }}>Review game</h2>
          <span style={{ flex: 1 }} />
          <button
            data-testid="close-scrubber"
            onClick={onClose}
            aria-label="Close replay"
            style={{ ...SECONDARY_BTN, fontSize: 13, padding: '5px 12px' }}
          >
            Close
          </button>
        </div>

        {/* Board at the current ply, last move highlighted. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div
            style={{
              background: 'linear-gradient(160deg, var(--frame-a), var(--frame-b))',
              borderRadius: 12,
              padding: 9,
              boxShadow: 'inset 0 1px 0 var(--frame-hi), 0 16px 30px rgba(15,9,3,.4)',
            }}
          >
            <div style={{ width: BOARD_PX * BOARD_SCALE, height: BOARD_PX * BOARD_SCALE, overflow: 'hidden', borderRadius: 5 }}>
              <div style={{ transform: `scale(${BOARD_SCALE})`, transformOrigin: 'top left', width: BOARD_PX, height: BOARD_PX }}>
                <Board
                  board={frame.board}
                  activeColor={frame.move?.color ?? 'blue'}
                  lastMove={frame.moveCells}
                />
              </div>
            </div>
          </div>
        </div>

        <p data-testid="scrubber-caption" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, color: 'var(--mut)' }}>
          {caption}
        </p>

        {/* Score-over-time timeline (click/drag to seek). */}
        <div style={{ marginBottom: 6 }}>
          <ScoreTimeline frames={frames} ply={ply} colors={colors} onSeek={(p) => setPly(clamp(p))} />
        </div>

        {/* Leaderboard at this ply — squares placed, leader first. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 12 }}>
          {legend.map((c) => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: colors[c] }} />
              <span>{cap(c)}</span>
              <span style={{ fontFamily: FONT_MONO, color: 'var(--mut)' }}>{frame.placed[c]}</span>
            </span>
          ))}
        </div>

        {/* Transport: first / prev / slider / next / last. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button data-testid="scrubber-first" onClick={() => setPly(0)} disabled={ply === 0} aria-label="First move" style={stepBtn}>
            ⏮
          </button>
          <button data-testid="scrubber-prev" onClick={() => setPly((p) => clamp(p - 1))} disabled={ply === 0} aria-label="Previous move" style={stepBtn}>
            ◀
          </button>
          <input
            data-testid="scrubber-slider"
            type="range"
            min={0}
            max={lastPly}
            value={ply}
            onChange={(e) => setPly(clamp(Number(e.target.value)))}
            aria-label="Move"
            style={{ flex: 1 }}
          />
          <button data-testid="scrubber-next" onClick={() => setPly((p) => clamp(p + 1))} disabled={ply === lastPly} aria-label="Next move" style={stepBtn}>
            ▶
          </button>
          <button data-testid="scrubber-last" onClick={() => setPly(lastPly)} disabled={ply === lastPly} aria-label="Last move" style={stepBtn}>
            ⏭
          </button>
          <span data-testid="scrubber-ply" style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--mut)', width: 54, textAlign: 'right' }}>
            {ply} / {lastPly}
          </span>
        </div>
      </div>
    </div>
  );
}

const stepBtn = {
  ...SECONDARY_BTN,
  fontSize: 13,
  padding: '5px 10px',
  minWidth: 34,
} as const;
