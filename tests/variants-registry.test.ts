import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VARIANTS } from '../src/game/modes';
import type { Cell, Color, Variant } from '../src/game/types';

/**
 * Variant registry ↔ spec alignment (P55), the events-registry idiom applied to the
 * Classic/Duo split: `VARIANTS` in src/game/modes.ts is the code-side source of truth
 * for everything that distinguishes one rule set from another, and each variant has a
 * spec doc that says the same things in prose. This asserts they agree **both ways** —
 * a variant in code with no spec doc fails, and so does a board size, start cell,
 * colour set or scoring rule the doc contradicts.
 *
 * **Known limit — do not over-trust this.** It pins *values*, not prose. It cannot see
 * a shared rule wrongly restated in the delta doc, nor a rule the delta doc forgot to
 * override; GAME_SPEC_DUO.md's own discipline still carries that, by convention.
 */

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../docs/${name}`, import.meta.url)), 'utf8');

/**
 * Which doc specifies which variant. A variant absent here fails the first test — the
 * point being that adding one to `VARIANTS` forces you to say where its rules are
 * written down, before any of the value checks below can even run.
 */
const SPEC_DOC: Record<Variant, string> = {
  classic: 'GAME_SPEC.md',
  duo: 'GAME_SPEC_DUO.md',
};

/**
 * Facts the two docs happen to state in the *same* shape, so one parser reads both:
 * the start-cell table (`| color | index | position | cell |`, whose Index column is
 * also the turn order) and two independent statements of the board's size. Everything
 * else — scoring, seat counts — is stated in prose that differs per doc, and is checked
 * per variant further down rather than by pretending the docs share a format.
 */
function startCellTable(doc: string): { colors: Color[]; cells: Record<string, Cell> } {
  const colors: { index: number; color: Color }[] = [];
  const cells: Record<string, Cell> = {};
  for (const line of doc.split('\n')) {
    const m = line.match(
      /^\|\s*`([a-z]+)`\s*\|\s*(\d+)\s*\|[^|]*\|\s*`\((\d+),\s*(\d+)\)`\s*\|/,
    );
    if (!m) continue;
    const [, color, index, x, y] = m;
    colors.push({ index: Number(index), color: color as Color });
    cells[color] = { x: Number(x), y: Number(y) };
  }
  return {
    colors: colors.sort((a, b) => a.index - b.index).map((c) => c.color),
    cells,
  };
}

/** Every independent statement of the board's side length the doc makes. */
function statedBoardSizes(doc: string): number[] {
  const sizes: number[] = [];
  for (const [, n] of doc.matchAll(/y \* (\d+) \+ x/g)) sizes.push(Number(n));
  // "Bottom-right = `(19, 19)`" / "bottom-right = `(13,13)`" — the far corner is N-1.
  for (const [, n] of doc.matchAll(/bottom-right = `\((\d+),\s*(\d+)\)`/gi)) sizes.push(Number(n) + 1);
  return sizes;
}

describe('VARIANTS ↔ the spec docs', () => {
  it('specifies every variant the code defines, and defines every variant specified', () => {
    expect(Object.keys(SPEC_DOC).sort()).toEqual(Object.keys(VARIANTS).sort());
  });

  describe.each(Object.keys(VARIANTS) as Variant[])('%s', (variant) => {
    const spec = VARIANTS[variant];
    const doc = read(SPEC_DOC[variant]);

    it('states the board size the code uses, everywhere it states it', () => {
      const stated = statedBoardSizes(doc);
      expect(stated.length, `${SPEC_DOC[variant]} states no board size`).toBeGreaterThan(0);
      for (const size of stated) expect(size).toBe(spec.boardSize);
    });

    it('tabulates exactly the colors in play, in turn order', () => {
      expect(startCellTable(doc).colors).toEqual([...spec.playColors]);
    });

    it('gives each color the start cell the code assigns it', () => {
      const { cells } = startCellTable(doc);
      expect(Object.keys(cells).sort()).toEqual(Object.keys(spec.startCells).sort());
      for (const [color, cell] of Object.entries(cells)) {
        expect(cell, `${variant} start cell for ${color}`).toEqual(spec.startCells[color as Color]);
      }
    });

    it('keeps every start cell on the board', () => {
      for (const cell of Object.values(spec.startCells)) {
        expect(Math.max(cell.x, cell.y)).toBeLessThan(spec.boardSize);
        expect(Math.min(cell.x, cell.y)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  /**
   * Scoring and seat counts, per doc, in the doc's own words. Duo pins advanced and
   * forbids basic (GAME_SPEC_DUO §4 [RULING]); Classic offers both (§6.1 default,
   * §6.2), which is what `scoring: null` means — the lobby chooses.
   */
  it('honours the scoring rule each doc lays down', () => {
    expect(VARIANTS.classic.scoring).toBeNull();
    const classic = read(SPEC_DOC.classic);
    expect(classic).toMatch(/### 6\.1 Basic scoring/);
    expect(classic).toMatch(/### 6\.2 Advanced scoring/);

    expect(VARIANTS.duo.scoring).toBe('advanced');
    expect(read(SPEC_DOC.duo)).toMatch(/Duo uses \*\*advanced scoring only\*\*/);
  });

  it('supports exactly the seat counts each doc allows', () => {
    expect(read(SPEC_DOC.classic)).toMatch(/\*\*Players:\*\* 2–4\./);
    expect([...VARIANTS.classic.modes]).toEqual([2, 3, 4]);

    expect(read(SPEC_DOC.duo)).toMatch(/\*\*exactly 2\*\*/);
    expect([...VARIANTS.duo.modes]).toEqual([2]);
  });
});
