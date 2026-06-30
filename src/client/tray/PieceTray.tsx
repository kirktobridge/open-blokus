import type { Color, ColorState } from '../../game/types';
import { PIECE_IDS } from '../../game/types';
import { COLOR_HEX } from '../theme';
import { PieceThumb } from './PieceThumb';

/** All 21 pieces for one color; placed pieces are dimmed. Read-only. */
export function PieceTray({ color, state }: { color: Color; state: ColorState }) {
  const remaining = new Set(state.remaining);
  return (
    <div>
      <div
        style={{
          fontWeight: 600,
          color: COLOR_HEX[color],
          textTransform: 'capitalize',
          marginBottom: 4,
        }}
      >
        {color}
        {state.stuck ? ' (stuck)' : ''}
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
        {PIECE_IDS.map((id) => (
          <PieceThumb key={id} pieceId={id} color={color} placed={!remaining.has(id)} />
        ))}
      </div>
    </div>
  );
}
