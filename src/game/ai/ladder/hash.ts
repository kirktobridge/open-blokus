/**
 * Fingerprint of the evaluation pool a ladder was fit from (P62).
 *
 * A pool Elo rating is only meaningful for the exact `(variant × pool)` it was
 * measured on (M6): change a member's search config and yesterday's ratings are
 * silently wrong. The committed ladder artifact records this fingerprint, and
 * `tests/ladder-artifact.test.ts` recomputes it from `pool.json` — so a pool edit
 * that isn't followed by a recalibration fails CI instead of shipping stale numbers.
 *
 * Deliberately a pure hash (no `node:crypto`), because the ladder module is on the
 * client import path for P61's difficulty picker.
 *
 * **Only strength-bearing fields enter the fingerprint** — `name`, `strategy`, and
 * `options`. `title`/`note` are prose, and `tags` (champion/incumbent) are labels:
 * moving the champion tag re-designates the anchor without changing a single rating,
 * so it must not invalidate the artifact. Anything that changes how a member *plays*
 * does.
 */

/** The strength-bearing shape of one `pool.json` member. */
export interface PoolMemberSpec {
  name: string;
  strategy: string;
  options?: Record<string, unknown>;
  tags?: Record<string, boolean>;
}

/** The shape of `scripts/experiments/pool.json` this module depends on. */
export interface PoolFile {
  version: number;
  title?: string;
  note?: string;
  members: PoolMemberSpec[];
}

/**
 * Key-order-independent serialization. Two `pool.json` files that differ only in
 * whitespace or key order must fingerprint identically — otherwise a reformat looks
 * like a strength change and the staleness test cries wolf.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/** The exact string the fingerprint is taken over — exported so a mismatch is debuggable. */
export function canonicalPool(pool: PoolFile): string {
  const members = [...pool.members]
    .map((m) => ({ name: m.name, strategy: m.strategy, options: m.options ?? {} }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return canonical({ version: pool.version, members });
}

/** 64-bit FNV-1a. Drift detection, not tamper resistance — collisions are not a threat here. */
function fnv1a64(s: string): string {
  const MASK = 0xffffffffffffffffn;
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & MASK;
  }
  return h.toString(16).padStart(16, '0');
}

/** Fingerprint of a pool's strength-bearing configuration, e.g. `fnv1a64:3f2a…`. */
export function poolFingerprint(pool: PoolFile): string {
  return `fnv1a64:${fnv1a64(canonicalPool(pool))}`;
}
