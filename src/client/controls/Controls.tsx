import type { PieceId } from '../../game/types';

/** Rotate / flip / clear for the selected piece. Placement itself is committed
 *  by clicking a legal spot on the board. */
export function Controls({
  pieceId,
  disabled,
  onRotate,
  onFlip,
  onClear,
}: {
  pieceId: PieceId | null;
  disabled: boolean;
  onRotate: () => void;
  onFlip: () => void;
  onClear: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
      <button disabled={disabled || !pieceId} onClick={onRotate}>
        Rotate ⟳
      </button>
      <button disabled={disabled || !pieceId} onClick={onFlip}>
        Flip ⇄
      </button>
      <button disabled={!pieceId} onClick={onClear}>
        Clear
      </button>
      <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
        {disabled
          ? 'Waiting for your turn…'
          : pieceId
            ? `Selected ${pieceId} — hover the board and click a legal spot`
            : 'Select a piece from your tray'}
      </span>
    </div>
  );
}
