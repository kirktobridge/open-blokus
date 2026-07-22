/* eslint-disable no-restricted-imports -- Classic by design (P55): the front door's
   ambient board is a 4-color 20x20 game, generated offline and shipped as cells. It
   is decoration with a fixed look, not a variant-aware surface. */
import type { AmbientGame } from '../../shared/ambient';
import { BOARD_SIZE } from '../../shared/constants';
import { COLOR_ORDER } from '../types';
import type { Color } from '../types';
import { resolveCells } from '../pieces';
import { chooseMove } from './heuristic';
import { epsilonStrategy } from './selfplay';
import { mulberry32, playGame, type Strategy } from './arena';

/**
 * Generate one full 4p game for the front door's ambient board (P29 M2).
 *
 * The simplest heuristic bot plays all four colors — the same technique that
 * produced HeroBoard's static position, now captured as the whole move list instead
 * of just the final frame. A little exploration noise keeps the four embedded games
 * from collapsing onto near-identical lines (the heuristic is deterministic up to
 * tie-breaks, so without it they'd all look the same).
 *
 * **Offline only.** Nothing in the client imports this — the client reads the
 * *generated* cells (see `shared/ambient.ts`), which is what keeps the engine out of
 * the initial bundle. Regenerate with `npx vite-node scripts/ambient-games.ts`.
 */
export function generateAmbientGame(seed: number, eps = 0.12): AmbientGame {
  const rng = mulberry32(seed);
  const strategy: Strategy = epsilonStrategy((G, color, r) => chooseMove(G, color, r), eps);
  const byColor = Object.fromEntries(COLOR_ORDER.map((c) => [c, strategy])) as Record<
    Color,
    Strategy
  >;

  const moves: AmbientGame['moves'] = [];
  playGame(byColor, {
    rng,
    // Flatten (x, y) to a board index here, offline: it's the form the client renders
    // with, so the replay never needs the piece table or the coordinate convention.
    onMove: (color, move) =>
      moves.push([
        COLOR_ORDER.indexOf(color),
        resolveCells(move).map((c) => c.y * BOARD_SIZE + c.x),
      ]),
  });

  return { seed, moves };
}
