import { useCallback, useRef, useState } from 'react';
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

  // Live mirrors so the stable ([]-dep) callbacks below can branch on the current
  // selection without being torn down and rebuilt on every change.
  const pieceIdRef = useRef(pieceId);
  pieceIdRef.current = pieceId;
  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  const selectPiece = useCallback((id: PieceId) => {
    // Sticky carry (P23 M1): re-clicking the piece you're already holding is a no-op,
    // not a toggle-off — a stray click no longer drops the piece. Deselect is Esc.
    // Switching to a different piece resets orientation and any staged lock.
    if (pieceIdRef.current === id) return;
    setPieceId(id);
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

  /**
   * A board click while composing (P23 M1). Placement stays submit-only — a click
   * never places. If nothing is staged yet, lock the placement at the clicked cell.
   * If a placement is already staged, any click (inside or outside the footprint) is
   * "pick it back up": unstage back to positioning without relocating; the next hover
   * resumes following the cursor.
   */
  const stageAt = useCallback((x: number, y: number) => {
    if (stagedRef.current) {
      setStaged(false);
    } else {
      setHover({ x, y });
      setStaged(true);
    }
  }, []);

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
    stageAt,
    reset,
  };
}
