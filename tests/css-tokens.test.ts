import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every `var(--token)` the client reads must actually be defined somewhere.
 *
 * This is the failure mode CLAUDE.md's finish-layer rule warns about, caught once for
 * real: P65 shipped `var(--accent)` — a token that does not exist — for the variant
 * card's selection ring and M4's changed-row marks. An unresolvable `var()` invalidates
 * the whole declaration, so the ring and every mark rendered as nothing, while vitest,
 * typecheck **and** lint all stayed green: a CSS custom property is only ever a string
 * to all three. The only detector was looking at the running app.
 *
 * A string comparison is a weak check for a visual property, which is exactly why it is
 * worth having: it costs nothing and it closes the specific hole that let an invisible
 * control ship. It does not replace the per-theme eyes-on pass — a token that exists can
 * still be the wrong color on a dark mat.
 */

const SRC = new URL('../src/', import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of globSync('**/*.{ts,tsx,css}', { cwd: dir })) out.push(join(dir, e));
  return out;
}

const files = walk(SRC);
const text = files.map((f) => readFileSync(f, 'utf8'));

/** Tokens given a value anywhere (`--x: …`), including per-theme blocks. */
const defined = new Set<string>();
for (const s of text) for (const m of s.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);

/**
 * Tokens read back via `var(--x)` **with no fallback**. `var(--danger, #dc2626)` is
 * not a hole — the fallback is what renders when the token is absent, which is a
 * deliberate idiom here (the blitz clock's urgent color). Only a bare read can
 * silently invalidate its declaration.
 */
const used = new Map<string, string>();
for (let i = 0; i < text.length; i++) {
  for (const m of text[i].matchAll(/var\((--[a-z0-9-]+)\s*([,)])/g)) {
    if (m[2] === ')' && !used.has(m[1])) used.set(m[1], files[i]);
  }
}

describe('CSS custom properties', () => {
  it('reads no token that is never defined', () => {
    const orphans = [...used]
      // `--piece-`/`--tile-` prefixes are built by concatenation at the call site
      // (PIECE_VAR, tileVar), so the literal prefix is not itself a token.
      .filter(([t]) => !/^--(piece|tile)-$/.test(t))
      .filter(([t]) => !defined.has(t))
      .map(([t, f]) => `${t} (first read in ${f.replace(SRC, 'src/')})`);

    expect(orphans).toEqual([]);
  });

  it('can actually see the tokens it is checking', () => {
    // Positive control: an empty `defined` set would make the check above pass
    // vacuously, which is the way this test would rot into a no-op.
    expect(defined.has('--brass')).toBe(true);
    expect(used.size).toBeGreaterThan(20);
  });
});
