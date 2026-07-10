import { FONT_MONO } from '../theme';
import { BLITZ_URGENT_MS, formatRemaining } from './blitz';

/**
 * Live per-move countdown for blitz (P20 M1). Renders nothing when no clock is
 * running (blitz off, or it's a bot's turn) — unlike AiThinkingIndicator this
 * doesn't reserve space, since a timed table always shows it on the human's turn
 * and never otherwise, so there's no flicker to absorb.
 */
export function BlitzClock({ remainingMs }: { remainingMs: number | null }) {
  if (remainingMs == null) return null;

  const urgent = remainingMs <= BLITZ_URGENT_MS;

  return (
    <span
      data-testid="blitz-clock"
      data-urgent={urgent ? 'true' : 'false'}
      role="timer"
      aria-label="Time left this move"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: urgent ? 700 : 500,
        color: urgent ? 'var(--danger, #dc2626)' : 'var(--top-mut)',
        border: '1px solid var(--top-bd)',
        borderRadius: 999,
        padding: '4px 10px',
      }}
    >
      <span aria-hidden>⏱</span>
      <span>{formatRemaining(remainingMs)}s</span>
    </span>
  );
}
