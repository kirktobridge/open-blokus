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
import { boardSizeOf, colorStateOf, playColorsOf, startCellOf } from '../modes';
import { generateLegalMoves } from '../moves';
import { applyPlacement } from '../placement';
import { buildBitBoards, bbApply, bbLegal } from '../bitboard';
import type { BitBoards } from '../bitboard';
import { resolveCells, getOrientations } from '../pieces';
import { remainingSquares } from '../scoring';

import type { Cell, Color, GameState, PieceId, Placement } from '../types';
import { cloneState, recomputeStuck, applyAndAdvance } from './simstate';
import { chooseMove, scoreCells, scorePlacement, WEIGHTS } from './heuristic';
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
  /**
   * Rollout move policy (AE11). All non-`random` policies rejection-sample
   * `rolloutSamples` legal candidates and then choose among them:
   * - `random`   — first legal sample, no choice at all.
   * - `heuristic`— keep the largest piece (size only). The pre-AE11 default.
   * - `score`    — keep the best full heuristic score (size + frontier + center
   *                + block), i.e. greedy over the same signal the beam uses.
   * - `softmax`  — sample ∝ exp(score / rolloutTemperature) (Pentobi's
   *                gamma-sampled playout in spirit): biased, but not greedy, so
   *                rollouts keep the variance that makes their outcomes informative.
   */
  rolloutPolicy: 'heuristic' | 'random' | 'score' | 'softmax';
  /**
   * Legal candidates to rejection-sample per rollout move before choosing among
   * them (ignored by `random`). Larger = better rollout moves, fewer rollouts.
   */
  rolloutSamples: number;
  /**
   * Softmax temperature over candidate scores (`softmax` only). Scores span
   * roughly 10–60, so T≈8 is moderately peaked; T→0 degenerates to `score`,
   * T→∞ to a uniform pick among the samples.
   */
  rolloutTemperature: number;
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
  /**
   * Reward shaping (AE15): blend a rank-normalized placement term into the
   * winner-take-all reward so a losing color still fights for 2nd vs 4th. The
   * per-color reward becomes `(1−w)·winner + w·rankNorm`, where `rankNorm` is
   * Pentobi's ties-averaged rank result `(beaten + (tied−1)/2)/(n−1)` over placed
   * squares (best→1, worst→0). Default `0.25` is F15's shipped weight (P36 — buys
   * lost-position placement at no win-rate cost, and a non-degenerate advisor value
   * signal). `0` = pure winner-take-all (byte-identical to the pre-AE15 reward);
   * `1` = pure rank-normalized margin.
   */
  rankRewardWeight: number;
}

/** Base config every `mctsSearch`/`mctsStrategy` call is layered over. */
export const DEFAULTS: MctsConfig = {
  iterations: 150,
  minIterations: 8,
  explorationC: Math.SQRT2,
  rolloutPolicy: 'heuristic',
  rolloutSamples: 6,
  rolloutTemperature: 8,
  rolloutDepth: 0,
  beam: 16,
  rave: false,
  raveK: 1000,
  rankRewardWeight: 0.25,
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
  return playColorsOf(G).every((c) => colorStateOf(G, c).stuck);
}

/**
 * Cell-set key: sorted board indices of the occupied cells (order-independent).
 * `size` is the board's side length — a key is only ever compared against other
 * keys from the same tree, so the stride just has to be consistent within one.
 */
function moveKey(cells: Cell[], size: number): string {
  return cells
    .map((c) => c.y * size + c.x)
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
    W: new Float64Array(playColorsOf(G).length),
    N_amaf: 0,
    W_amaf: new Float64Array(playColorsOf(G).length),
    key: rave && move ? moveKey(resolveCells(move), boardSizeOf(G)) : undefined,
  };
}

/** Lazily compute (and heuristic-beam) the node's untried legal moves. */
function untriedMoves(node: Node, cfg: MctsConfig): Placement[] {
  if (node.untried !== null) return node.untried;
  if (node.terminal) return (node.untried = []);
  const color = playColorsOf(node.G)[node.moverIdx];
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

/**
 * Reward vector over COLOR_ORDER. Base term is winner-take-all: placed-square
 * leader(s) get 1/|leaders|, everyone else 0. With `cfg.rankRewardWeight > 0`
 * (AE15) a rank-normalized placement term is blended in so a losing color still
 * has a gradient between 2nd and 4th: `(1−w)·winner + w·rankNorm`, where rankNorm
 * is Pentobi's ties-averaged rank `(beaten + (tied−1)/2)/(n−1)` (best→1, worst→0).
 * At w=0 this is byte-identical to the pre-AE15 winner-take-all vector.
 */
export function rewardVector(G: GameState, cfg: MctsConfig): Float64Array {
  const play = playColorsOf(G);
  const placed = play.map((c) => TOTAL_SQUARES - remainingSquares(colorStateOf(G, c)));
  const max = Math.max(...placed);
  const leaders = placed.filter((p) => p === max).length;
  const r = new Float64Array(play.length);
  const w = cfg.rankRewardWeight;
  const n = play.length;
  for (let i = 0; i < placed.length; i++) {
    const winner = placed[i] === max ? 1 / leaders : 0;
    if (w <= 0) {
      r[i] = winner;
      continue;
    }
    let beaten = 0;
    let tied = 0;
    for (let j = 0; j < placed.length; j++) {
      if (placed[j] < placed[i]) beaten++;
      else if (placed[j] === placed[i]) tied++;
    }
    const rankNorm = (beaten + (tied - 1) / 2) / (n - 1);
    r[i] = (1 - w) * winner + w * rankNorm;
  }
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

/**
 * Opt-in rollout-sampling instrumentation (P37). A non-`random` rollout policy draws
 * `rolloutSamples` legal moves per rollout move and picks among them (`rolloutMove`).
 * At width 48 (extreme, AE28/F18) that pool routinely exceeds the legal-move count in
 * sparse endgames, so most draws are duplicates (sample-with-replacement waste) and
 * some miss entirely, falling through to the full-enumeration `fallbackMove`. It's
 * pure wasted cycles — no correctness risk — and was previously unmeasured. These
 * counters quantify it; `--rollout-stats` in arena.cli reads them.
 *
 * Disabled by default: `rolloutStats` is null, so the hot path pays one null-check per
 * sample and never allocates. Enabling trades that for a per-call key set.
 */
export interface RolloutStats {
  /** Rollout moves resolved under a non-`random` policy (the denominator). */
  moves: number;
  /** Individual `sampleLegalMove` draws across those moves (≈ moves × rolloutSamples). */
  samples: number;
  /** Draws that returned null (rejection sampling found no legal move in its budget). */
  nullSamples: number;
  /** Distinct legal moves seen (by cell-key), summed per rollout move. */
  distinct: number;
  /** Rollout moves that fell through to the full-enumeration `fallbackMove`. */
  fallbacks: number;
}

let rolloutStats: RolloutStats | null = null;

/** Turn rollout instrumentation on (fresh zeroed counters) or off (`false`). */
export function enableRolloutStats(on = true): void {
  rolloutStats = on ? { moves: 0, samples: 0, nullSamples: 0, distinct: 0, fallbacks: 0 } : null;
}

/** Current counters, or null when instrumentation is off. */
export function getRolloutStats(): Readonly<RolloutStats> | null {
  return rolloutStats;
}

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
  const cs = colorStateOf(G, color);
  const remaining = cs.remaining;
  if (remaining.length === 0) return null;
  const hasStarted = cs.hasStarted;
  const start = startCellOf(G, color);
  const size = boardSizeOf(G);
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
    const ox = (rng() * (size - maxX)) | 0;
    const oy = (rng() * (size - maxY)) | 0;
    const cells = base.map((c) => ({ x: c.x + ox, y: c.y + oy }));
    if (bbLegal(bb, color, cells, hasStarted, start)) return { pieceId, cells };
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

/** Record one rollout draw (P37 instrumentation; a no-op when stats are off). */
function statSample(s: SampledMove | null, keys: Set<string> | null, size: number): void {
  if (!rolloutStats) return;
  rolloutStats.samples++;
  if (s) keys!.add(moveKey(s.cells, size));
  else rolloutStats.nullSamples++;
}

/** Close out one rollout move's counters (P37 instrumentation; a no-op when off). */
function statMove(keys: Set<string> | null, fellBack: boolean): void {
  if (!rolloutStats) return;
  rolloutStats.moves++;
  if (keys) rolloutStats.distinct += keys.size;
  if (fellBack) rolloutStats.fallbacks++;
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
  const n = cfg.rolloutSamples;

  if (cfg.rolloutPolicy === 'heuristic') {
    // Sample a few legal moves, keep the largest piece (size is the dominant
    // heuristic term — see research/log/ai-strategy.md). Cheap vs full enumeration.
    const keys = rolloutStats ? new Set<string>() : null;
    let best: SampledMove | null = null;
    for (let k = 0; k < n; k++) {
      const s = sampleLegalMove(G, color, rng, bb);
      statSample(s, keys, boardSizeOf(G));
      if (s && (!best || s.cells.length > best.cells.length)) best = s;
    }
    statMove(keys, best === null);
    return best ?? fallbackMove(G, color, rng);
  }

  // score / softmax: rank the same samples by the *full* heuristic score, so a
  // rollout move also weighs frontier gain, centrality and corner denial — the
  // AE11 hypothesis that a better-playing rollout is a more predictive one.
  const keys = rolloutStats ? new Set<string>() : null;
  const cands: SampledMove[] = [];
  const scores: number[] = [];
  let bestScore = -Infinity;
  for (let k = 0; k < n; k++) {
    const s = sampleLegalMove(G, color, rng, bb);
    statSample(s, keys, boardSizeOf(G));
    if (!s) continue;
    const v = scoreCells(G, color, s.cells, WEIGHTS);
    cands.push(s);
    scores.push(v);
    if (v > bestScore) bestScore = v;
  }
  if (cands.length === 0) {
    statMove(keys, true);
    return fallbackMove(G, color, rng);
  }
  statMove(keys, false);

  if (cfg.rolloutPolicy === 'score') {
    for (let i = 0; i < cands.length; i++) if (scores[i] === bestScore) return cands[i];
  }

  // Boltzmann over the candidates, shifted by the max for numerical stability.
  let sum = 0;
  for (let i = 0; i < scores.length; i++) {
    scores[i] = Math.exp((scores[i] - bestScore) / cfg.rolloutTemperature);
    sum += scores[i];
  }
  let r = rng() * sum;
  for (let i = 0; i < cands.length; i++) {
    r -= scores[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
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
  const play = playColorsOf(g);
  let idx = g.activeColorIndex;
  while (cfg.rolloutDepth === 0 || depth < cfg.rolloutDepth) {
    const color = play[idx];
    const move = rolloutMove(g, color, cfg, rng, bb);
    if (move) {
      applyPlacement(g, color, move.pieceId, move.cells);
      bbApply(bb, color, move.cells);
      passStreak = 0;
      depth++;
    } else if (++passStreak >= play.length) {
      break; // every color stuck → terminal
    }
    idx = (idx + 1) % play.length;
  }
  return rewardVector(g, cfg);
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
  const play = playColorsOf(g);
  const size = boardSizeOf(g);
  let idx = g.activeColorIndex;
  while (cfg.rolloutDepth === 0 || depth < cfg.rolloutDepth) {
    const color = play[idx];
    const move = rolloutMove(g, color, cfg, rng, bb);
    if (move) {
      applyPlacement(g, color, move.pieceId, move.cells);
      bbApply(bb, color, move.cells);
      played[idx].add(moveKey(move.cells, size));
      passStreak = 0;
      depth++;
    } else if (++passStreak >= play.length) {
      break;
    }
    idx = (idx + 1) % play.length;
  }
  return rewardVector(g, cfg);
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
  for (let depth = 1; depth <= playColorsOf(G).length; depth++) {
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
      const played = playColorsOf(root.G).map(() => new Set<string>());
      const reward = leaf.terminal ? rewardVector(leaf.G, cfg) : rolloutRave(leaf.G, cfg, rng, played);
      backpropRave(leaf, reward, played);
    } else {
      const reward = leaf.terminal
        ? rewardVector(leaf.G, cfg)
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
