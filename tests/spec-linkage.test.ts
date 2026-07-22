import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VARIANTS } from '../src/game/modes';

/**
 * GAME_SPEC.md ↔ GAME_SPEC_DUO.md linkage.
 *
 * The Duo spec is a *delta* document: it governs wherever it states a Duo value and
 * inherits everything else. That structure has two failure modes a value-comparison
 * test (tests/variants-registry.test.ts) can't see, and this file covers both:
 *
 *  1. **Dangling cross-references.** The delta doc leans on the base by section
 *     number, and a number is a link that rots silently.
 *  2. **Restatement.** A shared rule copied into the delta doc reads as authoritative
 *     while being a second copy nothing maintains — the failure the doc's own banner
 *     forbids, and which it had committed itself (the advanced-scoring formula).
 *
 * What it cannot check: an override the delta doc *should* state and doesn't. Nothing
 * mechanical can — absence has no syntax. That risk is bounded only because the base
 * rules are frozen (they encode a published 2013 boardgame), so the inheritance was
 * audited once, in full, rather than re-derived per change.
 */

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../docs/${name}`, import.meta.url)), 'utf8');

const classic = read('GAME_SPEC.md');
const duo = read('GAME_SPEC_DUO.md');

/**
 * Section numbers a doc defines. Top-level headings write a trailing dot
 * (`## 6. Scoring`), subsections don't (`### 6.1 Basic scoring`) — so the dot is
 * optional, and greedy matching must not be allowed to read `6.1` as `6`.
 */
function sectionsOf(doc: string): Set<string> {
  const found = new Set<string>();
  for (const [, num] of doc.matchAll(/^#{2,3} (\d+(?:\.\d+)?)\.?\s/gm)) found.add(num);
  return found;
}

describe('GAME_SPEC_DUO.md cross-references resolve', () => {
  const classicSections = sectionsOf(classic);
  const duoSections = sectionsOf(duo);

  it('reads a plausible section list from each doc', () => {
    // Positive control: an empty set would make every check below vacuously pass.
    expect(classicSections.size).toBeGreaterThan(5);
    expect(duoSections.size).toBeGreaterThan(3);
  });

  it('points every `GAME_SPEC §N` at a section GAME_SPEC.md defines', () => {
    const refs = [...duo.matchAll(/GAME_SPEC §(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(classicSections, `GAME_SPEC_DUO cites GAME_SPEC §${ref}, which does not exist`).toContain(
        ref,
      );
    }
  });

  it('points every bare `§N` at a section of its own', () => {
    // Per the doc's stated convention, a bare §N is a self-reference; anything meant
    // for the base doc must be written `GAME_SPEC §N`. Strip the qualified ones first.
    const selfRefs = [...duo.replace(/GAME_SPEC §\d+(?:\.\d+)?/g, '').matchAll(/§(\d+(?:\.\d+)?)/g)];
    expect(selfRefs.length).toBeGreaterThan(0);
    for (const [, ref] of selfRefs) {
      expect(
        duoSections,
        `GAME_SPEC_DUO has a bare §${ref}; it defines no such section, so this likely means GAME_SPEC §${ref}`,
      ).toContain(ref);
    }
  });
});

describe('GAME_SPEC_DUO.md restates nothing it does not change', () => {
  /**
   * The scoring *bonuses* are the canonical restatement hazard: Duo forces advanced
   * scoring, so a reader lands in its §4 expecting the numbers, and a helpful edit
   * copies them in. They belong to GAME_SPEC §6.2 alone.
   */
  it('leaves the advanced-scoring bonuses to GAME_SPEC §6.2', () => {
    expect(classic).toMatch(/\+ \(allPlaced\(color\) \? 15 : 0\)/);
    // The sheet's own worked example (+20 / −10) is Duo evidence and stays; what must
    // not reappear is the formula's own constants presented as Duo's rule.
    const scoringSection = duo.slice(duo.indexOf('## 4. Scoring'), duo.indexOf('## 5.'));
    expect(scoringSection).not.toMatch(/\+\*?\*?15/);
    expect(scoringSection).not.toMatch(/per unit square/);
  });

  /**
   * §1's comparison table quotes Classic in its left column — the one restatement the
   * doc keeps deliberately, because contrast is the table's whole job. Pinned rather
   * than banned, so the copy can't drift from the code it describes.
   */
  it('quotes Classic correctly in the §1 comparison table', () => {
    const spec = VARIANTS.classic;
    const table = duo.slice(duo.indexOf('## 1.'), duo.indexOf('## 2.'));
    const row = (label: string) =>
      table.split('\n').find((l) => l.startsWith(`| ${label}`))?.split('|')[2]?.trim() ?? '';

    expect(row('Board')).toContain(`${spec.boardSize} × ${spec.boardSize}`);
    expect(row('Board')).toContain(`${spec.boardSize * spec.boardSize} cells`);
    for (const color of spec.playColors) expect(row('Colors in play')).toContain(color);
    expect(row('Players')).toContain(`${Math.min(...spec.modes)}–${Math.max(...spec.modes)}`);
  });
});
