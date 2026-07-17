import { useEffect } from 'react';
import type { Color } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import type { GameRecord } from '../../game/ai/selfplay';
import { Board } from '../board/Board';
import { BoardFrame } from '../board/BoardFrame';
import { TURNS_TO_BOTTOM_RIGHT, humanColor } from '../board/orientation';
import { PlayerCard, type SeatTag } from '../controls/PlayerCard';
import { HandTray } from '../tray/HandTray';
import { ScoreTimeline } from './ScoreTimeline';
import { MobilityTimeline } from './MobilityTimeline';
import { useReplay } from './useReplay';
import { usePrefs } from '../settings';
import { useSessionActions } from '../lobby/sessionContext';
import { FONT_MONO, FONT_UI, SECONDARY_BTN } from '../theme';

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/**
 * Post-game review as a *mode of the game table itself* (product P2 R0.2) — the
 * scrubber dissolved into the play surface. The four player cards, the full-size
 * board (same walnut frame as play, via `BoardFrame`) and the hand tray all
 * re-render from the scrubbed ply's `RecapFrame`, not the final position; the
 * action bar is replaced by the transport and the right rail swaps standings for
 * the score + mobility timelines. Renders purely from a `GameRecord` — no live
 * client — so it doubles as the standalone shell P15 M2's history replay reuses.
 * Offline vs-AI only (a `GameRecord` is only ever built by the local AI table).
 */
export function ReviewTable({
  record,
  onExitReview,
}: {
  record: GameRecord;
  /** Re-show the game-over ceremony ("Back to results"). */
  onExitReview?: () => void;
}) {
  const { frame, frames, ply, lastPly, playing, speed, seekTo, step, togglePlay, cycleSpeed } =
    useReplay(record);
  const actions = useSessionActions();
  const inventoryDisplay = usePrefs().inventoryDisplay;

  // Show the board in the orientation the player saw: their color's corner
  // bottom-right (matches play). All-AI watch records leave it upright.
  const home = humanColor(record.seats);
  const boardTurns = home ? TURNS_TO_BOTTOM_RIGHT[home] : 0;

  // Arrow keys step; Home/End jump to the ends; Space toggles play; Esc back to results.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Home') seekTo(0);
      else if (e.key === 'End') seekTo(lastPly);
      else if (e.key === ' ') togglePlay();
      else if (e.key === 'Escape') onExitReview?.();
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

  /** Name suffix + WINNER pill for a seat, from the record. */
  function seatMeta(c: Color): { nameSuffix: string | null; tag: SeatTag } {
    const seat = record.seats[c];
    const nameSuffix = seat === 'human' ? 'You' : seat && seat !== 'shared' ? seat : null;
    const tag: SeatTag = record.winners.includes(c) ? 'winner' : null;
    return { nameSuffix, tag };
  }

  return (
    <div
      data-testid="review-table"
      style={{
        display: 'flex',
        gap: 22,
        padding: '8px 26px 24px',
        fontFamily: FONT_UI,
        color: 'var(--ink)',
        alignItems: 'flex-start',
        justifyContent: 'center',
        flexWrap: 'wrap',
        background: 'var(--table-bg)',
        boxSizing: 'border-box',
      }}
    >
      {/* Left column — player cards, re-rendered from the scrubbed ply. The color
          that just moved lifts (active keyline); winners keep their WINNER pill. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 250 }}>
        {COLOR_ORDER.map((c) => {
          const { nameSuffix, tag } = seatMeta(c);
          return (
            <PlayerCard
              key={c}
              color={c}
              state={frame.colors[c]}
              nameSuffix={nameSuffix}
              tag={tag}
              active={c === frame.move?.color}
              inventoryDisplay={inventoryDisplay}
            />
          );
        })}
      </div>

      {/* Center column — full-size board in the play frame + caption + transport. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <BoardFrame>
          <div
            style={{
              transform: `rotate(${boardTurns * 90}deg)`,
              transformOrigin: 'center',
              transition: 'transform 0.2s ease',
              display: 'inline-block',
              verticalAlign: 'top',
            }}
          >
            <Board
              board={frame.board}
              activeColor={frame.move?.color ?? 'blue'}
              lastMove={frame.moveCells}
            />
          </div>
        </BoardFrame>

        <p
          data-testid="scrubber-caption"
          role="status"
          style={{ margin: 0, fontSize: 13, color: 'var(--top-mut)', textAlign: 'center' }}
        >
          {caption}
        </p>

        {/* Transport (replaces the play action bar): play/pause + speed. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            data-testid="scrubber-play"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            style={{ ...stepBtn, minWidth: 82, fontWeight: 800 }}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button
            data-testid="scrubber-speed"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}×, tap to change`}
            title="Playback speed"
            style={{ ...stepBtn, minWidth: 44, fontFamily: FONT_MONO, fontWeight: 800 }}
          >
            {speed}×
          </button>
        </div>

        {/* Transport: first / prev / slider / next / last + ply readout. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'min(560px, 90vw)' }}>
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

        {/* Session exits (the ceremony's Play again / Leave are dismissed with it). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          {onExitReview && (
            <button data-testid="review-results" onClick={onExitReview} style={{ ...SECONDARY_BTN, fontSize: 13 }}>
              Back to results
            </button>
          )}
          {actions && (
            <button
              data-testid="review-play-again"
              onClick={actions.onPlayAgain}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '9px 16px',
                fontFamily: FONT_UI,
                fontWeight: 600,
                background: '#3468cf',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Play again
            </button>
          )}
        </div>
      </div>

      {/* Right column — timelines stacked, hand tray below as reference (R0.2 c). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            width: 300,
            background: 'var(--pnl)',
            border: '1px solid var(--pnl-bd)',
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: '0 14px 28px rgba(15,9,3,.32)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div>
            <p style={chartLabel}>Score — squares placed</p>
            <ScoreTimeline frames={frames} ply={ply} onSeek={seekTo} />
          </div>
          <div>
            <p style={chartLabel}>Open Corners — room to play into</p>
            <MobilityTimeline frames={frames} ply={ply} onSeek={seekTo} />
          </div>
        </div>
        {home && (
          <HandTray color={home} state={frame.colors[home]} interactive={false} selectedId={null} />
        )}
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
