/**
 * Browse + verify captured game records (product P1). Reads the JSONL log the
 * app writes (default `.data/games/vs-ai.jsonl`) and reuses the self-play record
 * tooling — every line is a SerializedRecord, replayable through the rules core.
 *
 *   npx vite-node scripts/games.ts [list|show|verify] [file] [--i=N]
 *
 *   list    (default) one row per game: mode, seats, #moves, winners, scores
 *   show    dump one record's header + move list        (pick with --i=INDEX)
 *   verify  replay every game; flag any whose scores don't reproduce
 */
import { readFileSync } from 'node:fs';
import { COLOR_ORDER } from '../src/game/types';
import { deserializeRecord, replayGame, type SerializedRecord } from '../src/game/ai/selfplay';
import { finalScores } from '../src/game/scoring';

const args = process.argv.slice(2);
const cmd = ['list', 'show', 'verify'].includes(args[0]) ? args.shift()! : 'list';
const file = args.find((a) => !a.startsWith('--')) ?? '.data/games/vs-ai.jsonl';
const idx = Number(args.find((a) => a.startsWith('--i='))?.slice(4) ?? 0);

let lines: string[];
try {
  lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
} catch {
  console.error(`no game log at ${file} (play a vs-AI game with the dev server running)`);
  process.exit(1);
}
const records = lines.map((l) => deserializeRecord(JSON.parse(l) as SerializedRecord));
const scoreStr = (s: Record<string, number>) => COLOR_ORDER.map((c) => s[c]).join('/');

if (cmd === 'list') {
  console.log(`${records.length} games in ${file}\n`);
  records.forEach((r, i) => {
    const when = r.meta?.endedAt ? new Date(r.meta.endedAt).toISOString().slice(0, 16) : '—';
    const seats = COLOR_ORDER.map((c) => r.seats[c]).join(',');
    console.log(
      `#${String(i).padStart(3)} ${when} ${r.mode}p/${r.scoring} ` +
        `[${seats}] moves=${String(r.moves.length).padStart(3)} ` +
        `win=${r.winners.join(',') || '—'} scores=${scoreStr(r.scores)}`,
    );
  });
} else if (cmd === 'show') {
  const r = records[idx];
  if (!r) throw new Error(`no game at index ${idx} (have ${records.length})`);
  console.log(JSON.stringify({ ...r, moves: `${r.moves.length} moves` }, null, 2));
  console.log('\nmoves:');
  r.moves.forEach((m, ply) =>
    console.log(
      `  ${String(ply).padStart(3)} ${m.color.padEnd(6)} ${m.pieceId} r${m.rotation}${m.reflected ? 'f' : ''} @(${m.x},${m.y})`,
    ),
  );
} else {
  let bad = 0;
  records.forEach((r, i) => {
    try {
      const replayed = finalScores(replayGame(r.moves, undefined, r.mode, r.scoring)).colors;
      const ok = COLOR_ORDER.every((c) => replayed[c] === r.scores[c]);
      if (!ok) {
        bad++;
        console.error(`#${i} score mismatch: stored ${scoreStr(r.scores)} vs replay ${scoreStr(replayed)}`);
      }
    } catch (err) {
      bad++;
      console.error(`#${i} replay threw: ${(err as Error).message}`);
    }
  });
  console.log(bad === 0 ? `all ${records.length} games verify ✓` : `${bad}/${records.length} games FAILED`);
  if (bad > 0) process.exit(1);
}
