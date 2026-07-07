/**
 * Bitboard-accelerated legality (AE9). The 20×20 board is stored as one 20-bit
 * word per row (`Uint32Array(20)`, bit x set ⇒ cell (x,y) occupied), so the
 * cell-by-cell scan in `isLegalPlacement` (GAME_SPEC §4) collapses into a handful
 * of masked lookups. F10/Run N showed MCTS is legality-bound (~75 % of time on
 * gen + rollout legality); this module attacks that shared hot path.
 *
 * `BitBoards` is scratch state that lives *outside* `G` (which must stay plain
 * JSON — no typed arrays). Search code builds one and maintains it incrementally
 * via `bbApply`; the pure `isLegalPlacement` stays the reference the differential
 * test in `bitboard.test.ts` validates this against, byte-identical.
 */
import { COLOR_ORDER } from './types';
import type { Cell, Color, GameState } from './types';

const SIZE = 20;
const MASK20 = 0xfffff; // low 20 bits = one board row

/**
 * Per-row occupancy words plus, per color, that color's own cells and the lazily
 * derived orthogonal/diagonal dilations used by rules 5 and 4. `dirty[c]` marks a
 * color whose `own` changed since its dilations were last computed.
 */
export interface BitBoards {
  /** Any-color occupancy, one 20-bit word per row. */
  occ: Uint32Array;
  /** Per-color own cells. */
  own: Record<Color, Uint32Array>;
  /** Cells orthogonally adjacent to own[c] (forbidden by rule 5). Lazy. */
  edgeDil: Record<Color, Uint32Array>;
  /** Cells diagonally adjacent to own[c] (the rule-4 attach frontier). Lazy. */
  diagDil: Record<Color, Uint32Array>;
  /** Whether edgeDil/diagDil for a color need recomputing from own. */
  dirty: Record<Color, boolean>;
}

function emptyRows(): Uint32Array {
  return new Uint32Array(SIZE);
}

/** Build bitboards from a game state's flat board. */
export function buildBitBoards(G: GameState): BitBoards {
  const occ = emptyRows();
  const own = {} as Record<Color, Uint32Array>;
  const edgeDil = {} as Record<Color, Uint32Array>;
  const diagDil = {} as Record<Color, Uint32Array>;
  const dirty = {} as Record<Color, boolean>;
  for (const c of COLOR_ORDER) {
    own[c] = emptyRows();
    edgeDil[c] = emptyRows();
    diagDil[c] = emptyRows();
    dirty[c] = true;
  }
  const board = G.board;
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v === null) continue;
    const y = (i / SIZE) | 0;
    const bit = 1 << (i - y * SIZE);
    occ[y] |= bit;
    own[v as Color][y] |= bit;
  }
  return { occ, own, edgeDil, diagDil, dirty };
}

/** Recompute a color's dilations from its own cells if they went stale. */
function ensureDil(bb: BitBoards, color: Color): void {
  if (!bb.dirty[color]) return;
  const own = bb.own[color];
  const edge = bb.edgeDil[color];
  const diag = bb.diagDil[color];
  for (let y = 0; y < SIZE; y++) {
    const row = own[y];
    const up = y > 0 ? own[y - 1] : 0;
    const down = y + 1 < SIZE ? own[y + 1] : 0;
    // Orthogonal: left/right of this row, plus the row above and below.
    edge[y] = (((row << 1) | (row >>> 1)) | up | down) & MASK20;
    // Diagonal: left/right of the rows above and below.
    diag[y] = (((up | down) << 1) | ((up | down) >>> 1)) & MASK20;
  }
  bb.dirty[color] = false;
}

/**
 * Bitboard legality of placing `cells` (already resolved to absolute board cells)
 * for `color`. Enforces GAME_SPEC §4 rules 2–5; rule 1 (piece available) is the
 * caller's responsibility — every caller iterates `remaining`, so the check would
 * be redundant. Byte-identical to `isLegalPlacement` for available pieces.
 */
export function bbLegal(
  bb: BitBoards,
  color: Color,
  cells: Cell[],
  hasStarted: boolean,
  corner: Cell,
): boolean {
  ensureDil(bb, color);
  const occ = bb.occ;
  const edge = bb.edgeDil[color];
  const diag = bb.diagDil[color];
  let attach = false;
  let coversCorner = false;
  for (const c of cells) {
    const { x, y } = c;
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return false; // rule 2: bounds
    const bit = 1 << x;
    if (occ[y] & bit) return false; // rule 3: empty
    if (edge[y] & bit) return false; // rule 5: no same-color edge contact
    if (diag[y] & bit) attach = true; // rule 4: diagonal attach
    if (x === corner.x && y === corner.y) coversCorner = true;
  }
  // Rule 4: first move must cover the start corner; later moves must attach.
  return hasStarted ? attach : coversCorner;
}

/** Apply a placement to the bitboards (mirrors applyPlacement's board writes). */
export function bbApply(bb: BitBoards, color: Color, cells: Cell[]): void {
  const occ = bb.occ;
  const own = bb.own[color];
  for (const c of cells) {
    const bit = 1 << c.x;
    occ[c.y] |= bit;
    own[c.y] |= bit;
  }
  bb.dirty[color] = true; // own changed → dilations stale
}

/** Deep clone (for search states that fork). */
export function cloneBitBoards(bb: BitBoards): BitBoards {
  const own = {} as Record<Color, Uint32Array>;
  const edgeDil = {} as Record<Color, Uint32Array>;
  const diagDil = {} as Record<Color, Uint32Array>;
  const dirty = {} as Record<Color, boolean>;
  for (const c of COLOR_ORDER) {
    own[c] = bb.own[c].slice();
    edgeDil[c] = bb.edgeDil[c].slice();
    diagDil[c] = bb.diagDil[c].slice();
    dirty[c] = bb.dirty[c];
  }
  return { occ: bb.occ.slice(), own, edgeDil, diagDil, dirty };
}
