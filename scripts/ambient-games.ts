/**
 * Regenerate the precomputed games the front door's ambient board replays (P29 M2).
 *
 *   npx vite-node scripts/ambient-games.ts [--seeds=3,7,11,19]
 *
 * Plays each seed out with the heuristic bot and writes the resolved cell lists to
 * src/client/lobby/ambientGames.ts. The client never runs the engine — it just
 * replays these. tests/ambient.test.ts regenerates seed[0] and fails if the checked-in
 * data has drifted from what the engine actually produces.
 */
import { writeFileSync } from 'node:fs';
import { generateAmbientGame } from '../src/game/ai/ambient';

const OUT = 'src/client/lobby/ambientGames.ts';
const DEFAULT_SEEDS = [3, 7, 11, 19];

const arg = process.argv.slice(2).find((a) => a.startsWith('--seeds='));
const seeds = arg
  ? arg
      .slice('--seeds='.length)
      .split(',')
      .map((s) => Number(s.trim()))
  : DEFAULT_SEEDS;

const games = seeds.map((s) => generateAmbientGame(s));

for (const g of games) {
  console.log(`seed ${String(g.seed).padStart(3)}: ${g.moves.length} moves`);
}

const body = games
  .map(
    (g) =>
      `  {\n    seed: ${g.seed},\n    moves: [\n` +
      g.moves.map(([c, cells]) => `      [${c}, [${cells.join(', ')}]],`).join('\n') +
      `\n    ],\n  },`,
  )
  .join('\n');

const src = `import type { AmbientGame } from '../../shared/ambient';

/**
 * Precomputed heuristic self-play games for the front door's ambient board (P29 M2).
 *
 * GENERATED — do not hand-edit. Regenerate with:
 *   npx vite-node scripts/ambient-games.ts
 *
 * Each move is [colorIndex, cells] with cells already resolved to board indices
 * (index = y * 20 + x), so replaying a game needs no piece table and no move
 * generator: the board plays itself with no engine in the bundle. Deterministic —
 * tests/ambient.test.ts regenerates seed ${games[0].seed} and compares.
 */
export const AMBIENT_GAMES: AmbientGame[] = [
${body}
];
`;

writeFileSync(OUT, src);
console.log(`\nwrote ${OUT} (${games.length} games, ${games.reduce((n, g) => n + g.moves.length, 0)} moves)`);
