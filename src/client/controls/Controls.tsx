import type { PieceId } from '../../game/types';
import { describeKeys } from './keymap';

/**
 * Orientation + two-step placement controls for the selected piece. Position and
 * orient (mouse or keyboard), click/Space to lock, then Submit/Enter to commit.
 */
export function Controls({
  pieceId,
  disabled,
  staged,
  canSubmit,
  onRotate,
  onFlip,
  onSubmit,
  onClear,
}: {
  pieceId: PieceId | null;
  disabled: boolean;
  staged: boolean;
  canSubmit: boolean;
  onRotate: () => void;
  onFlip: () => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const status = disabled
    ? 'Waiting for your turn…'
    : !pieceId
      ? 'Select a piece from your tray'
      : staged
        ? canSubmit
          ? 'Locked — Submit or press Enter to confirm'
          : 'Locked on an illegal spot — reposition'
        : `Selected ${pieceId} — position it, then click / Space to lock`;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
      <button
        data-testid="rotate"
        disabled={disabled || !pieceId}
        onClick={onRotate}
        title={`Rotate (${describeKeys('rotateCW')} / scroll)`}
      >
        Rotate ⟳
      </button>
      <button
        data-testid="flip"
        disabled={disabled || !pieceId}
        onClick={onFlip}
        title={`Flip (${describeKeys('flip')} / right-click)`}
      >
        Flip ⇄
      </button>
      <button
        data-testid="submit-move"
        disabled={!canSubmit}
        onClick={onSubmit}
        title={`Submit (${describeKeys('submit')})`}
        style={{ fontWeight: 600 }}
      >
        Submit ✓
      </button>
      <button data-testid="clear" disabled={!pieceId} onClick={onClear}>
        Clear
      </button>
      <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{status}</span>
    </div>
  );
}
