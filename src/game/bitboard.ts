/**
 * Bitboard-accelerated legality (AE9). The N×N board is stored as one N-bit
 * word per row (`Uint32Array(N)`, bit x set ⇒ cell (x,y) occupied), so the
 * cell-by-cell scan in `isLegalPlacement` (GAME_SPEC §4) collapses into a handful
 * of masked lookups. F10/Run N showed MCTS is legality-bound (~75 % of time on
 * gen + rollout legality); this module attacks that shared hot path.
 *
 * `BitBoards` is scratch state that lives *outside* `G` (which must stay plain
 * JSON — no typed arrays). Search code builds one and maintains it incrementally
 * via `bbApply`; the pure `isLegalPlacement` stays the reference the differential
 * test in `bitboard.test.ts` validates this against, byte-identical.
 */
import { boardSizeOf, playColorsOf } from './modes';
import type { ByColor, Cell, Color, GameState } from './types';

/**
 * Per-row occupancy words plus, per color, that color's own cells and the lazily
 * derived orthogonal/diagonal dilations used by rules 5 and 4. `dirty[c]` marks a
 * color whose `own` changed since its dilations were last computed.
 */
export interface BitBoards {
  /** Board side length these boards were built for (rows = size, bits per row = size). */
  size: number;
  /** Low `size` bits set — the valid-cell mask for one row. */
  mask: number;
  /** Any-color occupancy, one `size`-bit word per row. */
  occ: Uint32Array;
  /** Per-color own cells. Keyed by the variant's play colors only. */
  own: ByColor<Uint32Array>;
  /** Cells orthogonally adjacent to own[c] (forbidden by rule 5). Lazy. */
  edgeDil: ByColor<Uint32Array>;
  /** Cells diagonally adjacent to own[c] (the rule-4 attach frontier). Lazy. */
  diagDil: ByColor<Uint32Array>;
  /** Whether edgeDil/diagDil for a color need recomputing from own. */
  dirty: ByColor<boolean>;
}

/**
 * The three row-arrays for a color, asserted present. Every caller has already
 * established the color is in play (it came from `playColorsOf` or from a board
 * cell), so a miss is a bug — and the alternative, `?? emptyRows`, would silently
 * report every placement legal.
 */
function rowsFor(bb: BitBoards, color: Color): [Uint32Array, Uint32Array, Uint32Array] {
  const own = bb.own[color];
  const edge = bb.edgeDil[color];
  const diag = bb.diagDil[color];
  if (!own || !edge || !diag) throw new Error(`bitboards hold no rows for ${color}`);
  return [own, edge, diag];
}

function emptyRows(size: number): Uint32Array {
  return new Uint32Array(size);
}

/** Build bitboards from a game state's flat board. */
export function buildBitBoards(G: GameState): BitBoards {
  const SIZE = boardSizeOf(G);
  const mask = (1 << SIZE) - 1; // safe for every supported board size (SIZE < 32)
  const emptyRowsN = () => emptyRows(SIZE);
  const occ = emptyRowsN();
  const own: ByColor<Uint32Array> = {};
  const edgeDil: ByColor<Uint32Array> = {};
  const diagDil: ByColor<Uint32Array> = {};
  const dirty: ByColor<boolean> = {};
  for (const c of playColorsOf(G)) {
    own[c] = emptyRowsN();
    edgeDil[c] = emptyRowsN();
    diagDil[c] = emptyRowsN();
    dirty[c] = true;
  }
  const board = G.board;
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v === null) continue;
    const y = (i / SIZE) | 0;
    const bit = 1 << (i - y * SIZE);
    occ[y] |= bit;
    const rows = own[v];
    if (!rows) throw new Error(`board holds ${v}, which is not in play`);
    rows[y] |= bit;
  }
  return { size: SIZE, mask, occ, own, edgeDil, diagDil, dirty };
}

/** Recompute a color's dilations from its own cells if they went stale. */
function ensureDil(bb: BitBoards, color: Color): void {
  if (!bb.dirty[color]) return;
  const { size: SIZE, mask: MASK } = bb;
  const [own, edge, diag] = rowsFor(bb, color);
  for (let y = 0; y < SIZE; y++) {
    const row = own[y];
    const up = y > 0 ? own[y - 1] : 0;
    const down = y + 1 < SIZE ? own[y + 1] : 0;
    // Orthogonal: left/right of this row, plus the row above and below.
    edge[y] = (((row << 1) | (row >>> 1)) | up | down) & MASK;
    // Diagonal: left/right of the rows above and below.
    diag[y] = (((up | down) << 1) | ((up | down) >>> 1)) & MASK;
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
  startCell: Cell,
): boolean {
  ensureDil(bb, color);
  const SIZE = bb.size;
  const occ = bb.occ;
  const [, edge, diag] = rowsFor(bb, color);
  let attach = false;
  let coversStart = false;
  for (const c of cells) {
    const { x, y } = c;
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return false; // rule 2: bounds
    const bit = 1 << x;
    if (occ[y] & bit) return false; // rule 3: empty
    if (edge[y] & bit) return false; // rule 5: no same-color edge contact
    if (diag[y] & bit) attach = true; // rule 4: diagonal attach
    if (x === startCell.x && y === startCell.y) coversStart = true;
  }
  // Rule 4: first move must cover the start cell; later moves must attach.
  return hasStarted ? attach : coversStart;
}

/** Apply a placement to the bitboards (mirrors applyPlacement's board writes). */
export function bbApply(bb: BitBoards, color: Color, cells: Cell[]): void {
  const occ = bb.occ;
  const [own] = rowsFor(bb, color);
  for (const c of cells) {
    const bit = 1 << c.x;
    occ[c.y] |= bit;
    own[c.y] |= bit;
  }
  bb.dirty[color] = true; // own changed → dilations stale
}

/** Deep clone (for search states that fork). */
export function cloneBitBoards(bb: BitBoards): BitBoards {
  const own: ByColor<Uint32Array> = {};
  const edgeDil: ByColor<Uint32Array> = {};
  const diagDil: ByColor<Uint32Array> = {};
  const dirty: ByColor<boolean> = {};
  for (const c of Object.keys(bb.own) as Color[]) {
    const [o, e, d] = rowsFor(bb, c);
    own[c] = o.slice();
    edgeDil[c] = e.slice();
    diagDil[c] = d.slice();
    dirty[c] = bb.dirty[c];
  }
  return { size: bb.size, mask: bb.mask, occ: bb.occ.slice(), own, edgeDil, diagDil, dirty };
}
