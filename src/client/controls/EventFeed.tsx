import type { Beat } from '../hooks/useGameEvents';
import { FONT_MONO, FONT_UI, PIECE_VAR } from '../theme';

/**
 * Persistent event feed (P43) — a scrollable history of the game's beats. Where
 * `EventBeats` shows each moment transiently and then lets it fade, this keeps the
 * whole narrative so a player who looked away can still read what happened. It's a
 * pure consumer of the `useGameEvents` `log` stream (docs/EVENTS.md Consumers), so it
 * re-runs no detection and inherits P32's anti-spam. Newest at the top; the container
 * scrolls once the game has run long enough to overflow it.
 */
export function EventFeed({ log }: { log: Beat[] }) {
  return (
    <div
      data-testid="event-feed"
      style={{
        width: 300,
        background: 'var(--pnl)',
        border: '1px solid var(--pnl-bd)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 14px 28px rgba(15,9,3,.32)',
        boxSizing: 'border-box',
        fontFamily: FONT_UI,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9.5,
          fontWeight: 900,
          letterSpacing: '.15em',
          textTransform: 'uppercase',
          color: 'var(--fg-muted)',
          marginBottom: 10,
        }}
      >
        Game log
      </div>

      {log.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
          Cuts, cramped corners and endgame beats will show here as they happen.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {/* Newest first: the latest beat is always visible without scrolling; the
              history reads back in time as you scroll down. Copy, don't reverse in
              place — `log` is the hook's live array. */}
          {[...log].reverse().map((b) => (
            <div
              key={b.id}
              data-testid="event-feed-entry"
              data-kind={b.kind}
              style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}
            >
              <span
                style={{
                  flex: '0 0 auto',
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: b.color ? PIECE_VAR[b.color] : 'var(--fg-muted)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
                }}
              />
              <span style={{ color: 'var(--ink)', lineHeight: 1.35 }}>{b.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
