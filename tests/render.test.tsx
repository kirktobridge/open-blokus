import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BoardProps } from 'boardgame.io/react';
import { Board } from '../src/client/board/Board';
import { PieceThumb } from '../src/client/tray/PieceThumb';
import { BlokusBoardView } from '../src/client/BlokusBoardView';
import { PIECE_VAR } from '../src/client/theme';
import { createInitialState } from '../src/game/modes';
import { applyPlacement } from '../src/game/placement';
import type { GameMode, GameState } from '../src/game/types';

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('Board', () => {
  it('renders 400 cells whose colors match the board array', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'I2', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]); // two blue cells
    const html = renderToStaticMarkup(<Board board={G.board} activeColor="blue" />);
    // 400 cells + 1 grid container = 401 divs (the placed-piece finish is an
    // absolutely-positioned <svg> overlay, not a div).
    expect(occurrences(html, '<div')).toBe(401);
    // Occupied cells paint the empty mat now (the translucent molded finish
    // supplies the color, P5), so the piece token appears only in the SVG overlay:
    // once for the joined-piece fill, once inside the dye-border color-mix. Pieces
    // paint from the --piece-* tokens, so the markup carries the var(), not a hex.
    expect(occurrences(html, PIECE_VAR.blue)).toBe(2);
    expect(occurrences(html, PIECE_VAR.red)).toBe(0);
  });
});

describe('MatLayer', () => {
  it('owns the empty board, so resting cells stay transparent', () => {
    const G = createInitialState(4);
    const html = renderToStaticMarkup(<Board board={G.board} activeColor="blue" />);

    // One molded board per Board, drawn beneath the cell grid (P5).
    expect(occurrences(html, 'data-testid="mat-layer"')).toBe(1);
    // The mat is the sole painter of the empty board: the well face is the only
    // --empty-cell in the markup. A resting Cell that painted it again would sit
    // on top and hide the mold — which is what the transparent branch prevents.
    expect(occurrences(html, 'var(--empty-cell)')).toBe(1);
    expect(occurrences(html, 'background:transparent')).toBe(400);
  });
});

describe('PieceThumb', () => {
  it('shows the color when available and dims when placed', () => {
    const avail = renderToStaticMarkup(<PieceThumb pieceId="I5" color="green" placed={false} />);
    expect(avail.includes(PIECE_VAR.green)).toBe(true);
    expect(avail.includes('opacity:1')).toBe(true);

    const placed = renderToStaticMarkup(<PieceThumb pieceId="I5" color="green" placed={true} />);
    // Study-table design: a placed piece is a dimmed dashed ghost (no fill).
    expect(placed.includes('opacity:0.8')).toBe(true);
    expect(placed.includes(PIECE_VAR.green)).toBe(false); // ghosted, not colored
  });
});

describe('BlokusBoardView', () => {
  it('renders without throwing for 2p / 3p / 4p', () => {
    for (const np of [2, 3, 4] as GameMode[]) {
      const G: GameState = createInitialState(np);
      const props = {
        G,
        ctx: { turn: 1, currentPlayer: '0', numPlayers: np },
      } as unknown as BoardProps<GameState>;
      expect(() => renderToStaticMarkup(<BlokusBoardView {...props} />)).not.toThrow();
    }
  });
});
