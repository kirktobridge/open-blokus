/**
 * Depth-limited paranoid alpha-beta search strategy (pure).
 *
 * Blokus has a huge branching factor (hundreds of legal moves early), so a full
 * tree is infeasible — cchung89 noted only depth 2-3 is practical. We therefore
 * BEAM-prune: at every node, order moves by the static heuristic and keep only
 * the top `beam`, then alpha-beta over that reduced set.
 *
 * Multiplayer model = "paranoid": from the searching color's view, it maximizes
 * its own eval and the other three colors are assumed to minimize it. This is
 * pessimistic but lets ordinary alpha-beta pruning apply.
 */
import { idx, inBounds, orthoNeighbors, diagNeighbors } from '../board';
import { resolveCells } from '../pieces';
import { generateLegalMoves } from '../moves';
import { applyPlacement } from '../placement';
import { remainingSquares } from '../scoring';
import { COLOR_ORDER } from '../types';
import type { Color, ColorState, GameState, Placement } from '../types';
import { scorePlacement, WEIGHTS } from './heuristic';
import type { Weights } from './heuristic';
import type { Strategy } from './arena';
import { cloneState, applyAndAdvance } from './simstate';
import { CORNERS } from '../modes';

/** Total squares one color owns across all 21 pieces (sum of sizes). */
const TOTAL_SQUARES = 89;

export interface AlphaBetaConfig {
  /** Plies to search, counting the searching color's own move as ply 1. */
  depth: number;
  /** Max moves kept per node after ordering. */
  beam: number;
  /**
   * How to rank/prune candidate moves at each node:
   * - `heuristic`: by the static placement heuristic (cheap, but the beam can
   *   then only re-rank the heuristic's top-K — see AI_EXPERIMENTS Run E).
   * - `eval`: by the one-ply state eval of each move (decouples the search from
   *   the heuristic, at the cost of an apply+eval per candidate).
   */
  ordering: 'heuristic' | 'eval';
  /** Weights for the static move-ordering heuristic (when ordering = heuristic). */
  weights: Weights;
  /** Eval term weights. */
  placedWeight: number;
  mobilityWeight: number;
  /** Voronoi territory-control weight (0 = off, skips the BFS). */
  territoryWeight: number;
}

const DEFAULTS: AlphaBetaConfig = {
  depth: 2,
  beam: 10,
  ordering: 'heuristic',
  weights: WEIGHTS,
  placedWeight: 1,
  mobilityWeight: 0.5,
  territoryWeight: 0,
};

// --- Evaluation -----------------------------------------------------------

/** Squares this color has placed on the board. */
function placedSquares(cs: ColorState): number {
  return TOTAL_SQUARES - remainingSquares(cs);
}

/**
 * Count empty cells that are legal corner attach-points for `color` — a cheap
 * mobility proxy (true legal-move count is the search bottleneck). A cell counts
 * if it's diagonally adjacent to the color and not orthogonally adjacent to it.
 * Before the color's first move, only its assigned corner counts.
 */
function attachPoints(G: GameState, color: Color): number {
  if (!G.colors[color].hasStarted) {
    const corner = CORNERS[color];
    return G.board[idx(corner.x, corner.y)] === null ? 1 : 0;
  }
  let n = 0;
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      if (G.board[idx(x, y)] !== null) continue;
      const cell = { x, y };
      const diagOwn = diagNeighbors(cell).some(
        (d) => inBounds(d.x, d.y) && G.board[idx(d.x, d.y)] === color,
      );
      if (!diagOwn) continue;
      const orthoOwn = orthoNeighbors(cell).some(
        (o) => inBounds(o.x, o.y) && G.board[idx(o.x, o.y)] === color,
      );
      if (!orthoOwn) n++;
    }
  }
  return n;
}

const SIZE = 20;
const COLOR_IDX: Record<Color, number> = Object.fromEntries(
  COLOR_ORDER.map((c, i) => [c, i]),
) as Record<Color, number>;
const CONTESTED = -2;

/**
 * Voronoi-style territory: a single 8-connected multi-source BFS from every
 * placed cell, flowing through empty space. Each empty cell is claimed by the
 * nearest color (Chebyshev distance, matching diagonal expansion); cells tied
 * between colors are contested and count for no one. Returns each color's claimed
 * empty-cell count — a measure of open space it is positioned to reach first.
 */
function territoryControl(G: GameState): number[] {
  const owner = new Int8Array(SIZE * SIZE).fill(-1);
  const dist = new Int16Array(SIZE * SIZE).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < G.board.length; i++) {
    const cell = G.board[i];
    if (cell !== null) {
      owner[i] = COLOR_IDX[cell];
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const cx = i % SIZE;
    const cy = (i / SIZE) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        const j = ny * SIZE + nx;
        if (G.board[j] !== null) continue; // flow only through empty space
        const nd = dist[i] + 1;
        if (dist[j] === -1) {
          dist[j] = nd;
          owner[j] = owner[i];
          queue.push(j);
        } else if (dist[j] === nd && owner[j] !== owner[i]) {
          owner[j] = CONTESTED; // equidistant from two colors → neutral
        }
      }
    }
  }
  const counts = new Array(COLOR_ORDER.length).fill(0);
  for (let i = 0; i < owner.length; i++) {
    if (G.board[i] === null && owner[i] >= 0) counts[owner[i]]++;
  }
  return counts;
}

/** State value from `me`'s perspective: my standing minus the opponents' mean. */
function evalState(G: GameState, me: Color, cfg: AlphaBetaConfig): number {
  const territory = cfg.territoryWeight !== 0 ? territoryControl(G) : null;
  let mine = 0;
  let oppSum = 0;
  let oppCount = 0;
  for (const c of COLOR_ORDER) {
    const v =
      placedSquares(G.colors[c]) * cfg.placedWeight +
      attachPoints(G, c) * cfg.mobilityWeight +
      (territory ? territory[COLOR_IDX[c]] * cfg.territoryWeight : 0);
    if (c === me) mine = v;
    else {
      oppSum += v;
      oppCount++;
    }
  }
  return mine - (oppCount ? oppSum / oppCount : 0);
}

// --- Search ---------------------------------------------------------------

/**
 * Eval of the state reached if `color` plays `move` — from `color`'s own
 * perspective. Cheaper than applyAndAdvance (no stuck recompute / advance, which
 * the eval doesn't read), so it's affordable as a move-ordering key.
 */
function evalAfterMove(
  G: GameState,
  colorIdx: number,
  move: Placement,
  cfg: AlphaBetaConfig,
): number {
  const G2 = cloneState(G);
  const color = COLOR_ORDER[colorIdx];
  applyPlacement(G2, color, move.pieceId, resolveCells(move));
  return evalState(G2, color, cfg);
}

/** Top-`beam` legal moves for the active color, ordered by `cfg.ordering` (desc). */
function orderedMoves(G: GameState, colorIdx: number, cfg: AlphaBetaConfig): Placement[] {
  const color = COLOR_ORDER[colorIdx];
  const moves = generateLegalMoves(G, color);
  const key =
    cfg.ordering === 'eval'
      ? (m: Placement) => evalAfterMove(G, colorIdx, m, cfg)
      : (m: Placement) => scorePlacement(G, color, m, cfg.weights);
  const scored = moves.map((m) => ({ m, s: key(m) })).sort((a, b) => b.s - a.s);
  return (scored.length <= cfg.beam ? scored : scored.slice(0, cfg.beam)).map((e) => e.m);
}

function search(
  G: GameState,
  me: Color,
  depth: number,
  alpha: number,
  beta: number,
  cfg: AlphaBetaConfig,
): number {
  if (depth === 0 || COLOR_ORDER.every((c) => G.colors[c].stuck)) {
    return evalState(G, me, cfg);
  }
  const colorIdx = G.activeColorIndex;
  const color = COLOR_ORDER[colorIdx];
  const maximizing = color === me;
  const moves = orderedMoves(G, colorIdx, cfg);

  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const child = applyAndAdvance(G, colorIdx, m);
    const val = search(child, me, depth - 1, alpha, beta, cfg);
    if (maximizing) {
      if (val > best) best = val;
      if (best > alpha) alpha = best;
    } else {
      if (val < best) best = val;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break; // prune
  }
  return best;
}

/**
 * Build an alpha-beta strategy. Returns the move with the best searched value;
 * ties broken with `rng`.
 */
export function alphaBetaStrategy(config: Partial<AlphaBetaConfig> = {}): Strategy {
  const cfg: AlphaBetaConfig = { ...DEFAULTS, ...config };
  return (G, color, rng) => {
    const idxOf = COLOR_ORDER.indexOf(color);
    const moves = orderedMoves(G, idxOf, cfg);
    if (moves.length === 0) return null;

    let bestVal = -Infinity;
    let best: Placement[] = [];
    for (const m of moves) {
      const child = applyAndAdvance(G, idxOf, m);
      const val = search(child, color, cfg.depth - 1, -Infinity, Infinity, cfg);
      if (val > bestVal) {
        bestVal = val;
        best = [m];
      } else if (val === bestVal) {
        best.push(m);
      }
    }
    return best[Math.floor(rng() * best.length)] ?? best[0];
  };
}
