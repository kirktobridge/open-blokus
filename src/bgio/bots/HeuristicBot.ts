import { Bot } from 'boardgame.io/ai';
import type { State } from 'boardgame.io';
import type { GameState, Placement } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { scorePlacement } from '../../game/ai/heuristic';

/**
 * Blokus-aware bot: ranks the enumerated legal placements with the heuristic
 * (see src/game/ai/heuristic.ts) and plays the best, breaking ties with the
 * bot's seeded RNG. Fast enough to run inline in the browser.
 */
export class HeuristicBot extends Bot {
  async play(state: State<GameState>, playerID: string) {
    const { G, ctx } = state;
    const actions = this.enumerate(G, ctx, playerID);
    const color = COLOR_ORDER[G.activeColorIndex];

    let bestScore = -Infinity;
    let best: typeof actions = [];
    for (const action of actions) {
      const placement = (action as { payload?: { args?: Placement[] } }).payload?.args?.[0];
      const score = placement ? scorePlacement(G, color, placement) : -Infinity;
      if (score > bestScore) {
        bestScore = score;
        best = [action];
      } else if (score === bestScore) {
        best.push(action);
      }
    }

    const action = best.length ? this.random(best) : actions[0];
    return { action };
  }
}
