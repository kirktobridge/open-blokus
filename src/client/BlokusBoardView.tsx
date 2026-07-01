import { useEffect, useRef } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { GameState } from '../game/types';
import { COLOR_ORDER } from '../game/types';
import { resolveCells } from '../game/pieces';
import { isLegalPlacement } from '../game/placement';
import { Board } from './board/Board';
import { PieceTray } from './tray/PieceTray';
import { ScorePanel } from './controls/ScorePanel';
import { Controls } from './controls/Controls';
import { GameOverModal, type GameOverPayload } from './controls/GameOverModal';
import { matchAction, type PlacementAction } from './controls/keymap';
import { useSelection } from './hooks/useSelection';
import { usePaletteColors } from './palettes';

/**
 * Interactive game view. Two-step placement: position + orient a piece (mouse or
 * WASD / arrows / scroll), lock it (click or Space), then submit (button or Enter).
 */
export function BlokusBoardView({ G, ctx, moves, isActive }: BoardProps<GameState>) {
  const sel = useSelection();
  const colors = usePaletteColors();
  const activeColor = COLOR_ORDER[G.activeColorIndex];
  // Single-player passes isActive=true for the current player; multiplayer gates it.
  const canPlay = isActive !== false && !ctx.gameover;

  const oriented =
    sel.pieceId && sel.hover
      ? resolveCells({
          pieceId: sel.pieceId,
          rotation: sel.rotation,
          reflected: sel.reflected,
          x: sel.hover.x,
          y: sel.hover.y,
        })
      : [];
  const legal =
    canPlay && sel.pieceId && sel.hover
      ? isLegalPlacement(G, activeColor, sel.pieceId, oriented)
      : false;
  const preview =
    sel.pieceId && sel.hover
      ? { cells: new Set(oriented.map((c) => `${c.x},${c.y}`)), legal, staged: sel.staged }
      : undefined;

  const canSubmit = sel.staged && legal;

  /** Commit the staged placement to the engine. Returns whether a move was made. */
  function submitMove(): boolean {
    if (!canPlay || !sel.pieceId || !sel.hover || !sel.staged) return false;
    const cells = resolveCells({
      pieceId: sel.pieceId,
      rotation: sel.rotation,
      reflected: sel.reflected,
      x: sel.hover.x,
      y: sel.hover.y,
    });
    if (!isLegalPlacement(G, activeColor, sel.pieceId, cells)) return false;
    moves.placePiece({
      pieceId: sel.pieceId,
      rotation: sel.rotation,
      reflected: sel.reflected,
      x: sel.hover.x,
      y: sel.hover.y,
    });
    sel.reset();
    return true;
  }

  const interactive = canPlay && sel.pieceId != null;

  // Keep a fresh action handler in a ref so the window listener stays stable while
  // still closing over the latest selection/legality. Returns true if it consumed
  // the event (so we can preventDefault only when we actually acted).
  const handleActionRef = useRef<(a: PlacementAction) => boolean>(() => false);
  handleActionRef.current = (action) => {
    if (!canPlay) return false;
    if (action === 'cancel') {
      if (sel.staged) sel.unstage();
      else sel.reset();
      return true;
    }
    if (!sel.pieceId) return false;
    switch (action) {
      case 'moveUp':
        sel.move(0, -1);
        return true;
      case 'moveDown':
        sel.move(0, 1);
        return true;
      case 'moveLeft':
        sel.move(-1, 0);
        return true;
      case 'moveRight':
        sel.move(1, 0);
        return true;
      case 'rotateCW':
        sel.rotate(1);
        return true;
      case 'rotateCCW':
        sel.rotate(-1);
        return true;
      case 'flip':
        sel.flip();
        return true;
      case 'place':
        if (!sel.hover) return false;
        sel.stage();
        return true;
      case 'submit':
        return submitMove();
      default:
        return false;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys while typing in a form field (palette name, join id, …).
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const action = matchAction(e);
      if (!action) return;
      if (handleActionRef.current(action)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        padding: 16,
        fontFamily: 'system-ui, sans-serif',
        alignItems: 'flex-start',
      }}
    >
      <div>
        <h2 style={{ margin: '0 0 8px' }}>OpenBlokus</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14 }} role="status">
          turn {ctx.turn} · player {ctx.currentPlayer} · active{' '}
          <span style={{ color: colors[activeColor], fontWeight: 600 }}>
            {activeColor}
          </span>
          {' · '}
          <span
            data-testid="turn-status"
            style={{
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 12,
              color: '#fff',
              background: canPlay ? colors[activeColor] : 'var(--pill-idle)',
            }}
          >
            {ctx.gameover ? 'game over' : canPlay ? 'your turn' : 'waiting'}
          </span>
        </p>
        <Board
          board={G.board}
          activeColor={activeColor}
          preview={preview}
          lastMove={G.lastMove}
          onCellEnter={
            interactive && !sel.staged ? (x, y) => sel.setHover({ x, y }) : undefined
          }
          onCellClick={
            interactive
              ? (x, y) => {
                  sel.setHover({ x, y });
                  sel.stage();
                }
              : undefined
          }
          onLeave={() => {
            if (!sel.staged) sel.setHover(null);
          }}
          onRotate={interactive ? sel.rotate : undefined}
          onFlip={interactive ? sel.flip : undefined}
        />
        <Controls
          pieceId={sel.pieceId}
          disabled={!canPlay}
          staged={sel.staged}
          canSubmit={canSubmit}
          onRotate={sel.rotate}
          onFlip={sel.flip}
          onSubmit={submitMove}
          onClear={sel.reset}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ScorePanel G={G} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {COLOR_ORDER.map((c) => (
            <PieceTray
              key={c}
              color={c}
              state={G.colors[c]}
              interactive={canPlay && c === activeColor}
              selectedId={c === activeColor ? sel.pieceId : null}
              onSelect={sel.selectPiece}
            />
          ))}
        </div>
      </div>

      {ctx.gameover && <GameOverModal gameover={ctx.gameover as GameOverPayload} />}
    </div>
  );
}
