import { describe, expect, it } from 'vitest';
import { cellOutline } from '../src/client/board/outline';
import { BOARD_SIZE } from '../src/shared/constants';
import { CELL_PX } from '../src/client/theme';

const C = CELL_PX;
const at = (x: number, y: number) => y * BOARD_SIZE + x;

/** How many edge segments the path draws (one `M` per segment). */
const segments = (d: string) => (d.match(/M/g) ?? []).length;

describe('cellOutline — the piece is the border, not its cells (P31)', () => {
  it('a single square is boxed on all four sides', () => {
    expect(segments(cellOutline([at(0, 0)]).outlineD)).toBe(4);
  });

  it('two side-by-side squares drop the seam between them', () => {
    // Six outer edges, not eight: the shared edge is internal to the piece.
    const { outlineD } = cellOutline([at(3, 3), at(4, 3)]);
    expect(segments(outlineD)).toBe(6);
    // The seam at x=4 is exactly what must not be drawn.
    expect(outlineD).not.toContain(`M${4 * C} ${3 * C}v${C}`);
  });

  it('a 2x2 square outlines its perimeter only', () => {
    // 8 perimeter edges; the 4 internal half-edges are gone.
    const cells = [at(1, 1), at(2, 1), at(1, 2), at(2, 2)];
    expect(segments(cellOutline(cells).outlineD)).toBe(8);
  });

  it('an L-pentomino draws every outer edge and no inner one', () => {
    // Perimeter of any polyomino = 4 * cells - 2 * adjacent pairs. This L has 5 cells
    // and 4 adjacencies → 20 - 8 = 12 edges.
    const cells = [at(5, 5), at(5, 6), at(5, 7), at(5, 8), at(6, 8)];
    expect(segments(cellOutline(cells).outlineD)).toBe(12);
  });

  it('cells that only touch at a corner keep both their edges — a diagonal is not a seam', () => {
    // Corner contact shares no edge, so nothing is suppressed: 2 * 4 = 8.
    expect(segments(cellOutline([at(2, 2), at(3, 3)]).outlineD)).toBe(8);
  });

  it('does not wrap around a row edge: column 0 and the previous row are not neighbors', () => {
    // at(0, 5) and at(19, 4) are adjacent *indices* but opposite sides of the board.
    // A naive `c - 1` check would suppress the left edge of the column-0 cell.
    const { outlineD } = cellOutline([at(0, 5), at(BOARD_SIZE - 1, 4)]);
    expect(segments(outlineD)).toBe(8);
    expect(outlineD).toContain(`M0 ${5 * C}v${C}`); // the left edge survives
  });

  it('the fill is one square per cell, for use as the ring’s clip', () => {
    const cells = [at(7, 7), at(8, 7)];
    expect(segments(cellOutline(cells).fillD)).toBe(2);
  });

  it('an empty set draws nothing', () => {
    expect(cellOutline([])).toEqual({ outlineD: '', fillD: '' });
  });
});
