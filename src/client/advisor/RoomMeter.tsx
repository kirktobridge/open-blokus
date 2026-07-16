import type { GameState } from '../../game/types';
import { FONT_MONO, PIECE_VAR } from '../theme';
import { roomReadout } from './legalMoves';

/**
 * Opt-in coaching panel (P34 M2): a per-color "room" meter — open corner
 * attach-points, the mobility read that actually diverges mid-game while the
 * score stays close. Sits above the remaining-squares standings so the two reads
 * sit side by side ("I'm level on squares but my room is collapsing"). Rendered
 * only while the Room toggle is on; never part of the default game view.
 *
 * Pure display over `roomReadout` (the shared `attachPoints` frontier). Bars are
 * scaled to the roomiest color so the *relative* gap is what reads, not absolutes.
 */
export function RoomMeter({ G }: { G: GameState }) {
  const entries = roomReadout(G);
  const max = Math.max(1, ...entries.map((e) => e.room));

  return (
    <div data-testid="room-meter">
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9.5,
          fontWeight: 900,
          letterSpacing: '.15em',
          color: 'var(--mut)',
          margin: '0 0 8px',
        }}
      >
        ROOM · OPEN CORNERS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(({ color, room }) => (
          <div
            key={color}
            data-testid={`room-row-${color}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 3,
                flex: '0 0 auto',
                background: PIECE_VAR[color],
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)',
              }}
            />
            <div
              style={{
                flex: 1,
                height: 8,
                borderRadius: 999,
                background: 'var(--well)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(room / max) * 100}%`,
                  height: '100%',
                  background: PIECE_VAR[color],
                  borderRadius: 999,
                  transition: 'width 0.25s ease',
                }}
              />
            </div>
            <span
              data-testid={`room-count-${color}`}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ink)',
                minWidth: 18,
                textAlign: 'right',
              }}
            >
              {room}
            </span>
          </div>
        ))}
      </div>
      <p
        style={{
          margin: '9px 0 0',
          fontSize: 10.5,
          lineHeight: 1.4,
          color: 'var(--mut)',
        }}
      >
        Corners each color can still grow from — the real mid-game lead, long before
        the squares diverge.
      </p>
    </div>
  );
}
