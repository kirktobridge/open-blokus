import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/modes';
import { applyPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { generateLegalMoves } from '../src/game/moves';
import { idx } from '../src/game/board';
import { attachPoints } from '../src/game/ai/alphabeta';
import { COLOR_ORDER } from '../src/game/types';
import { PIECE_IDS } from '../src/game/types';
import {
  deadPieces,
  legalTargetCells,
  legalMovesForPiece,
  roomReadout,
} from '../src/client/advisor/legalMoves';

describe('legalTargetCells (P3 R1 advisor overlay)', () => {
  it("first move: an I2 can only cover its corner's L-shape", () => {
    const G = createInitialState(4);
    // Blue's first move must cover (0,0); an I2 fits horizontally or vertically,
    // so the reachable cells are exactly (0,0), (1,0), (0,1).
    const cells = new Set(legalTargetCells(G, 'blue', 'I2'));
    expect(cells).toEqual(new Set([idx(0, 0), idx(1, 0), idx(0, 1)]));
  });

  it('equals the union of every legal placement of the piece (matches the engine)', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'V3', resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 }));

    const union = new Set<number>();
    for (const p of generateLegalMoves(G, 'blue')) {
      if (p.pieceId !== 'I3') continue;
      for (const c of resolveCells(p)) union.add(idx(c.x, c.y));
    }
    expect(new Set(legalTargetCells(G, 'blue', 'I3'))).toEqual(union);
  });

  it('every highlighted cell is empty and actually coverable', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'V3', resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 }));

    const targets = legalTargetCells(G, 'blue', 'L5');
    const covered = new Set(legalMovesForPiece(G, 'blue', 'L5').flatMap((o) => o.cells));
    for (const cell of targets) {
      expect(G.board[cell], `cell ${cell} should be empty`).toBeNull();
      expect(covered.has(cell), `cell ${cell} should be coverable`).toBe(true);
    }
  });

  it('a piece already placed (unavailable) has no legal targets', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'V3', resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 }));
    expect(legalTargetCells(G, 'blue', 'V3')).toEqual([]); // V3 is spent
  });
});

describe('deadPieces (P39 dead-piece shading)', () => {
  it('opening board: only X5 is dead — the plus can never reach a corner', () => {
    // The X pentomino has no cell at a bounding-box corner, so no orientation can
    // cover a start corner: it's genuinely unplayable as a first move, and the
    // shading tells the truth about it from move zero. Every other piece can start.
    const G = createInitialState(4);
    for (const color of COLOR_ORDER) {
      expect(new Set(deadPieces(G, color))).toEqual(new Set(['X5']));
    }
  });

  it('equals remaining pieces the engine can no longer place (matches generateLegalMoves)', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'V3', resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 }));
    const alive = new Set(generateLegalMoves(G, 'blue').map((p) => p.pieceId));
    const expected = G.colors.blue.remaining.filter((id) => !alive.has(id));
    expect(new Set(deadPieces(G, 'blue'))).toEqual(new Set(expected));
  });

  it('never reports a spent piece — dead is a property of still-held pieces', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'V3', resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 }));
    expect(deadPieces(G, 'blue')).not.toContain('V3'); // V3 is spent, not "dead"
  });

  it('a color that can never move (start corner taken) is dead across its whole inventory', () => {
    const G = createInitialState(4);
    // Occupy blue's start corner (0,0) with another color: blue hasn't started, so
    // its only legal first move must cover (0,0) — now impossible. Every held piece
    // is dead by definition.
    applyPlacement(G, 'red', 'I1', [{ x: 0, y: 0 }]);
    expect(generateLegalMoves(G, 'blue')).toEqual([]);
    expect(new Set(deadPieces(G, 'blue'))).toEqual(new Set(PIECE_IDS));
  });
});

describe('roomReadout (P34 M2 live room meter)', () => {
  it('opening board: every color shows its single starting corner (room 1)', () => {
    const readout = roomReadout(createInitialState(4));
    expect(readout).toHaveLength(COLOR_ORDER.length);
    expect(readout.every((e) => e.room === 1)).toBe(true);
  });

  it('reports the shared attachPoints signal for every color', () => {
    const G = createInitialState(4);
    applyPlacement(G, 'blue', 'V3', resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 }));
    for (const { color, room } of roomReadout(G)) {
      expect(room).toBe(attachPoints(G, color));
    }
  });

  it('sorts roomiest-first — the color that just spread leads', () => {
    const G = createInitialState(4);
    // A V3 in blue's corner opens more attach-points than the other colors' lone
    // starting corners, so blue must sort ahead of everyone still on 1.
    applyPlacement(G, 'blue', 'V3', resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 }));
    const readout = roomReadout(G);
    expect(readout[0].color).toBe('blue');
    expect(readout[0].room).toBeGreaterThan(1);
    for (let i = 1; i < readout.length; i++) {
      expect(readout[i - 1].room).toBeGreaterThanOrEqual(readout[i].room);
    }
  });
});
