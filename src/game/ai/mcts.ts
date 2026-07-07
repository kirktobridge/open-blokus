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
import { CORNERS } from '../modes';
import { generateLegalMoves } from '../moves';
import { applyPlacement } from '../placement';
import { buildBitBoards, bbApply, bbLegal } from '../bitboard';
import type { BitBoards } from '../bitboard';
import { resolveCells, getOrientations } from '../pieces';
import { remainingSquares } from '../scoring';
import { COLOR_ORDER } from '../types';
import type { Cell, Color, GameState, PieceId, Placement } from '../types';
import { cloneState, recomputeStuck, applyAndAdvance } from './simstate';
import { chooseMove, scorePlacement, WEIGHTS } from './heuristic';
import type { Strategy } from './arena';

/** Total squares one color owns across all 21 pieces (sum of sizes). */
const TOTAL_SQUARES = 89;

export interface MctsConfig {
  /**
   * Fixed simulation count per move. Used when `timeBudgetMs` is unset — this is
   * the deterministic mode the arena and tests rely on for reproducibility.
   */
  iterations: number;
  /**
   * If set (> 0), search until this many milliseconds elapse instead of a fixed
   * `iterations` count (for live play). Nondeterministic — iterations completed
   * depend on machine speed. Takes precedence over `iterations` when set.
   */
  timeBudgetMs?: number;
  /**
   * Trust threshold: if the search completes fewer than this many iterations
   * (e.g. a too-small budget on a slow machine), the tree is deemed
   * untrustworthy and we fall back to the heuristic's move. A tunable knob for
   * "how little search is too little" — not a magic constant.
   */
  minIterations: number;
  /** UCT exploration constant. */
  explorationC: number;
  /** Rollout move policy. */
  rolloutPolicy: 'heuristic' | 'random';
  /** Truncate rollouts after this many plies (0 = play to terminal). */
  rolloutDepth: number;
  /** Prune each node's action set to the heuristic's top-K (0 = keep all). */
  beam: number;
  /**
   * Enable RAVE / AMAF value sharing (AE3). When on, every simulation's moves
   * warm up the AMAF estimate of *sibling* actions, blended into selection via a
   * β schedule that decays to pure UCT as real visits accrue. Off = byte-identical
   * plain-UCT behaviour (no tracking overhead).
   */
  rave: boolean;
  /** RAVE equivalence parameter k: β = √(k / (3N + k)). Larger = trust AMAF longer. */
  raveK: number;
  /**
   * Leaf evaluator replacing rollouts (AE4): returns a per-color reward vector
   * (COLOR_ORDER order, same scale as rewardVector — entries in [0,1] summing
   * to 1) for a non-terminal leaf. Injected as a function so this module stays
   * decoupled from any model; ignored on the RAVE path (needs rollout moves).
   */
  leafValue?: (G: GameState) => ArrayLike<number>;
}

const DEFAULTS: MctsConfig = {
  iterations: 150,
  minIterations: 8,
  explorationC: Math.SQRT2,
  rolloutPolicy: 'heuristic',
  rolloutDepth: 0,
  beam: 16,
  rave: false,
  raveK: 1000,
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
  /** AMAF visit count (RAVE only). */
  N_amaf: number;
  /** Per-color AMAF accumulated reward (RAVE only). */
  W_amaf: Float64Array;
  /**
   * Cell-set key of the move that reaches this node (RAVE only), used to match
   * this action against moves played later in a simulation. Undefined at root.
   */
  key?: string;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function isTerminal(G: GameState): boolean {
  return COLOR_ORDER.every((c) => G.colors[c].stuck);
}

/** Cell-set key: sorted board indices of the occupied cells (order-independent). */
function moveKey(cells: Cell[]): string {
  return cells
    .map((c) => c.y * BOARD_SIZE + c.x)
    .sort((a, b) => a - b)
    .join(',');
}

function makeNode(G: GameState, parent?: Node, move?: Placement, rave = false): Node {
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
    N_amaf: 0,
    W_amaf: new Float64Array(COLOR_ORDER.length),
    key: rave && move ? moveKey(resolveCells(move)) : undefined,
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
    const uct = child.W[node.moverIdx] / child.N;
    let exploit = uct;
    if (cfg.rave && child.N_amaf > 0) {
      const amaf = child.W_amaf[node.moverIdx] / child.N_amaf;
      const beta = Math.sqrt(cfg.raveK / (3 * child.N + cfg.raveK));
      exploit = beta * amaf + (1 - beta) * uct;
    }
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
      const child = makeNode(applyAndAdvance(node.G, node.moverIdx, move), node, move, cfg.rave);
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
function sampleLegalMove(
  G: GameState,
  color: Color,
  rng: () => number,
  bb: BitBoards,
): SampledMove | null {
  const remaining = G.colors[color].remaining;
  if (remaining.length === 0) return null;
  const hasStarted = G.colors[color].hasStarted;
  const corner = CORNERS[color];
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
    if (bbLegal(bb, color, cells, hasStarted, corner)) return { pieceId, cells };
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
  bb: BitBoards,
): SampledMove | null {
  if (cfg.rolloutPolicy === 'random') {
    return sampleLegalMove(G, color, rng, bb) ?? fallbackMove(G, color, rng);
  }
  // Heuristic: sample a few legal moves, keep the largest piece (size is the
  // dominant heuristic term — see research/log/ai-strategy.md). Cheap vs full enumeration.
  let best: SampledMove | null = null;
  for (let k = 0; k < HEURISTIC_SAMPLES; k++) {
    const s = sampleLegalMove(G, color, rng, bb);
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
  const bb = buildBitBoards(g);
  let depth = 0;
  let passStreak = 0;
  let idx = g.activeColorIndex;
  while (cfg.rolloutDepth === 0 || depth < cfg.rolloutDepth) {
    const color = COLOR_ORDER[idx];
    const move = rolloutMove(g, color, cfg, rng, bb);
    if (move) {
      applyPlacement(g, color, move.pieceId, move.cells);
      bbApply(bb, color, move.cells);
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

/**
 * RAVE rollout: identical policy to `rollout`, but also records each played
 * move's cell-key into `played[colorIdx]` so the AMAF backprop can credit sibling
 * actions. Kept separate so the plain-UCT path carries zero tracking overhead.
 */
function rolloutRave(
  G: GameState,
  cfg: MctsConfig,
  rng: () => number,
  played: Set<string>[],
): Float64Array {
  const g = cloneState(G);
  const bb = buildBitBoards(g);
  let depth = 0;
  let passStreak = 0;
  let idx = g.activeColorIndex;
  while (cfg.rolloutDepth === 0 || depth < cfg.rolloutDepth) {
    const color = COLOR_ORDER[idx];
    const move = rolloutMove(g, color, cfg, rng, bb);
    if (move) {
      applyPlacement(g, color, move.pieceId, move.cells);
      bbApply(bb, color, move.cells);
      played[idx].add(moveKey(move.cells));
      passStreak = 0;
      depth++;
    } else if (++passStreak >= COLOR_ORDER.length) {
      break;
    }
    idx = (idx + 1) % COLOR_ORDER.length;
  }
  return rewardVector(g);
}

/**
 * RAVE backprop: standard visit/reward update, plus AMAF. Descent moves are
 * folded into `played` first, then for each node on the path every child whose
 * action that node's mover played anywhere in the simulation gets its AMAF stats
 * bumped with the same reward (the sibling value-sharing that warms up selection).
 */
function backpropRave(leaf: Node, reward: Float64Array, played: Set<string>[]): void {
  for (let n: Node = leaf; n.parent; n = n.parent) {
    if (n.key !== undefined) played[n.parent.moverIdx].add(n.key);
  }
  for (let n: Node | undefined = leaf; n; n = n.parent) {
    n.N += 1;
    for (let i = 0; i < reward.length; i++) n.W[i] += reward[i];
    const playedByMover = played[n.moverIdx];
    for (const child of n.children) {
      if (child.key !== undefined && playedByMover.has(child.key)) {
        child.N_amaf += 1;
        for (let i = 0; i < reward.length; i++) child.W_amaf[i] += reward[i];
      }
    }
  }
}

/** Opaque handle to a persisted search tree, for cross-turn reuse (see mctsSearch). */
export type MctsNode = Node;

export interface MctsSearchResult {
  move: Placement | null;
  /** The searched root — pass back as `priorRoot` next turn to reuse the subtree. */
  root: MctsNode | null;
}

function sameBoard(a: (Color | null)[], b: (Color | null)[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Find the descendant of a previous root that matches the current position `G`
 * (same board and color-to-move), so its accumulated statistics can be reused.
 * The match is at most one of our moves plus the opponents' replies deep, so we
 * BFS a few levels. Returns the detached node, or null if the played line wasn't
 * in the tree (then the caller starts fresh).
 */
function reRoot(prior: Node, G: GameState): Node | null {
  let frontier = prior.children;
  for (let depth = 1; depth <= COLOR_ORDER.length; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      if (node.moverIdx === G.activeColorIndex && sameBoard(node.G.board, G.board)) {
        node.parent = undefined; // detach so backprop stops here
        return node;
      }
      for (const c of node.children) next.push(c);
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}

/**
 * Core search. Runs a fixed `iterations` count (deterministic) or until
 * `timeBudgetMs` elapses (live play). If `priorRoot` is given and the current
 * position is found within it, that subtree is reused (its visit statistics carry
 * over); otherwise a fresh tree is built. Returns the chosen move and the root to
 * pass back next turn. Falls back to the heuristic if the tree has fewer than
 * `minIterations` total visits.
 */
export function mctsSearch(
  G: GameState,
  color: Color,
  rng: () => number,
  config: Partial<MctsConfig> = {},
  priorRoot?: MctsNode | null,
): MctsSearchResult {
  const cfg: MctsConfig = { ...DEFAULTS, ...config };

  let root: Node | null = priorRoot ? reRoot(priorRoot, G) : null;
  if (!root) {
    const rootG = cloneState(G);
    recomputeStuck(rootG);
    root = makeNode(rootG);
  }
  if (root.terminal) return { move: null, root: null };
  const rootMoves = untriedMoves(root, cfg);
  if (rootMoves.length === 0) return { move: null, root: null };
  if (rootMoves.length === 1) return { move: rootMoves[0], root };

  // Time-budget mode checks the deadline between iterations (worst-case overshoot
  // is one rollout); otherwise run the fixed iteration count.
  const timed = cfg.timeBudgetMs != null && cfg.timeBudgetMs > 0;
  const deadline = timed ? Date.now() + cfg.timeBudgetMs! : 0;
  let iters = 0;
  while (timed ? Date.now() < deadline : iters < cfg.iterations) {
    const leaf = treePolicy(root, cfg, rng);
    if (cfg.rave) {
      const played = COLOR_ORDER.map(() => new Set<string>());
      const reward = leaf.terminal ? rewardVector(leaf.G) : rolloutRave(leaf.G, cfg, rng, played);
      backpropRave(leaf, reward, played);
    } else {
      const reward = leaf.terminal
        ? rewardVector(leaf.G)
        : cfg.leafValue
          ? Float64Array.from(cfg.leafValue(leaf.G) as number[])
          : rollout(leaf.G, cfg, rng);
      backprop(leaf, reward);
    }
    iters++;
  }

  // Trust the tree only if it has enough total visits (reuse counts toward this).
  if (root.N < cfg.minIterations) return { move: chooseMove(root.G, color, rng), root };

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
  return { move: (best.length ? pick(best, rng).move : undefined) ?? null, root };
}

/**
 * MCTS as a stateless Strategy (fresh tree each call) — used by the arena and
 * tests, where reproducibility matters. Live play uses mctsSearch with a
 * persisted root for cross-turn tree reuse.
 */
export function mctsStrategy(config: Partial<MctsConfig> = {}): Strategy {
  return (G, color, rng) => mctsSearch(G, color, rng, config).move;
}
