import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLASSIC_LADDER, eloOf, cellOf, ceilingOf, type LadderArtifact } from '../src/game/ai/ladder';
import { canonicalPool, poolFingerprint, type PoolFile } from '../src/game/ai/ladder/hash';
import { bradleyTerryElo } from '../src/game/ai/arena';
import { poolShards } from '../scripts/experiments/lib/shards';

/**
 * Ladder artifact guard (P62). A pool Elo rating is derived from the exact
 * `(variant × pool)` it was measured on: edit a member's search config and every
 * committed rating is silently wrong, with nothing in the app to notice. So the
 * artifact records the fingerprint of the `pool.json` it was fit from, and this test
 * recomputes it — a pool edit without a recalibration fails CI rather than shipping
 * stale numbers to the difficulty picker.
 *
 * Same "let a test hold it" idiom as the events and backlog registries: the doc/data
 * and the thing it describes are checked against each other mechanically, both ways.
 */

const poolPath = fileURLToPath(new URL('../scripts/experiments/pool.json', import.meta.url));
const pool = JSON.parse(readFileSync(poolPath, 'utf8')) as PoolFile;

describe('pool fingerprint', () => {
  it('ignores prose and formatting, so a reformat is not a strength change', () => {
    const reformatted: PoolFile = {
      version: pool.version,
      title: 'a completely different title',
      note: 'rewritten note',
      // Key order reversed, member order reversed — neither changes how anyone plays.
      members: [...pool.members].reverse().map((m) => ({
        tags: m.tags,
        options: m.options,
        strategy: m.strategy,
        name: m.name,
      })),
    };
    expect(poolFingerprint(reformatted)).toBe(poolFingerprint(pool));
  });

  it('ignores tags — re-designating the champion moves no rating', () => {
    const retagged: PoolFile = {
      ...pool,
      members: pool.members.map((m) => ({ ...m, tags: { champion: m.name === 'heuristic' } })),
    };
    expect(poolFingerprint(retagged)).toBe(poolFingerprint(pool));
  });

  it('changes when a member’s search config changes', () => {
    const retuned: PoolFile = {
      ...pool,
      members: pool.members.map((m) =>
        m.name === 'mcts-30' ? { ...m, options: { ...m.options, beam: 999 } } : m,
      ),
    };
    expect(poolFingerprint(retuned)).not.toBe(poolFingerprint(pool));
  });

  it('changes when a member is added or removed', () => {
    const added: PoolFile = {
      ...pool,
      members: [...pool.members, { name: 'newcomer', strategy: 'heuristic' }],
    };
    expect(poolFingerprint(added)).not.toBe(poolFingerprint(pool));

    const removed: PoolFile = { ...pool, members: pool.members.slice(1) };
    expect(poolFingerprint(removed)).not.toBe(poolFingerprint(pool));
  });

  it('serializes deterministically', () => {
    expect(canonicalPool(pool)).toBe(canonicalPool(pool));
    expect(poolFingerprint(pool)).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  });
});

describe('Classic ladder artifact', () => {
  const ladder: LadderArtifact = CLASSIC_LADDER;

  // The staleness guard itself. If this fails, pool.json changed without the ladder
  // being regenerated — run scripts/experiments/ladder-recal.sh (see its header).
  it('was fit from the current pool.json', () => {
    expect(ladder.pool.fingerprint).toBe(poolFingerprint(pool));
  });

  it('names the pool file it was fit from, and it exists', () => {
    expect(ladder.pool.file).toBe('scripts/experiments/pool.json');
    expect(ladder.pool.members).toEqual(pool.members.map((m) => m.name));
  });

  it('is Classic-scoped (M6: ratings never cross variants)', () => {
    expect(ladder.variant).toBe('classic');
  });

  it('rates every member of the pool', () => {
    for (const m of pool.members) {
      expect(eloOf(ladder, m.name), `no rating for ${m.name}`).toBeTypeOf('number');
    }
  });

  it('ranks strongest-first, consistently with the ratings', () => {
    expect([...ladder.ranking].sort()).toEqual(Object.keys(ladder.elo).sort());
    for (let i = 1; i < ladder.ranking.length; i++) {
      expect(ladder.elo[ladder.ranking[i - 1]]).toBeGreaterThanOrEqual(ladder.elo[ladder.ranking[i]]);
    }
  });

  /**
   * The published scale's zero point (P61). Re-fitting reproduces whatever anchor the
   * artifact names (see the reproducibility test below), so self-consistency alone
   * can't stop someone regenerating on a different anchor and silently republishing
   * every tier's rating. This pins the convention itself.
   */
  it('is anchored on the incumbent, not the pool mean', () => {
    expect(ladder.schema).toBe(2);
    expect(ladder.fit.anchor.member).toBe(ladder.anchors.incumbent);
    expect(ladder.fit.anchor.elo).toBe(1549);
    // The whole point: the anchor member sits exactly on its stated rating.
    expect(ladder.elo[ladder.fit.anchor.member]).toBe(1549);
  });

  it('carries anchors that point at real pool members', () => {
    const names = new Set(pool.members.map((m) => m.name));
    expect(ladder.anchors.champion && names.has(ladder.anchors.champion)).toBe(true);
    expect(ladder.anchors.incumbent && names.has(ladder.anchors.incumbent)).toBe(true);
    // The champion is the latency-unbounded ceiling — it must top the ladder.
    expect(ladder.ranking[0]).toBe(ladder.anchors.champion);
    expect(ceilingOf(ladder)).toBe(ladder.elo[ladder.anchors.champion!]);
  });

  it('has coherent cells: real members, real n, share inside its own CI', () => {
    const rated = new Set(ladder.ranking);
    expect(ladder.cells.length).toBeGreaterThan(0);
    for (const c of ladder.cells) {
      expect(rated.has(c.a) && rated.has(c.b), `${c.a} vs ${c.b} names an unrated member`).toBe(true);
      expect(c.a).not.toBe(c.b);
      expect(c.games).toBeGreaterThan(0);
      expect(c.share).toBeGreaterThanOrEqual(0);
      expect(c.share).toBeLessThanOrEqual(1);
      expect(c.share).toBeGreaterThanOrEqual(c.ci[0] - 1e-9);
      expect(c.share).toBeLessThanOrEqual(c.ci[1] + 1e-9);
    }
  });

  it('has mirrored cells that sum to one game-share', () => {
    for (const c of ladder.cells) {
      const mirror = cellOf(ladder, c.b, c.a);
      if (!mirror) continue;
      expect(c.share + mirror.share).toBeCloseTo(1, 3);
      expect(mirror.games).toBe(c.games);
    }
  });

  it('records where the numbers came from', () => {
    expect(ladder.provenance.shardDirs.length).toBeGreaterThan(0);
    expect(ladder.provenance.batchFiles).toBeGreaterThan(0);
    expect(ladder.provenance.generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  /**
   * Closes the loop: pool.json ↔ artifact ↔ shards. The fingerprint test above catches a
   * pool edited without recalibration; this catches the artifact drifting from the
   * evidence it claims to be fit from — a hand-edited rating, a stale commit, or a
   * regeneration that silently read a different cache. Cheap because the shards are
   * committed (~290 small files) and the fit is the same one the generator runs.
   */
  it('every rating and cell is reproducible from the committed shards', () => {
    const { names, pooled, wins, games } = poolShards([
      fileURLToPath(new URL('../scripts/experiments/pool-shards', import.meta.url)),
    ]);
    expect(names.sort()).toEqual([...ladder.ranking].sort());

    const elo = bradleyTerryElo(names, wins, games, { anchor: ladder.fit.anchor });
    for (const name of names) {
      expect(Math.round(elo[name]), `${name} rating is not what the shards give`).toBe(ladder.elo[name]);
    }

    for (const c of ladder.cells) {
      const cell = pooled[c.a]?.[c.b];
      expect(cell, `${c.a} vs ${c.b} is in the artifact but not in the shards`).toBeDefined();
      expect(cell!.games).toBe(c.games);
      expect(cell!.wins / cell!.games).toBeCloseTo(c.share, 4);
    }
  });
});
