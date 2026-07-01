import { useCallback, useState } from 'react';
import type { Cell, PieceId, Rotation } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';

const clamp = (n: number) => Math.max(0, Math.min(BOARD_SIZE - 1, n));
const CENTER = Math.floor(BOARD_SIZE / 2);

/**
 * UI-only state for composing a placement: the selected piece, its orientation,
 * the hovered board cell, and whether that placement is `staged` (locked, awaiting
 * submit). Never stored in G.
 */
export function useSelection() {
  const [pieceId, setPieceId] = useState<PieceId | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [reflected, setReflected] = useState(false);
  const [hover, setHover] = useState<Cell | null>(null);
  const [staged, setStaged] = useState(false);

  const selectPiece = useCallback((id: PieceId) => {
    // Toggle off if the same piece is clicked again; reset orientation otherwise.
    setPieceId((cur) => (cur === id ? null : id));
    setRotation(0);
    setReflected(false);
    setStaged(false);
  }, []);

  // Any positioning change (rotate/flip/move) returns to the positioning phase.
  const rotate = useCallback((dir: 1 | -1 = 1) => {
    setRotation((r) => (((r + dir + 4) % 4) as Rotation));
    setStaged(false);
  }, []);
  const flip = useCallback(() => {
    setReflected((f) => !f);
    setStaged(false);
  }, []);

  /** Move the hovered cell by (dx, dy); initializes at board center. Clamped. */
  const move = useCallback((dx: number, dy: number) => {
    setHover((h) =>
      h ? { x: clamp(h.x + dx), y: clamp(h.y + dy) } : { x: CENTER, y: CENTER },
    );
    setStaged(false);
  }, []);

  const stage = useCallback(() => setStaged(true), []);
  const unstage = useCallback(() => setStaged(false), []);

  const reset = useCallback(() => {
    setPieceId(null);
    setRotation(0);
    setReflected(false);
    setHover(null);
    setStaged(false);
  }, []);

  return {
    pieceId,
    rotation,
    reflected,
    hover,
    staged,
    setHover,
    selectPiece,
    rotate,
    flip,
    move,
    stage,
    unstage,
    reset,
  };
}
