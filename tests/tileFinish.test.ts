import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TILE_FINISH, tileVar } from '../src/client/theme';
import type { Color } from '../src/game/types';

/**
 * Guards for the achromatic tile finish (P20 M2c).
 *
 * CLAUDE.md is explicit that the *look* of a finish is not testable — a bevel
 * that vanishes on a dark mat leaves vitest, typecheck and lint all green, and
 * the only detector is looking at each theme. So this file deliberately does not
 * try to assert "it looks molded". It pins the three things underneath the look
 * that **are** mechanical, and that are exactly how the finish silently died on
 * black and white in the first place:
 *
 *   1. the token *fallback chain* resolves (no `-dark`/`-light` fork pointing at
 *      a base token that doesn't exist);
 *   2. the class-varying tokens are actually routed through `tileVar`, so a new
 *      stroke can't quietly hardcode `var(--tile-hi)` and skip the forks;
 *   3. every piece color's **dye edge separates from its own body** — the one
 *      quantitative statement of "the finish survives at both ends". A white
 *      piece on a pale mat is nearly the mat's value by design (see the
 *      `--piece-white` comments in theme.css); what makes it read as a tile is
 *      that its border is not its body. Mixing 30% black into black draws no
 *      border at all, and that is precisely the bug this milestone fixed.
 */

const CSS = readFileSync(resolve(__dirname, '../src/client/theme.css'), 'utf8');
const PLACED_LAYER = readFileSync(
  resolve(__dirname, '../src/client/board/PlacedLayer.tsx'),
  'utf8',
);

/**
 * Top-level theme blocks, as `{ token: value }`.
 *
 * Comments are stripped *first*, and that is load-bearing rather than tidy:
 * theme.css documents each token by naming its neighbours ("Mat-cast like
 * --tile-shadow: …"), so a declaration-shaped regex run over the raw text
 * matches inside prose and swallows the real declaration that follows it up to
 * the next `;`. This test caught exactly that when it was first written.
 */
function themeBlocks(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(:root|\[data-theme='(\w+)'\])\s*\{(.*?)\n\}/gs;
  for (const m of css.matchAll(re)) {
    const decls: Record<string, string> = {};
    for (const d of m[3].matchAll(/(--[\w-]+):\s*([^;]+);/g)) decls[d[1]] = d[2].trim();
    out[m[2] ?? 'root'] = decls;
  }
  return out;
}

const THEMES = themeBlocks();
const THEME_NAMES = Object.keys(THEMES);

/** A built-in theme resolves a token itself, else inherits `:root` (same element). */
const resolveToken = (theme: string, token: string): string | undefined =>
  THEMES[theme][token] ?? THEMES.root[token];

/** `--tile-hi` for a color's value class — the CSS cascade, done in JS. */
function finishToken(theme: string, color: Color, token: string): string {
  const fork = TILE_FINISH[color];
  return (
    (fork === '' ? undefined : resolveToken(theme, `${token}${fork}`)) ??
    resolveToken(theme, token)!
  );
}

function srgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = srgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `color-mix(in srgb, a, b p%)` — the dye border PlacedLayer strokes. */
function mix(a: string, b: string, percent: number): string {
  const [ca, cb] = [srgb(a), srgb(b)];
  const p = percent / 100;
  return (
    '#' +
    ca
      .map((v, i) =>
        Math.round((v * (1 - p) + cb[i] * p) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

const NAMED = { black: '#000000', white: '#ffffff' } as const;
const asHex = (v: string): string => NAMED[v as keyof typeof NAMED] ?? v;

describe('tile finish tokens', () => {
  it('sees all three built-in themes', () => {
    // Positive control: an empty parse would make every other test here vacuous.
    expect(THEME_NAMES.sort()).toEqual(['dark', 'root', 'walnut']);
  });

  it('every -dark/-light fork has a base token in :root to fall back to', () => {
    const forks = [...CSS.matchAll(/(--tile-[\w-]+?)(-dark|-light):/g)];
    expect(forks.length).toBeGreaterThan(0); // positive control
    for (const [, base] of forks) {
      expect(THEMES.root, `${base} fork exists but ${base} does not`).toHaveProperty(base);
    }
  });

  it('PlacedLayer reads class-varying tokens through tileVar, never bare', () => {
    // A bare `var(--tile-hi)` in the layer would render the mid-tone amplitude on
    // a black piece — green everywhere, invisible except by eye.
    const bare = [...PLACED_LAYER.matchAll(/var\(--tile-[\w-]+\)/g)].map((m) => m[0]);
    expect(bare).toEqual([]);
    expect(PLACED_LAYER).toContain('tileVar('); // positive control for the above
  });

  it('tileVar falls back to the base token for the forks', () => {
    expect(tileVar('--tile-hi', '')).toBe('var(--tile-hi)');
    expect(tileVar('--tile-hi', '-dark')).toBe('var(--tile-hi-dark, var(--tile-hi))');
  });
});

describe('achromatic piece colors', () => {
  it.each(THEME_NAMES)('%s: black stays the dark end of the pair', (theme) => {
    const black = resolveToken(theme, '--piece-black')!;
    const white = resolveToken(theme, '--piece-white')!;
    expect(luminance(black)).toBeLessThan(luminance(white));
    // Duo's two colors carry the whole player identity, so they may not drift
    // toward each other the way two hues could.
    expect(contrast(black, white)).toBeGreaterThan(8);
  });

  it.each(THEME_NAMES)('%s: each is tuned for this theme, not inherited by accident', (
    theme,
  ) => {
    if (theme === 'root') return;
    // The M2c premise: before this milestone all three themes carried the same
    // provisional pair, which is how the finish came to be tuned for none of them.
    expect(THEMES[theme]).toHaveProperty('--piece-black');
    expect(THEMES[theme]).toHaveProperty('--piece-white');
    expect(THEMES[theme]['--piece-black']).not.toBe(THEMES.root['--piece-black']);
    expect(THEMES[theme]['--piece-white']).not.toBe(THEMES.root['--piece-white']);
  });
});

describe('dye edge separates from the body it borders', () => {
  const COLORS = Object.keys(TILE_FINISH) as Color[];
  /** Met by every color/theme pair today; the mid-tones sit closest to it. */
  const FLOOR = 1.4;

  const dyeEdge = (theme: string, color: Color): string =>
    mix(
      resolveToken(theme, `--piece-${color}`)!,
      asHex(finishToken(theme, color, '--tile-dye-mix')),
      parseFloat(finishToken(theme, color, '--tile-dye')),
    );

  it.each(THEME_NAMES.flatMap((t) => COLORS.map((c) => [t, c] as const)))(
    '%s / %s',
    (theme, color) => {
      const body = resolveToken(theme, `--piece-${color}`)!;
      expect(
        contrast(body, dyeEdge(theme, color)),
        `${color} dye edge on ${theme}`,
      ).toBeGreaterThan(FLOOR);
    },
  );

  it.each(THEME_NAMES)('%s: black clears the bar only because of its fork', (theme) => {
    // The control for the test above: without `--tile-dye-mix-dark` flipping the
    // mix to white, a near-black body mixed *further* toward black draws a border
    // that isn't there. This asserts the fork is doing the work, so the passing
    // case above can't be mistaken for the base tokens having been fine all along.
    const body = resolveToken(theme, '--piece-black')!;
    const unforked = mix(body, '#000000', parseFloat(resolveToken(theme, '--tile-dye')!));
    expect(contrast(body, unforked)).toBeLessThan(FLOOR);
    expect(contrast(body, dyeEdge(theme, 'black'))).toBeGreaterThan(FLOOR);
  });
});
