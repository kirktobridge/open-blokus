import type { Color, ColorState, PieceId } from '../../game/types';
import { PIECE_IDS } from '../../game/types';
import { usePaletteColors } from '../palettes';
import { PieceThumb } from './PieceThumb';

/** All 21 pieces for one color; placed pieces are dimmed. Interactive for the
 *  active color on the current player's turn. */
export function PieceTray({
  color,
  state,
  interactive = false,
  selectedId = null,
  onSelect,
}: {
  color: Color;
  state: ColorState;
  interactive?: boolean;
  selectedId?: PieceId | null;
  onSelect?: (id: PieceId) => void;
}) {
  const remaining = new Set(state.remaining);
  const colors = usePaletteColors();
  return (
    <div>
      <div
        style={{
          fontWeight: 600,
          color: colors[color],
          textTransform: 'capitalize',
          marginBottom: 4,
        }}
      >
        {color}
        {state.stuck ? ' (stuck)' : ''}
        {interactive ? ' ◄' : ''}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'flex-start',
          maxWidth: 220,
        }}
      >
        {PIECE_IDS.map((id) => {
          const placed = !remaining.has(id);
          return (
            <PieceThumb
              key={id}
              pieceId={id}
              color={color}
              colors={colors}
              placed={placed}
              selected={interactive && selectedId === id}
              onClick={interactive && !placed ? () => onSelect?.(id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
