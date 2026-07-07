/**
 * Persistence sink for captured game records (product P1). Records are written
 * as JSONL to `.data/games/vs-ai.jsonl` on disk via a same-origin dev endpoint
 * (`POST /api/games`, served by the Vite plugin in vite.config.ts) — plain,
 * greppable, replayable with the same tooling as self-play, and easy to browse.
 *
 * When the endpoint is unreachable (production build, offline, server down) the
 * serialized record is queued in localStorage and flushed on the next save, so
 * a finished game is never silently lost.
 */
import { serializeRecord, type GameRecord, type SerializedRecord } from '../../game/ai/selfplay';

const ENDPOINT = '/api/games';
const QUEUE_KEY = 'openblokus.pendingGames';
const QUEUE_CAP = 100;

/** POST one serialized record; resolves true iff the server accepted it. */
async function postLine(line: SerializedRecord): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(line),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function readQueue(): SerializedRecord[] {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SerializedRecord[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(q: SerializedRecord[]): void {
  try {
    globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_CAP)));
  } catch {
    // localStorage unavailable/full — nothing we can do; drop silently.
  }
}

/** Best-effort drain of the pending queue; keeps unsent lines for next time. */
export async function flushPending(): Promise<void> {
  const q = readQueue();
  if (q.length === 0) return;
  const remaining: SerializedRecord[] = [];
  for (const line of q) {
    if (!(await postLine(line))) remaining.push(line);
  }
  writeQueue(remaining);
}

/** Persist a finished game: flush any backlog, then send this record (queue on failure). */
export async function saveRecord(record: GameRecord): Promise<void> {
  await flushPending();
  const line = serializeRecord(record);
  if (!(await postLine(line))) {
    writeQueue([...readQueue(), line]);
  }
}
