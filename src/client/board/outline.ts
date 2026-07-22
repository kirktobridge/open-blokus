import { CELL_PX } from '../theme';

const C = CELL_PX;

/**
 * SVG paths for a set of board cells (P31): the union of their squares, and the
 * **silhouette** — only the edges that face a cell *outside* the set.
 *
 * A polyomino's border is its outline, not its cells' outlines: box every cell
 * separately and the piece's internal seams get stroked too, so a 5-square piece reads
 * as five boxes instead of one object. Same technique the skeuomorphic bevel already
 * uses per region (`buildRegions`), factored out here so the last-move ring can share it.
 *
 * Pure geometry: no React, no color, no rules — takes board indices (y * size + x)
 * and the board's side length (20 Classic, 14 Duo).
 */
export function cellOutline(
  cells: readonly number[],
  size: number,
): { outlineD: string; fillD: string } {
  const n = size;
  const set = new Set(cells);
  let outlineD = '';
  let fillD = '';

  for (const c of set) {
    const x = c % n;
    const y = (c / n) | 0;
    const px = x * C;
    const py = y * C;
    fillD += `M${px} ${py}h${C}v${C}h${-C}z`;

    // An edge is drawn only where the neighbor across it isn't part of the set. The
    // x-guards matter: `c - 1` at column 0 is the *previous row's* last cell, which
    // would silently suppress a real left edge.
    if (y === 0 || !set.has(c - n)) outlineD += `M${px} ${py}h${C}`;
    if (x === 0 || !set.has(c - 1)) outlineD += `M${px} ${py}v${C}`;
    if (y === n - 1 || !set.has(c + n)) outlineD += `M${px} ${py + C}h${C}`;
    if (x === n - 1 || !set.has(c + 1)) outlineD += `M${px + C} ${py}v${C}`;
  }

  return { outlineD, fillD };
}
