/**
 * AE4 Stage A: self-play dataset dump. Plays seeded 4p arena games and writes
 * one JSONL GameRecord per line (see src/game/ai/selfplay.ts). Every record is
 * replay-verified through the rules core before it is written — final scores
 * must match, so a corrupt line can't reach training.
 *
 *   npx vite-node scripts/selfplay-dump.ts <games> <baseSeed> <out.jsonl> [--eps=0.1] [--jobs=N]
 *
 * Default seats: 4× heuristic with ε-random exploration ("heur-e10"), so games
 * stay near strong play but don't collapse onto a few deterministic lines.
 *
 * `--jobs=N` (AE18): shard the game range across N child processes. Each game g
 * uses seed baseSeed+g regardless of shard, and shards cover contiguous ranges
 * written in order, so concatenating the shard files reproduces the exact same
 * JSONL as the single-process run — byte-identical, N× faster on N cores.
 */
import { createWriteStream, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
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
const flag = (name: string): string | undefined =>
  flagArgs.find((f) => f.startsWith(name))?.slice(name.length);

const games = Number(args[0] ?? 100);
const baseSeed = Number(args[1] ?? 1);
const out = args[2] ?? '.data/selfplay/games.jsonl';
const eps = Number(flag('--eps=') ?? 0.1);
const jobs = Math.max(1, Number(flag('--jobs=') ?? 1));
// Internal child-shard flags: process games [start,end) → part file.
const range = flag('--range=');
const part = flag('--part=');

const seatName = `heur-e${Math.round(eps * 100)}`;
const strategy: Strategy = epsilonStrategy(heuristicStrategy(), eps);
const byColor = Object.fromEntries(COLOR_ORDER.map((c) => [c, strategy])) as Record<
  Color,
  Strategy
>;
const seats = Object.fromEntries(COLOR_ORDER.map((c) => [c, seatName])) as Record<Color, string>;

/** Play games [start,end) in order into `stream`; returns positions written. */
function playRange(start: number, end: number, stream: NodeJS.WritableStream, quiet: boolean): number {
  const t0 = Date.now();
  let plies = 0;
  for (let g = start; g < end; g++) {
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
    if (!quiet && (g + 1 - start) % 100 === 0) {
      const dt = (Date.now() - t0) / 1000;
      console.log(
        `${g + 1 - start}/${end - start} games, ${plies} positions, ` +
          `${dt.toFixed(0)}s (${((g + 1 - start) / dt).toFixed(1)} games/s)`,
      );
    }
  }
  return plies;
}

async function main() {
  // --- child shard mode: play [start,end) into the part file, then exit. ------
  if (range && part) {
    const [start, end] = range.split(':').map(Number);
    const stream = createWriteStream(part);
    playRange(start, end, stream, true);
    stream.end();
    await once(stream, 'finish');
    return;
  }

  mkdirSync(dirname(out), { recursive: true });
  const t0 = Date.now();

  // --- single-process (jobs=1): the original path, unchanged output. ----------
  if (jobs === 1) {
    const stream = createWriteStream(out);
    const plies = playRange(0, games, stream, false);
    stream.end();
    await once(stream, 'finish');
    const dt = (Date.now() - t0) / 1000;
    console.log(
      `\nwrote ${games} games (${plies} positions, seeds ${baseSeed}..${baseSeed + games - 1}, ` +
        `eps=${eps}) to ${out} in ${dt.toFixed(1)}s`,
    );
    return;
  }

  // --- parent: shard contiguous game ranges across `jobs` children. -----------
  const n = Math.min(jobs, games);
  const chunk = Math.ceil(games / n);
  const parts: { start: number; end: number; file: string }[] = [];
  for (let i = 0; i < n; i++) {
    const start = i * chunk;
    const end = Math.min(games, start + chunk);
    if (start >= end) break;
    parts.push({ start, end, file: `${out}.part${i}` });
  }
  console.log(`sharding ${games} games across ${parts.length} jobs (chunk ${chunk})…`);

  // Re-invoke this script under vite-node for each shard (children run TS too).
  const scriptPath = fileURLToPath(import.meta.url);
  const viteNode = join(scriptPath, '..', '..', 'node_modules', '.bin', 'vite-node');
  await Promise.all(
    parts.map(async (p) => {
      const child = spawn(
        viteNode,
        [
          scriptPath,
          String(games),
          String(baseSeed),
          out,
          `--eps=${eps}`,
          `--range=${p.start}:${p.end}`,
          `--part=${p.file}`,
        ],
        { stdio: ['ignore', 'inherit', 'inherit'] },
      );
      const [code] = (await once(child, 'exit')) as [number];
      if (code !== 0) throw new Error(`shard ${p.start}:${p.end} exited ${code}`);
    }),
  );

  // Concatenate parts in game order → out (byte-identical to single-process).
  const outStream = createWriteStream(out);
  for (const p of parts) {
    await pipeline(createReadStream(p.file), outStream, { end: false });
  }
  outStream.end();
  await once(outStream, 'finish');
  for (const p of parts) unlinkSync(p.file);

  const dt = (Date.now() - t0) / 1000;
  console.log(
    `\nwrote ${games} games (seeds ${baseSeed}..${baseSeed + games - 1}, eps=${eps}, ` +
      `${parts.length} shards) to ${out} in ${dt.toFixed(1)}s`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
