import type { Beat } from '../hooks/useGameEvents';
import { FONT_UI, PIECE_VAR } from '../theme';

/**
 * Transient centered banners for in-game beats (P16) — currently "X is out of
 * moves". Fixed near the top of the board area, above everything, pointer-through
 * so they never block play. Each beat animates in/out via the `ob-beat` class.
 */
export function EventBeats({ beats }: { beats: Beat[] }) {
  if (beats.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 74,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      {beats.map((b) => (
        <div
          key={b.id}
          data-testid="event-beat"
          className="ob-beat"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--ink)',
            background: 'var(--pnl)',
            border: '1px solid var(--pnl-bd)',
            borderRadius: 999,
            padding: '8px 16px',
            boxShadow: '0 10px 28px rgba(15,9,3,.34)',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              background: PIECE_VAR[b.color],
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)',
            }}
          />
          {b.text}
        </div>
      ))}
    </div>
  );
}
