import type { Color, ColorState } from '../../game/types';
import { PIECE_IDS } from '../../game/types';
import { remainingSquares } from '../../game/scoring';
import { FONT_MONO, FONT_UI, PIECE_VAR } from '../theme';
import type { InventoryDisplay } from '../settings';
import { PieceThumb } from '../tray/PieceThumb';
import { CountUp } from './CountUp';
import type { ActiveReaction } from '../hooks/useReactions';

/** Which state pill a seat shows. Priority resolved by the parent. */
export type SeatTag = 'active' | 'onDeck' | 'played' | 'noMoves' | 'winner' | null;

const TILE_BEVEL =
  'inset 0 2px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.28), 0 1px 2px rgba(0,0,0,.3)';

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

function StateTag({ tag, brass }: { tag: SeatTag; brass: string }) {
  if (!tag) return null;
  const base = {
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: '.12em',
    padding: '3px 8px',
    borderRadius: 999,
    whiteSpace: 'nowrap' as const,
  };
  switch (tag) {
    case 'active':
      return <span style={{ ...base, background: '#3468cf', color: '#fff' }}>YOUR TURN</span>;
    case 'winner':
      return <span style={{ ...base, background: brass, color: '#fff' }}>WINNER</span>;
    case 'onDeck':
      return (
        <span style={{ ...base, border: '1px solid var(--pnl-bd)', color: 'var(--mut)' }}>NEXT</span>
      );
    case 'played':
      return (
        <span style={{ ...base, border: '1px solid var(--pnl-bd)', color: 'var(--mut)' }}>
          PLAYED
        </span>
      );
    case 'noMoves':
      return (
        <span style={{ ...base, border: '1px solid var(--pnl-bd)', color: 'var(--mut)' }}>
          NO MOVES
        </span>
      );
    default:
      return null;
  }
}

/**
 * One seat in the left column: color tile, name (+ You / difficulty), state pill,
 * remaining-square count, and an always-visible inventory (micro-silhouettes or
 * a compact 21-dot grid). Read-only; the active color's hand lives in HandTray.
 */
export function PlayerCard({
  color,
  state,
  nameSuffix,
  tag,
  active,
  inventoryDisplay = 'silhouette',
  reaction,
}: {
  color: Color;
  state: ColorState;
  /** Lighter-weight suffix after the color name — `You` or a difficulty label. */
  nameSuffix?: string | null;
  tag: SeatTag;
  /** Active seat gets a blue keyline + lifted shadow. */
  active: boolean;
  inventoryDisplay?: InventoryDisplay;
  /** Live reaction bubble for this seat (P19); absent when the seat is quiet. */
  reaction?: ActiveReaction;
}) {
  const remaining = new Set(state.remaining);
  const squares = remainingSquares(state);

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--pnl)',
        border: '1px solid var(--pnl-bd)',
        borderRadius: 12,
        padding: '12px 14px',
        fontFamily: FONT_UI,
        color: 'var(--ink)',
        boxShadow: active
          ? '0 0 0 2px #3468cf, 0 12px 24px rgba(20,12,4,.38)'
          : '0 5px 14px rgba(20,12,4,.24)',
      }}
    >
      {/* Reaction toast (P19): a canned text reaction from this seat, keyed per
          message so a fresh reaction replays the pop. Removed by useReactions' TTL. */}
      {reaction && (
        <span
          key={reaction.key}
          className="ob-react-pop"
          data-testid={`reaction-${color}`}
          data-reaction={reaction.reaction.id}
          title={reaction.reaction.label}
          style={{
            position: 'absolute',
            top: -12,
            right: -8,
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            color: 'var(--ink)',
            padding: '5px 9px',
            borderRadius: 999,
            background: 'var(--pnl)',
            border: '1px solid var(--pnl-bd)',
            boxShadow: '0 4px 12px rgba(20,12,4,.32)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          {reaction.reaction.label}
        </span>
      )}

      {/* Row 1: color tile · name · state tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: PIECE_VAR[color],
            boxShadow: TILE_BEVEL,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {cap(color)}
          {nameSuffix ? (
            <span style={{ fontWeight: 500, color: '#5B4C39' }}> · {nameSuffix}</span>
          ) : null}
        </span>
        <span style={{ flex: 1 }} />
        <StateTag tag={tag} brass="var(--brass)" />
      </div>

      {/* Row 2: big remaining-square count */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 9 }}>
        <CountUp value={squares} style={{ fontFamily: FONT_MONO, fontWeight: 900, fontSize: 22 }} />
        <span style={{ fontSize: 11.5, color: 'var(--mut)' }}>
          squares left · {state.remaining.length} pieces
        </span>
      </div>

      {/* Row 3: inventory */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: inventoryDisplay === 'dots' ? 4 : 5,
          marginTop: 9,
          alignItems: 'flex-start',
        }}
      >
        {inventoryDisplay === 'dots'
          ? PIECE_IDS.map((id) => {
              const placed = !remaining.has(id);
              return (
                <span
                  key={id}
                  title={id}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: PIECE_VAR[color],
                    opacity: placed ? 0.18 : 0.95,
                  }}
                />
              );
            })
          : PIECE_IDS.map((id) => (
              <PieceThumb
                key={id}
                pieceId={id}
                color={color}
                placed={!remaining.has(id)}
                cellPx={5}
                micro
              />
            ))}
      </div>
    </div>
  );
}
