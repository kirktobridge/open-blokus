import type { BoardProps } from 'boardgame.io/react';
import type { Color, GameState } from '../game/types';
import { COLOR_ORDER } from '../game/types';
import { BOARD_SIZE } from '../shared/constants';
import { generateLegalMoves } from '../game/moves';

const GLYPH: Record<Color, string> = { blue: 'B', yellow: 'Y', red: 'R', green: 'G' };

/** Temporary text board for Phase 4 — replaced by the real Board in Phase 5. */
export function TempBoard({ G, ctx }: BoardProps<GameState>) {
  const activeColor = COLOR_ORDER[G.activeColorIndex];
  const legalMoves = ctx.gameover ? 0 : generateLegalMoves(G, activeColor).length;

  const rows: string[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    let line = '';
    for (let x = 0; x < BOARD_SIZE; x++) {
      const c = G.board[y * BOARD_SIZE + x];
      line += c ? GLYPH[c] : '·';
    }
    rows.push(line);
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '1rem' }}>
      <h1>OpenBlokus — dev</h1>
      <p>
        turn {ctx.turn} · currentPlayer {ctx.currentPlayer} · active {activeColor} ·
        legal moves {legalMoves}
      </p>
      <p>
        {COLOR_ORDER.map((c) => (
          <span key={c} style={{ marginRight: '1rem' }}>
            {c}: {G.colors[c].remaining.length}
            {G.colors[c].stuck ? ' (stuck)' : ''}
          </span>
        ))}
      </p>
      <pre style={{ lineHeight: 1, letterSpacing: '0.25em' }}>{rows.join('\n')}</pre>
      {ctx.gameover && <pre>GAME OVER: {JSON.stringify(ctx.gameover, null, 2)}</pre>}
    </div>
  );
}
