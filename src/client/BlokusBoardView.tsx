import type { BoardProps } from 'boardgame.io/react';
import type { GameState } from '../game/types';
import { COLOR_ORDER } from '../game/types';
import { Board } from './board/Board';
import { PieceTray } from './tray/PieceTray';
import { ScorePanel } from './controls/ScorePanel';

/** Read-only game view (Phase 5): board + scores + piece trays. */
export function BlokusBoardView({ G, ctx }: BoardProps<GameState>) {
  const activeColor = COLOR_ORDER[G.activeColorIndex];
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
        <p style={{ margin: '0 0 8px', fontSize: 14 }}>
          turn {ctx.turn} · player {ctx.currentPlayer} · active {activeColor}
          {ctx.gameover ? ' · GAME OVER' : ''}
        </p>
        <Board board={G.board} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ScorePanel G={G} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {COLOR_ORDER.map((c) => (
            <PieceTray key={c} color={c} state={G.colors[c]} />
          ))}
        </div>
        {ctx.gameover && (
          <pre style={{ fontSize: 12 }}>{JSON.stringify(ctx.gameover, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
