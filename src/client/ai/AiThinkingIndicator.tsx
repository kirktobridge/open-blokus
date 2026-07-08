import { useEffect, useState } from 'react';
import { FONT_MONO } from '../theme';

/**
 * Live "AI thinking…" status with a spinner and elapsed-seconds counter (P10).
 * The strongest tier (`extreme`) has no time budget, so early-game moves can take
 * ~12 s; a static label reads as "frozen." A ticking counter (+ a "deep search"
 * note once it runs long) shows the search is progressing, not stuck.
 *
 * `since` is the wall-clock start of the current deliberation (from useBotRunner),
 * or null when no bot is thinking. The node stays mounted while hidden so the top
 * bar doesn't reflow as it appears/disappears.
 */

/** Elapsed threshold past which we reassure the user the long wait is expected. */
const SLOW_MS = 8000;

const WRAP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: FONT_MONO,
  fontSize: 12,
  color: 'var(--top-mut)',
};

const SPINNER_STYLE: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  border: '1.5px solid var(--top-bd)',
  borderTopColor: 'var(--top-ink)',
  boxSizing: 'border-box',
  flex: '0 0 auto',
};

export function AiThinkingIndicator({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  // Re-render a few times a second while thinking so the counter advances; idle
  // (since == null) runs no timer.
  useEffect(() => {
    if (since == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [since]);

  if (since == null) {
    return (
      <span data-testid="ai-thinking" style={{ ...WRAP_STYLE, visibility: 'hidden' }}>
        <span style={SPINNER_STYLE} aria-hidden />
        AI thinking…
      </span>
    );
  }

  const elapsedMs = Math.max(0, now - since);
  const seconds = Math.floor(elapsedMs / 1000);
  const slow = elapsedMs >= SLOW_MS;

  return (
    <span data-testid="ai-thinking" style={WRAP_STYLE}>
      <span className="ob-spin" style={SPINNER_STYLE} aria-hidden />
      <span>
        AI thinking… {seconds}s{slow ? ' · deep search' : ''}
      </span>
    </span>
  );
}
