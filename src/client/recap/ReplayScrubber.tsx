import { useEffect, useMemo, useState } from 'react';
import type { Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import type { GameRecord } from '../../game/ai/selfplay';
import { buildRecap } from '../../game/recap';
import { Board } from '../board/Board';
import { TURNS_TO_BOTTOM_RIGHT, humanColor } from '../board/orientation';
import { ScoreTimeline } from './ScoreTimeline';
import { MobilityTimeline } from './MobilityTimeline';
import { CELL_PX, FONT_MONO, FONT_UI, PIECE_VAR, SECONDARY_BTN } from '../theme';

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

const BOARD_PX = BOARD_SIZE * CELL_PX;
const BOARD_SCALE = 0.5;

// Auto-play (P2 R0.1): one ply per BASE_STEP_MS at 1×, faster at 2×/5×.
type Speed = 1 | 2 | 5;
const SPEEDS: readonly Speed[] = [1, 2, 5];
const BASE_STEP_MS = 1600;

/**
 * Post-game replay scrubber (product P2 R0) — step through the game move by move
 * and watch the over-time plots: score ("when did I fall behind?") and mobility
 * ("when did my room collapse?", P34 M1). A
 * standalone modal over a finished `GameRecord`, so it serves both the game-over
 * "Review game" entry point here and P15 M2's history-list replay. No AI/eval —
 * every frame is a pure replay of the recorded moves (src/game/recap.ts).
 */
export function ReplayScrubber({ record, onClose }: { record: GameRecord; onClose: () => void }) {
  const frames = useMemo(() => buildRecap(record), [record]);
  const lastPly = frames.length - 1;
  const [ply, setPly] = useState(lastPly); // open on the final position
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const clamp = (p: number) => Math.max(0, Math.min(lastPly, p));
  const frame = frames[ply];

  // Show the board in the same orientation the player saw: their color's corner
  // bottom-right (matches the play screen's default). All-AI records leave it upright.
  const home = humanColor(record.seats);
  const boardTurns = home ? TURNS_TO_BOTTOM_RIGHT[home] : 0;

  // Any manual navigation pauses playback so it never fights the timer.
  const seekTo = (p: number) => {
    setPlaying(false);
    setPly(clamp(p));
  };
  const step = (d: number) => {
    setPlaying(false);
    setPly((p) => clamp(p + d));
  };
  // Play from the start if we're parked at the end; otherwise just toggle.
  const togglePlay = () => {
    setPly((p) => (p >= lastPly ? 0 : p));
    setPlaying((pl) => !pl);
  };
  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);

  // Auto-advance while playing; the timer rate scales with the chosen speed.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setPly((p) => clamp(p + 1)), BASE_STEP_MS / speed);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, lastPly]);

  // Stop cleanly when playback reaches the final position.
  useEffect(() => {
    if (playing && ply >= lastPly) setPlaying(false);
  }, [playing, ply, lastPly]);

  // Arrow keys step; Home/End jump to the ends; Space toggles play; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Home') seekTo(0);
      else if (e.key === 'End') seekTo(lastPly);
      else if (e.key === ' ') togglePlay();
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
                {/* Rotate to the player's orientation; the board is square, so a
                    quarter-turn about center stays within the same box. */}
                <div style={{ transform: `rotate(${boardTurns * 90}deg)`, transformOrigin: 'center', width: BOARD_PX, height: BOARD_PX }}>
                  <Board
                    board={frame.board}
                    activeColor={frame.move?.color ?? 'blue'}
                    lastMove={frame.moveCells}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <p data-testid="scrubber-caption" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, color: 'var(--mut)' }}>
          {caption}
        </p>

        {/* Two seekable over-time plots (click/drag either to seek): squares placed,
            and mobility — "room" — which is what actually diverges mid-game (P34 M1). */}
        <div style={{ marginBottom: 6 }}>
          <p style={chartLabel}>Score — squares placed</p>
          <ScoreTimeline frames={frames} ply={ply} onSeek={seekTo} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <p style={chartLabel}>Room — open corners to play into</p>
          <MobilityTimeline frames={frames} ply={ply} onSeek={seekTo} />
        </div>

        {/* Standings at this ply — squares placed, ranked vertically leader-first
            so the order reads top-to-bottom (re-ranks as you scrub). */}
        <div
          data-testid="scrubber-standings"
          style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 240, margin: '0 auto 12px' }}
        >
          {legend.map((c, i) => (
            <div key={c} data-testid={`rank-${c}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontFamily: FONT_MONO, color: 'var(--mut)', width: 16, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: PIECE_VAR[c] }} />
              <span style={{ flex: 1 }}>{cap(c)}</span>
              <span style={{ fontFamily: FONT_MONO, color: 'var(--mut)' }}>{frame.placed[c]}</span>
            </div>
          ))}
        </div>

        {/* Playback: play/pause + a compact speed toggle that cycles 1× → 2× → 5×. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            data-testid="scrubber-play"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            style={{ ...stepBtn, minWidth: 78, fontWeight: 800 }}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button
            data-testid="scrubber-speed"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}×, tap to change`}
            title="Playback speed"
            style={{ ...stepBtn, minWidth: 40, fontFamily: FONT_MONO, fontWeight: 800 }}
          >
            {speed}×
          </button>
          <span style={{ flex: 1 }} />
        </div>

        {/* Transport: first / prev / slider / next / last. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button data-testid="scrubber-first" onClick={() => seekTo(0)} disabled={ply === 0} aria-label="First move" style={stepBtn}>
            ⏮
          </button>
          <button data-testid="scrubber-prev" onClick={() => step(-1)} disabled={ply === 0} aria-label="Previous move" style={stepBtn}>
            ◀
          </button>
          <input
            data-testid="scrubber-slider"
            type="range"
            min={0}
            max={lastPly}
            value={ply}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Move"
            style={{ flex: 1 }}
          />
          <button data-testid="scrubber-next" onClick={() => step(1)} disabled={ply === lastPly} aria-label="Next move" style={stepBtn}>
            ▶
          </button>
          <button data-testid="scrubber-last" onClick={() => seekTo(lastPly)} disabled={ply === lastPly} aria-label="Last move" style={stepBtn}>
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

const chartLabel = {
  margin: '0 0 2px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: 'var(--mut)',
} as const;
