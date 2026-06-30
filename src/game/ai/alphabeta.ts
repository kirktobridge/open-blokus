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
import { generateLegalMoves, hasAnyMove } from '../moves';
import { applyPlacement } from '../placement';
import { remainingSquares } from '../scoring';
import { COLOR_ORDER } from '../types';
import type { Color, ColorState, GameState, Placement } from '../types';
import { scorePlacement, WEIGHTS } from './heuristic';
import type { Weights } from './heuristic';
import type { Strategy } from './arena';
import { CORNERS } from '../modes';

/** Total squares one color owns across all 21 pieces (sum of sizes). */
const TOTAL_SQUARES = 89;

export interface AlphaBetaConfig {
  /** Plies to search, counting the searching color's own move as ply 1. */
  depth: number;
  /** Max moves kept per node after static ordering. */
  beam: number;
  /** Weights for the static move-ordering heuristic. */
  weights: Weights;
  /** Eval term weights. */
  placedWeight: number;
  mobilityWeight: number;
}

const DEFAULTS: AlphaBetaConfig = {
  depth: 2,
  beam: 10,
  weights: WEIGHTS,
  placedWeight: 1,
  mobilityWeight: 0.5,
};

// --- State cloning (search must not mutate the live G) ---------------------

function cloneColorState(cs: ColorState): ColorState {
  return {
    remaining: cs.remaining.slice(),
    lastPlaced: cs.lastPlaced,
    hasStarted: cs.hasStarted,
    stuck: cs.stuck,
  };
}

function cloneState(G: GameState): GameState {
  const colors = {} as Record<Color, ColorState>;
  for (const c of COLOR_ORDER) colors[c] = cloneColorState(G.colors[c]);
  return {
    config: G.config, // immutable — safe to share
    board: G.board.slice(),
    colors,
    activeColorIndex: G.activeColorIndex,
    sharedRotation: G.sharedRotation,
    lastMove: [],
  };
}

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

/** State value from `me`'s perspective: my standing minus the opponents' mean. */
function evalState(G: GameState, me: Color, cfg: AlphaBetaConfig): number {
  let mine = 0;
  let oppSum = 0;
  let oppCount = 0;
  for (const c of COLOR_ORDER) {
    const v =
      placedSquares(G.colors[c]) * cfg.placedWeight +
      attachPoints(G, c) * cfg.mobilityWeight;
    if (c === me) mine = v;
    else {
      oppSum += v;
      oppCount++;
    }
  }
  return mine - (oppCount ? oppSum / oppCount : 0);
}

// --- Search ---------------------------------------------------------------

function nextColorIndex(G: GameState, from: number): number {
  for (let step = 1; step <= COLOR_ORDER.length; step++) {
    const i = (from + step) % COLOR_ORDER.length;
    if (!G.colors[COLOR_ORDER[i]].stuck) return i;
  }
  return from;
}

/** Top-`beam` legal moves for `color`, ordered by the static heuristic (desc). */
function orderedMoves(G: GameState, color: Color, cfg: AlphaBetaConfig): Placement[] {
  const moves = generateLegalMoves(G, color);
  if (moves.length <= cfg.beam) {
    return moves.sort(
      (a, b) =>
        scorePlacement(G, color, b, cfg.weights) - scorePlacement(G, color, a, cfg.weights),
    );
  }
  return moves
    .map((m) => ({ m, s: scorePlacement(G, color, m, cfg.weights) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, cfg.beam)
    .map((e) => e.m);
}

function applyAndAdvance(G: GameState, colorIdx: number, move: Placement): GameState {
  const G2 = cloneState(G);
  const color = COLOR_ORDER[colorIdx];
  applyPlacement(G2, color, move.pieceId, resolveCells(move));
  for (const c of COLOR_ORDER) G2.colors[c].stuck = !hasAnyMove(G2, c);
  G2.activeColorIndex = nextColorIndex(G2, colorIdx);
  return G2;
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
  const moves = orderedMoves(G, color, cfg);

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
    const moves = orderedMoves(G, color, cfg);
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
