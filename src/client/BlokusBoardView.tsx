import { useEffect } from 'react';
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
import { useSelection } from './hooks/useSelection';
import { COLOR_HEX } from './theme';

/** Interactive game view (Phase 6): select a piece, preview it, click to place. */
export function BlokusBoardView({ G, ctx, moves, isActive }: BoardProps<GameState>) {
  const sel = useSelection();
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
      ? { cells: new Set(oriented.map((c) => `${c.x},${c.y}`)), legal }
      : undefined;

  function tryPlace(x: number, y: number) {
    if (!canPlay || !sel.pieceId) return;
    const cells = resolveCells({
      pieceId: sel.pieceId,
      rotation: sel.rotation,
      reflected: sel.reflected,
      x,
      y,
    });
    if (isLegalPlacement(G, activeColor, sel.pieceId, cells)) {
      moves.placePiece({
        pieceId: sel.pieceId,
        rotation: sel.rotation,
        reflected: sel.reflected,
        x,
        y,
      });
      sel.reset();
    }
  }

  const interactive = canPlay && sel.pieceId != null;

  // Keyboard shortcuts: R rotate, F flip, Esc clear.
  useEffect(() => {
    if (!canPlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') sel.rotate();
      else if (e.key === 'f' || e.key === 'F') sel.flip();
      else if (e.key === 'Escape') sel.reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canPlay, sel.rotate, sel.flip, sel.reset]);

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
          <span style={{ color: COLOR_HEX[activeColor], fontWeight: 600 }}>
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
              background: canPlay ? COLOR_HEX[activeColor] : 'var(--pill-idle)',
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
          onCellEnter={interactive ? (x, y) => sel.setHover({ x, y }) : undefined}
          onCellClick={interactive ? tryPlace : undefined}
          onLeave={() => sel.setHover(null)}
        />
        <Controls
          pieceId={sel.pieceId}
          disabled={!canPlay}
          onRotate={sel.rotate}
          onFlip={sel.flip}
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
