import { useCallback, useState } from 'react';
import type { Cell, PieceId, Rotation } from '../../game/types';

/**
 * UI-only state for composing a placement: the selected piece, its orientation,
 * and the hovered board cell. Never stored in G.
 */
export function useSelection() {
  const [pieceId, setPieceId] = useState<PieceId | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [reflected, setReflected] = useState(false);
  const [hover, setHover] = useState<Cell | null>(null);

  const selectPiece = useCallback((id: PieceId) => {
    // Toggle off if the same piece is clicked again; reset orientation otherwise.
    setPieceId((cur) => (cur === id ? null : id));
    setRotation(0);
    setReflected(false);
  }, []);

  const rotate = useCallback(
    (dir: 1 | -1 = 1) => setRotation((r) => (((r + dir + 4) % 4) as Rotation)),
    [],
  );
  const flip = useCallback(() => setReflected((f) => !f), []);
  const reset = useCallback(() => {
    setPieceId(null);
    setRotation(0);
    setReflected(false);
    setHover(null);
  }, []);

  return { pieceId, rotation, reflected, hover, setHover, selectPiece, rotate, flip, reset };
}
