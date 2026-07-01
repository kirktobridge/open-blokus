import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BoardProps } from 'boardgame.io/react';
import { Board } from '../src/client/board/Board';
import { PieceThumb } from '../src/client/tray/PieceThumb';
import { BlokusBoardView } from '../src/client/BlokusBoardView';
import { COLOR_HEX } from '../src/client/theme';
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
    // 400 cells + 1 grid container = 401 divs.
    expect(occurrences(html, '<div')).toBe(401);
    expect(occurrences(html, COLOR_HEX.blue)).toBe(2);
    expect(occurrences(html, COLOR_HEX.red)).toBe(0);
  });
});

describe('PieceThumb', () => {
  it('shows the color when available and dims when placed', () => {
    const avail = renderToStaticMarkup(
      <PieceThumb pieceId="I5" color="green" colors={COLOR_HEX} placed={false} />,
    );
    expect(avail.includes(COLOR_HEX.green)).toBe(true);
    expect(avail.includes('opacity:1')).toBe(true);

    const placed = renderToStaticMarkup(
      <PieceThumb pieceId="I5" color="green" colors={COLOR_HEX} placed={true} />,
    );
    expect(placed.includes('opacity:0.4')).toBe(true);
    expect(placed.includes(COLOR_HEX.green)).toBe(false); // greyed, not colored
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
