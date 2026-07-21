import type { Color, ColorState, PieceId } from '../../game/types';
import { PIECE_IDS } from '../../game/types';
import { pieceSize } from '../../game/pieces';
import { remainingSquares } from '../../game/scoring';
import { FONT_MONO, PIECE_VAR } from '../theme';
import { RailPanel } from '../rail/RailPanel';
import { PieceThumb } from './PieceThumb';

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/**
 * The three size groups. The 12 pentominoes get the rail's full width to wrap
 * into; the two small groups share one row beside each other (P48) — that's the
 * tray spending its bulk horizontally instead of stacking three wells deep. Each
 * flexes down to a one-column stack again when the rail is at its narrow floor.
 */
const GROUPS: { key: string; label: string; ids: PieceId[]; basis: number }[] = [
  {
    key: 'pento',
    label: 'PENTOMINOES — 5 SQ',
    ids: PIECE_IDS.filter((id) => pieceSize(id) === 5),
    // Basis wider than any rail, so the 12 pentominoes always claim a whole row
    // and the two small groups pair off on the next one.
    basis: 999,
  },
  // Equal basis for the pair, so the longest label ("TRIOMINOES · DOMINO · MONO")
  // gets the same room as its neighbour rather than being the squeezed one. Sized
  // so the two either both fit on a line or both wrap to full width — never a
  // middle zone where one is too narrow for its own label.
  {
    key: 'tetro',
    label: 'TETROMINOES — 4 SQ',
    ids: PIECE_IDS.filter((id) => pieceSize(id) === 4),
    basis: 170,
  },
  {
    key: 'small',
    label: 'TRIOMINOES · DOMINO · MONO',
    ids: PIECE_IDS.filter((id) => pieceSize(id) <= 3),
    basis: 170,
  },
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
 * compartment per size group, matching the board's board-plastic finish. It rides
 * the shared collapsible rail panel (P48), so the tray can be folded away to keep
 * the action dock / transport bar in view.
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
    <RailPanel
      id="hand"
      testid="hand-tray"
      padding="15px 16px"
      shadow={TRAY_RIM}
      gap={12}
      title={
        <>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              background: PIECE_VAR[color],
              boxShadow:
                'inset 0 2px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.28), 0 1px 2px rgba(0,0,0,.3)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 15 }}>{cap(color)} · Your hand</span>
        </>
      }
      meta={
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: 'var(--mut)' }}>
          {state.remaining.length} pcs · {remainingSquares(state)} sq
        </span>
      }
    >
      {/* Wells wrap: the pentomino compartment claims a whole row, the two small
          groups pair off beside it when the rail is wide enough for both. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {GROUPS.map((group) => (
          <div
            key={group.key}
            data-testid={`tray-group-${group.key}`}
            style={{ flex: `1 1 ${group.basis}px`, minWidth: 0 }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 9.5,
                fontWeight: 900,
                // Tighter tracking than the tray's other mono caps, with slack to
                // spare (~20px at the rail's full width): side by side, the longest
                // label has to clear its well on one line — a wrapped "MONO" reads
                // as a stray word and shunts the two compartments out of alignment.
                // The margin matters because Settings can swap the mono face live.
                letterSpacing: '.06em',
                whiteSpace: 'nowrap',
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
    </RailPanel>
  );
}
