import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { Color } from '../../game/types';
import { VARIANTS } from '../../game/modes';
import type { GameRecord } from '../../game/ai/selfplay';
import { Board } from '../board/Board';
import { BoardFrame } from '../board/BoardFrame';
import { TURNS_TO_BOTTOM_RIGHT, humanColor } from '../board/orientation';
import { PlayerCard, type SeatTag } from '../controls/PlayerCard';
import { HandTray } from '../tray/HandTray';
import { RailColumn, RailPanel } from '../rail/RailPanel';
import { ScoreTimeline } from './ScoreTimeline';
import { MobilityTimeline } from './MobilityTimeline';
import { useReplay } from './useReplay';
import { usePrefs } from '../settings';
import { useSessionActions } from '../lobby/sessionContext';
import { DOCK_COLUMN_W, FONT_MONO, FONT_UI, SECONDARY_BTN } from '../theme';

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
  exitLabel = 'Results',
}: {
  record: GameRecord;
  /** Leave review: back to the game-over ceremony, or out of a standalone replay. */
  onExitReview?: () => void;
  /**
   * What leaving goes back to. Defaults to the ceremony this review dropped out of;
   * a game opened from the history list (P15 M2) has no ceremony behind it, so it
   * names its own way back instead of promising results that aren't there.
   */
  exitLabel?: string;
}) {
  const { frame, frames, ply, lastPly, playing, speed, seekTo, step, togglePlay, cycleSpeed } =
    useReplay(record);
  const actions = useSessionActions();
  const inventoryDisplay = usePrefs().inventoryDisplay;

  // Show the board in the orientation the player saw: their color's corner
  // bottom-right (matches play). All-AI watch records leave it upright. Same
  // model as the play table (P49) — the orientation is a view of the contents,
  // so the frame and grid stay upright here too.
  const home = humanColor(record.seats);
  const boardTurns = home ? TURNS_TO_BOTTOM_RIGHT[home] : 0;
  // The record's own colors — a Duo review has no blue card to draw.
  const recordColors = VARIANTS[record.variant].playColors;

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
        // Viewport-height grid (P52): the board+rails region takes `1fr` and
        // scrolls inside itself; the transport is the `auto` bottom row and never
        // participates in content height. This removes the rail→bar coupling
        // structurally — the bar's y-position is invariant to panel folds, rail
        // resize, and window height, instead of tracking the tallest column.
        // Fills the bounded-height cell its parent supplies (100dvh shell).
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: '1fr auto',
        fontFamily: FONT_UI,
        color: 'var(--ink)',
        background: 'var(--table-bg)',
        boxSizing: 'border-box',
      }}
    >
      {/* Scroll region — the table content. `min-height: 0` lets it shrink below
          its natural height so the overflow (not the page) absorbs a tall column
          or a short viewport; the transport below stays put. */}
      <div
        data-testid="review-scroll"
        style={{
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 26px 24px',
        }}
      >
      {/* Board + rails, laid out like the play table so the graphs sit the same
          distance from the board as the in-game right panel (gap 22). */}
      <div
        style={{
          display: 'flex',
          gap: 22,
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexWrap: 'wrap',
          width: '100%',
        }}
      >
        {/* Left column — player cards, re-rendered from the scrubbed ply. The color
            that just moved lifts (active keyline); winners keep their WINNER pill.
            Same width/gap as the play table so cards don't shift between views. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 250 }}>
          {recordColors.map((c) => {
            const { nameSuffix, tag } = seatMeta(c);
            const state = frame.colors[c];
            if (!state) return null;
            return (
              <PlayerCard
                key={c}
                color={c}
                state={state}
                nameSuffix={nameSuffix}
                tag={tag}
                active={c === frame.move?.color}
                inventoryDisplay={inventoryDisplay}
              />
            );
          })}
        </div>

        {/* Center column — full-size board in the play frame + caption. Same width,
            gap and centering as the play table's board column (DOCK_COLUMN_W), so
            the board and the flanking columns don't shift between play and review. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', width: DOCK_COLUMN_W }}>
          <BoardFrame>
            <Board
              turns={boardTurns}
              board={frame.board}
              activeColor={frame.move?.color ?? 'blue'}
              lastMove={frame.moveCells}
            />
          </BoardFrame>

          <p
            data-testid="scrubber-caption"
            role="status"
            style={{ margin: 0, fontSize: 13, color: 'var(--top-mut)', textAlign: 'center' }}
          >
            {caption}
          </p>
        </div>

        {/* Right column — the same elastic, collapsible rail as the play table
            (P48), so nothing shifts between views. It swaps the live standings for
            the score + mobility timelines (taller than the old modal's, for
            readability), hand tray below as reference (R0.2 c). Analysis being the
            taller panel is what used to push the transport bar below the fold;
            either panel folds away now to bring it back up. */}
        <RailColumn>
          <RailPanel
            id="analysis"
            title={
              <span data-testid="analysis-header" style={{ fontWeight: 600, fontSize: 15 }}>
                Analysis
              </span>
            }
          >
            <div>
              <p style={chartLabel}>Score — squares placed</p>
              <ScoreTimeline frames={frames} ply={ply} onSeek={seekTo} />
            </div>
            <div>
              <p style={chartLabel}>Open Corners — room to play into</p>
              <MobilityTimeline frames={frames} ply={ply} onSeek={seekTo} />
            </div>
          </RailPanel>
          {home && frame.colors[home] && (
            <HandTray
              color={home}
              state={frame.colors[home]}
              interactive={false}
              selectedId={null}
            />
          )}
        </RailColumn>
      </div>
      </div>

      {/* Pinned transport footer (P52) — the grid's `auto` bottom row. Sits on a
          solid table-bg strip with a hairline top edge so scrolled content passes
          cleanly beneath it. Mirrors the play dock's role: session exits bookend
          the scrubber, play/pause + speed inline — one row, no extra stacking. */}
      <div style={transportRow}>
      <div data-testid="review-transport" style={actionBar}>
          {onExitReview && (
            <button data-testid="review-results" onClick={onExitReview} style={{ ...SECONDARY_BTN, fontSize: 13, whiteSpace: 'nowrap' }}>
              ‹ {exitLabel}
            </button>
          )}
          <div style={divider} />
          <button
            data-testid="scrubber-play"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            style={{ ...stepBtn, minWidth: 80, fontWeight: 800, whiteSpace: 'nowrap' }}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button
            data-testid="scrubber-speed"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}×, tap to change`}
            title="Playback speed"
            style={{ ...stepBtn, minWidth: 42, fontFamily: FONT_MONO, fontWeight: 800 }}
          >
            {speed}×
          </button>
          <div style={divider} />
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
            // Grows to fill the bar; a small floor keeps it from collapsing on a
            // narrow viewport (the fixed items still stay on one line).
            style={{ flex: 1, minWidth: 40 }}
          />
          <button data-testid="scrubber-next" onClick={() => step(1)} disabled={ply === lastPly} aria-label="Next move" style={stepBtn}>
            ▶
          </button>
          <button data-testid="scrubber-last" onClick={() => seekTo(lastPly)} disabled={ply === lastPly} aria-label="Last move" style={stepBtn}>
            ⏭
          </button>
          <span data-testid="scrubber-ply" style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--mut)', width: 52, textAlign: 'right', flexShrink: 0 }}>
            {ply} / {lastPly}
          </span>
          {actions && (
            <>
              <div style={divider} />
              <button
                data-testid="review-play-again"
                onClick={actions.onPlayAgain}
                style={{
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 15px',
                  fontFamily: FONT_UI,
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  background: '#3468cf',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Play again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// The pinned footer strip that holds the transport (P52). Full-width table-bg band
// so scrolled content vanishes cleanly under it; a hairline top edge marks the
// scroll boundary. Centers the bar horizontally.
const transportRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '12px 26px',
  background: 'var(--table-bg)',
  borderTop: '1px solid var(--pnl-bd)',
};

const actionBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  // The transport card itself. Wide, so the scrubber slider has a generous length;
  // only used in review, never in play.
  width: 'min(1040px, 94vw)',
  background: 'var(--pnl)',
  border: '1px solid var(--pnl-bd)',
  borderRadius: 16,
  padding: '10px 14px',
  boxSizing: 'border-box',
  boxShadow: '0 16px 32px rgba(15,9,3,.38)',
};

const divider: CSSProperties = { width: 1, height: 28, background: 'var(--pnl-bd)', flexShrink: 0 };

const stepBtn = {
  ...SECONDARY_BTN,
  fontSize: 13,
  padding: '5px 10px',
  minWidth: 34,
  flexShrink: 0,
} as const;

const chartLabel = {
  margin: '0 0 2px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: 'var(--mut)',
} as const;
