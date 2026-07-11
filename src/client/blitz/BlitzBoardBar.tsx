import { FONT_MONO } from '../theme';
import { BLITZ_URGENT_MS, blitzFraction, formatRemaining } from './blitz';

/**
 * Board-side blitz countdown (P24). The top-bar `BlitzClock` stays the precise
 * readout, but the eyes are on the board during a timed move — so this depleting
 * bar sits just above the board frame, in the field of view. It mirrors the same
 * `remainingMs`; in the urgent window it turns red and (unless motion is reduced)
 * the fill breathes. Renders nothing when no clock is running.
 */
export function BlitzBoardBar({
  remainingMs,
  limitMs,
  reduce,
}: {
  remainingMs: number | null;
  limitMs: number | null;
  reduce: boolean;
}) {
  if (remainingMs == null || limitMs == null) return null;

  const urgent = remainingMs <= BLITZ_URGENT_MS;
  const fillColor = urgent ? 'var(--danger, #dc2626)' : 'var(--top-ink)';
  const width = `${blitzFraction(remainingMs, limitMs) * 100}%`;

  return (
    <div
      data-testid="blitz-board-bar"
      data-urgent={urgent ? 'true' : 'false'}
      // Purely a peripheral visual cue — the top-bar BlitzClock is the canonical
      // live timer for AT, so this one stays silent to avoid double-announcing.
      aria-hidden="true"
      style={{
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 12,
          fontWeight: urgent ? 700 : 500,
          color: urgent ? 'var(--danger, #dc2626)' : 'var(--top-mut)',
          whiteSpace: 'nowrap',
        }}
      >
        ⏱ {formatRemaining(remainingMs)}s
      </span>
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 999,
          background: 'var(--top-bd)',
          overflow: 'hidden',
        }}
      >
        <div
          className={urgent && !reduce ? 'ob-blitz-pulse' : undefined}
          style={{
            height: '100%',
            width,
            borderRadius: 999,
            background: fillColor,
            // Match the clock's 100ms tick so the bar glides rather than steps.
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  );
}
