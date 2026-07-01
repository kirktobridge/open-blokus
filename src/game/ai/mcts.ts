/**
 * Monte-Carlo Tree Search strategy (pure, seeded).
 *
 * Maxn UCT: each node is tied to its color-to-move and carries a per-color reward
 * vector, so every player maximizes its *own* outcome (the multiplayer-correct
 * model — unlike alpha-beta's paranoid assumption). Rewards use the placed-square
 * leader, which under basic scoring is exactly the winner at a terminal state and
 * a sensible proxy at a truncated rollout.
 *
 * Blokus's branching factor (hundreds of moves early) means plain MCTS can't even
 * try every root move within a feasible iteration budget, so each node's action
 * set is pruned to the heuristic's top-`beam` (a heuristic prior). Randomness all
 * comes from the passed-in `rng`, keeping tournaments reproducible.
 */
import { BOARD_SIZE } from '../board';
import { generateLegalMoves } from '../moves';
import { applyPlacement, isLegalPlacement } from '../placement';
import { resolveCells, getOrientations } from '../pieces';
import { remainingSquares } from '../scoring';
import { COLOR_ORDER } from '../types';
import type { Cell, Color, GameState, PieceId, Placement } from '../types';
import { cloneState, recomputeStuck, applyAndAdvance } from './simstate';
import { scorePlacement, WEIGHTS } from './heuristic';
import type { Strategy } from './arena';

/** Total squares one color owns across all 21 pieces (sum of sizes). */
const TOTAL_SQUARES = 89;

export interface MctsConfig {
  /** Simulations (select→expand→rollout→backprop) per move decision. */
  iterations: number;
  /** UCT exploration constant. */
  explorationC: number;
  /** Rollout move policy. */
  rolloutPolicy: 'heuristic' | 'random';
  /** Truncate rollouts after this many plies (0 = play to terminal). */
  rolloutDepth: number;
  /** Prune each node's action set to the heuristic's top-K (0 = keep all). */
  beam: number;
}

const DEFAULTS: MctsConfig = {
  iterations: 150,
  explorationC: Math.SQRT2,
  rolloutPolicy: 'heuristic',
  rolloutDepth: 0,
  beam: 16,
};

interface Node {
  G: GameState;
  /** Active color index at this node (the color choosing among children). */
  moverIdx: number;
  terminal: boolean;
  /** The move played from the parent to reach this node (undefined at root). */
  move?: Placement;
  parent?: Node;
  /** Legal moves not yet expanded (lazily filled, heuristic-beamed). */
  untried: Placement[] | null;
  children: Node[];
  N: number;
  /** Per-color accumulated reward (index = COLOR_ORDER index). */
  W: Float64Array;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function isTerminal(G: GameState): boolean {
  return COLOR_ORDER.every((c) => G.colors[c].stuck);
}

function makeNode(G: GameState, parent?: Node, move?: Placement): Node {
  return {
    G,
    moverIdx: G.activeColorIndex,
    terminal: isTerminal(G),
    move,
    parent,
    untried: null,
    children: [],
    N: 0,
    W: new Float64Array(COLOR_ORDER.length),
  };
}

/** Lazily compute (and heuristic-beam) the node's untried legal moves. */
function untriedMoves(node: Node, cfg: MctsConfig): Placement[] {
  if (node.untried !== null) return node.untried;
  if (node.terminal) return (node.untried = []);
  const color = COLOR_ORDER[node.moverIdx];
  let moves = generateLegalMoves(node.G, color);
  if (cfg.beam > 0 && moves.length > cfg.beam) {
    moves = moves
      .map((m) => ({ m, s: scorePlacement(node.G, color, m, WEIGHTS) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, cfg.beam)
      .map((e) => e.m);
  }
  return (node.untried = moves);
}

/** Reward vector: placed-square leader(s) get 1/|leaders|, everyone else 0. */
function rewardVector(G: GameState): Float64Array {
  const placed = COLOR_ORDER.map((c) => TOTAL_SQUARES - remainingSquares(G.colors[c]));
  const max = Math.max(...placed);
  const leaders = placed.filter((p) => p === max).length;
  const r = new Float64Array(COLOR_ORDER.length);
  for (let i = 0; i < placed.length; i++) r[i] = placed[i] === max ? 1 / leaders : 0;
  return r;
}

/** UCT-best child from `node`'s mover's perspective. */
function selectChild(node: Node, cfg: MctsConfig, rng: () => number): Node {
  const logN = Math.log(node.N);
  let best: Node[] = [];
  let bestVal = -Infinity;
  for (const child of node.children) {
    const exploit = child.W[node.moverIdx] / child.N;
    const explore = cfg.explorationC * Math.sqrt(logN / child.N);
    const v = exploit + explore;
    if (v > bestVal) {
      bestVal = v;
      best = [child];
    } else if (v === bestVal) {
      best.push(child);
    }
  }
  return pick(best, rng);
}

/** Descend the tree, expanding one new child when an untried move exists. */
function treePolicy(root: Node, cfg: MctsConfig, rng: () => number): Node {
  let node = root;
  while (!node.terminal) {
    const untried = untriedMoves(node, cfg);
    if (untried.length > 0) {
      const i = Math.floor(rng() * untried.length);
      const move = untried.splice(i, 1)[0];
      const child = makeNode(applyAndAdvance(node.G, node.moverIdx, move), node, move);
      node.children.push(child);
      return child;
    }
    if (node.children.length === 0) return node; // no legal moves but not terminal — safety
    node = selectChild(node, cfg, rng);
  }
  return node;
}

interface SampledMove {
  pieceId: PieceId;
  cells: Cell[];
}

/** How many random (piece, orientation, position) draws to try before giving up. */
const ROLLOUT_ATTEMPTS = 24;
/** Heuristic rollout: legal moves to sample before picking the largest piece. */
const HEURISTIC_SAMPLES = 6;

/**
 * Rejection-sample one legal move for `color`: pick a random remaining piece,
 * orientation, and position; test legality. Rollouts only need *a* legal move,
 * not all of them, so this avoids the (expensive) full move enumeration. Returns
 * null if no legal move was found within the attempt budget — the caller then
 * confirms with a full generation.
 */
function sampleLegalMove(G: GameState, color: Color, rng: () => number): SampledMove | null {
  const remaining = G.colors[color].remaining;
  if (remaining.length === 0) return null;
  for (let a = 0; a < ROLLOUT_ATTEMPTS; a++) {
    const pieceId = remaining[(rng() * remaining.length) | 0];
    const orients = getOrientations(pieceId);
    const base = orients[(rng() * orients.length) | 0];
    let maxX = 0;
    let maxY = 0;
    for (const c of base) {
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    const ox = (rng() * (BOARD_SIZE - maxX)) | 0;
    const oy = (rng() * (BOARD_SIZE - maxY)) | 0;
    const cells = base.map((c) => ({ x: c.x + ox, y: c.y + oy }));
    if (isLegalPlacement(G, color, pieceId, cells)) return { pieceId, cells };
  }
  return null;
}

/** Full-enumeration fallback (rare, endgame): a random legal move, or null. */
function fallbackMove(G: GameState, color: Color, rng: () => number): SampledMove | null {
  const moves = generateLegalMoves(G, color);
  if (moves.length === 0) return null;
  const m = moves[(rng() * moves.length) | 0];
  return { pieceId: m.pieceId, cells: resolveCells(m) };
}

/** One rollout move under the policy, or null if `color` has no legal move. */
function rolloutMove(
  G: GameState,
  color: Color,
  cfg: MctsConfig,
  rng: () => number,
): SampledMove | null {
  if (cfg.rolloutPolicy === 'random') {
    return sampleLegalMove(G, color, rng) ?? fallbackMove(G, color, rng);
  }
  // Heuristic: sample a few legal moves, keep the largest piece (size is the
  // dominant heuristic term — see AI_EXPERIMENTS). Cheap vs full enumeration.
  let best: SampledMove | null = null;
  for (let k = 0; k < HEURISTIC_SAMPLES; k++) {
    const s = sampleLegalMove(G, color, rng);
    if (s && (!best || s.cells.length > best.cells.length)) best = s;
  }
  return best ?? fallbackMove(G, color, rng);
}

/**
 * Play from `G` (a fresh clone) to terminal or the depth cap; return the reward
 * vector. Tracks a "pass streak" instead of recomputing every color's stuck flag
 * each ply (that full recompute is too costly inside a rollout): four consecutive
 * colors with no legal move ⇒ terminal.
 */
function rollout(G: GameState, cfg: MctsConfig, rng: () => number): Float64Array {
  const g = cloneState(G);
  let depth = 0;
  let passStreak = 0;
  let idx = g.activeColorIndex;
  while (cfg.rolloutDepth === 0 || depth < cfg.rolloutDepth) {
    const color = COLOR_ORDER[idx];
    const move = rolloutMove(g, color, cfg, rng);
    if (move) {
      applyPlacement(g, color, move.pieceId, move.cells);
      passStreak = 0;
      depth++;
    } else if (++passStreak >= COLOR_ORDER.length) {
      break; // all four colors stuck → terminal
    }
    idx = (idx + 1) % COLOR_ORDER.length;
  }
  return rewardVector(g);
}

function backprop(leaf: Node, reward: Float64Array): void {
  for (let n: Node | undefined = leaf; n; n = n.parent) {
    n.N += 1;
    for (let i = 0; i < reward.length; i++) n.W[i] += reward[i];
  }
}

/** Build an MCTS strategy. Returns the most-visited root move (robust child). */
export function mctsStrategy(config: Partial<MctsConfig> = {}): Strategy {
  const cfg: MctsConfig = { ...DEFAULTS, ...config };
  return (G, _color, rng) => {
    const rootG = cloneState(G);
    recomputeStuck(rootG);
    const root = makeNode(rootG);
    if (root.terminal) return null;
    const rootMoves = untriedMoves(root, cfg);
    if (rootMoves.length === 0) return null;
    if (rootMoves.length === 1) return rootMoves[0];

    for (let i = 0; i < cfg.iterations; i++) {
      const leaf = treePolicy(root, cfg, rng);
      const reward = leaf.terminal ? rewardVector(leaf.G) : rollout(leaf.G, cfg, rng);
      backprop(leaf, reward);
    }

    // Robust child: highest visit count (ties broken by rng).
    let best: Node[] = [];
    let bestN = -1;
    for (const child of root.children) {
      if (child.N > bestN) {
        bestN = child.N;
        best = [child];
      } else if (child.N === bestN) {
        best.push(child);
      }
    }
    return pick(best, rng).move ?? null;
  };
}
