import type { Color, ColorState, PieceId } from '../../game/types';
import { PIECE_IDS } from '../../game/types';
import { pieceSize } from '../../game/pieces';
import { remainingSquares } from '../../game/scoring';
import { FONT_MONO, FONT_UI, PIECE_VAR } from '../theme';
import { PieceThumb } from './PieceThumb';

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/** The three size groups, top to bottom. */
const GROUPS: { label: string; ids: PieceId[] }[] = [
  { label: 'PENTOMINOES — 5 SQ', ids: PIECE_IDS.filter((id) => pieceSize(id) === 5) },
  { label: 'TETROMINOES — 4 SQ', ids: PIECE_IDS.filter((id) => pieceSize(id) === 4) },
  { label: 'TRIOMINOES · DOMINO · MONO', ids: PIECE_IDS.filter((id) => pieceSize(id) <= 3) },
];

/** Molded rim for the tray shell — a lit top edge and a thick shadowed bottom,
 *  so the card reads as a piece of tray plastic rather than a paper panel (P5). */
const TRAY_RIM = [
  '0 14px 28px rgba(15,9,3,.32)',
  'inset 0 1.5px 0 rgba(255,255,255,.5)',
  'inset 0 -2.5px 0 rgba(0,0,0,.14)',
].join(', ');
/** A size group's recessed compartment — the pieces sit down inside it. */
const TRAY_WELL = 'inset 0 2px 6px rgba(0,0,0,.2), inset 0 -1px 0 rgba(255,255,255,.4)';

/**
 * The local player's hand, grouped by piece size. Placed pieces show as dashed
 * ghosts, the selected piece as a recessed well+ring. Interactive only on the
 * active color's turn (mirrors the old PieceTray for that color).
 *
 * The shell is the set's molded piece tray (P5): a rimmed slab with one sunken
 * compartment per size group, matching the board's board-plastic finish.
 */
export function HandTray({
  color,
  state,
  interactive = false,
  selectedId = null,
  onSelect,
  unplayable,
}: {
  color: Color;
  state: ColorState;
  interactive?: boolean;
  selectedId?: PieceId | null;
  onSelect?: (id: PieceId) => void;
  /** Advisor (P39): held pieces with no legal move this turn — washed red so a
   *  piece you can't play reads at the point you'd pick it, not just in the card. */
  unplayable?: Set<PieceId>;
}) {
  const remaining = new Set(state.remaining);

  return (
    <div
      style={{
        width: 300,
        background: 'var(--pnl)',
        border: '1px solid var(--pnl-bd)',
        borderRadius: 14,
        padding: '15px 16px',
        fontFamily: FONT_UI,
        color: 'var(--ink)',
        boxShadow: TRAY_RIM,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: PIECE_VAR[color],
            boxShadow:
              'inset 0 2px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.28), 0 1px 2px rgba(0,0,0,.3)',
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{cap(color)} · Your hand</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: 'var(--mut)' }}>
          {state.remaining.length} pcs · {remainingSquares(state)} sq
        </span>
      </div>

      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: '.15em',
              color: '#685F4F',
              marginBottom: 7,
            }}
          >
            {group.label}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 7,
              alignItems: 'flex-start',
              background: 'var(--well)',
              borderRadius: 9,
              padding: '8px 9px',
              boxShadow: TRAY_WELL,
            }}
          >
            {group.ids.map((id) => {
              const placed = !remaining.has(id);
              return (
                <PieceThumb
                  key={id}
                  pieceId={id}
                  color={color}
                  placed={placed}
                  unplayable={unplayable?.has(id) ?? false}
                  selected={interactive && selectedId === id}
                  onClick={interactive && !placed ? () => onSelect?.(id) : undefined}
                  cellPx={13}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
