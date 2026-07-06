/**
 * AE4 Stage A: self-play dataset dump. Plays seeded 4p arena games and writes
 * one JSONL GameRecord per line (see src/game/ai/selfplay.ts). Every record is
 * replay-verified through the rules core before it is written — final scores
 * must match, so a corrupt line can't reach training.
 *
 *   npx vite-node scripts/selfplay-dump.ts <games> <baseSeed> <out.jsonl> [--eps=0.1]
 *
 * Default seats: 4× heuristic with ε-random exploration ("heur-e10"), so games
 * stay near strong play but don't collapse onto a few deterministic lines.
 */
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { COLOR_ORDER } from '../src/game/types';
import type { Color } from '../src/game/types';
import { mulberry32, heuristicStrategy, type Strategy } from '../src/game/ai/arena';
import {
  playRecordedGame,
  replayGame,
  epsilonStrategy,
  serializeRecord,
} from '../src/game/ai/selfplay';
import { finalScores } from '../src/game/scoring';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flagArgs = process.argv.slice(2).filter((a) => a.startsWith('--'));
const games = Number(args[0] ?? 100);
const baseSeed = Number(args[1] ?? 1);
const out = args[2] ?? '.data/selfplay/games.jsonl';
const eps = Number(flagArgs.find((f) => f.startsWith('--eps='))?.slice(6) ?? 0.1);

const seatName = `heur-e${Math.round(eps * 100)}`;
const strategy: Strategy = epsilonStrategy(heuristicStrategy(), eps);
const byColor = Object.fromEntries(COLOR_ORDER.map((c) => [c, strategy])) as Record<
  Color,
  Strategy
>;
const seats = Object.fromEntries(COLOR_ORDER.map((c) => [c, seatName])) as Record<Color, string>;

mkdirSync(dirname(out), { recursive: true });
const stream = createWriteStream(out);

const t0 = Date.now();
let plies = 0;
for (let g = 0; g < games; g++) {
  const seed = baseSeed + g;
  const record = playRecordedGame(byColor, seats, seed, mulberry32(seed));

  // Integrity gate: replaying the moves must reproduce the recorded scores.
  const replayed = finalScores(replayGame(record.moves));
  for (const c of COLOR_ORDER) {
    if (replayed.colors[c] !== record.scores[c]) {
      throw new Error(`replay mismatch, game ${g} seed ${seed}, ${c}`);
    }
  }

  stream.write(JSON.stringify(serializeRecord(record)) + '\n');
  plies += record.moves.length;
  if ((g + 1) % 100 === 0) {
    const dt = (Date.now() - t0) / 1000;
    console.log(
      `${g + 1}/${games} games, ${plies} positions, ${dt.toFixed(0)}s (${((g + 1) / dt).toFixed(1)} games/s)`,
    );
  }
}
stream.end();

const dt = (Date.now() - t0) / 1000;
console.log(
  `\nwrote ${games} games (${plies} positions, seeds ${baseSeed}..${baseSeed + games - 1}, ` +
    `eps=${eps}) to ${out} in ${dt.toFixed(1)}s`,
);
