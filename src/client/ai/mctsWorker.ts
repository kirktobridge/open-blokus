/**
 * Web Worker that runs MCTS off the main thread so the UI stays responsive while
 * the bot "thinks". Receives a plain-JSON game state (project invariant: `G` is
 * JSON-serializable, so it structured-clones cleanly), runs the search, and posts
 * back the chosen placement. Play is nondeterministic (Math.random) by design.
 */
import { mctsSearch } from '../../game/ai/mcts';
import type { MctsConfig, MctsNode } from '../../game/ai/mcts';
import type { Color, GameState, Placement } from '../../game/types';

interface Request {
  id: number;
  G: GameState;
  color: Color;
  config: Partial<MctsConfig>;
}

// Cast around the DOM-vs-WebWorker `self` typing mismatch (postMessage signatures
// differ) without pulling in the webworker lib, which conflicts with DOM.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Request>) => void) | null;
  postMessage: (msg: { id: number; move: Placement | null }) => void;
};

// Persisted search trees per color, so each turn reuses the subtree grown last
// turn (Phase 4 tree reuse). Self-heals across games: a fresh board won't match
// a stale tree, so mctsSearch just starts over.
const trees = new Map<Color, MctsNode>();

ctx.onmessage = (e) => {
  const { id, G, color, config } = e.data;
  try {
    const { move, root } = mctsSearch(G, color, Math.random, config, trees.get(color));
    if (root) trees.set(color, root);
    else trees.delete(color);
    ctx.postMessage({ id, move });
  } catch {
    // Post null so the bot falls back to a legal move instead of hanging.
    ctx.postMessage({ id, move: null });
  }
};
