import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EVENT_IDS, EVENT_THRESHOLDS, EVENT_THRESHOLD_DELTAS } from '../src/client/drama';
import { SIGNAL_THRESHOLDS, SIGNAL_THRESHOLD_DELTAS } from '../src/client/signals';
import { VARIANTS } from '../src/game/modes';
import type { Variant } from '../src/game/types';

/**
 * Registry alignment test (P32, in the spirit of P21's backlog-schema test; extended
 * to the standing-signal registry and the per-variant axis by P55): the signal layer
 * is documented in docs/EVENTS.md and implemented in drama.ts / signals.ts, and this
 * asserts the two agree **in both directions** — no undocumented event or threshold,
 * no documented one that doesn't exist, no value that has drifted. The doc is a
 * source of truth precisely because it can't rot.
 */

const doc = readFileSync(
  fileURLToPath(new URL('../docs/EVENTS.md', import.meta.url)),
  'utf8',
);

/** The `## <name>` section's body, up to the next `## ` heading. */
function section(name: string): string {
  const at = doc.indexOf(`## ${name}\n`);
  if (at < 0) throw new Error(`EVENTS.md lost its "${name}" section`);
  const rest = doc.slice(at + name.length + 4);
  const end = rest.indexOf('\n## ');
  return end < 0 ? rest : rest.slice(0, end);
}

/** Cells of every `|`-table row in `body`, header/separator rows dropped. */
function tableRows(body: string): string[][] {
  const rows: string[][] = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3 || /^-+$/.test(cells[0])) continue;
    rows.push(cells);
  }
  return rows;
}

/** `KEY=value` pairs in a thresholds cell, optionally prefixed by a variant name. */
function thresholdsIn(cell: string, prefix = ''): Map<string, number> {
  const re = new RegExp(`\\b${prefix}([A-Z][A-Z_]*)=([\\d.]+)`, 'g');
  return new Map([...cell.matchAll(re)].map(([, key, v]) => [key, Number(v)]));
}

/**
 * The two registries, described uniformly so both get the same treatment — that
 * uniformity is the point of P55: a new registry is a row here, not a new test file.
 * `ids` is only checked where the code actually keys consumers off an id list
 * (events do; the incursion overlay is a function, so inventing an id enum for it
 * would document a contract nobody has).
 */
const REGISTRIES = [
  {
    name: 'event',
    heading: 'The vocabulary',
    /** Threshold cell of the vocabulary table: `| id | text | trigger | thresholds | consumers |` */
    thresholdColumn: 3,
    base: EVENT_THRESHOLDS as Record<string, number>,
    deltas: EVENT_THRESHOLD_DELTAS as Partial<Record<Variant, Record<string, number>>>,
    ids: [...EVENT_IDS] as string[],
  },
  {
    name: 'standing',
    heading: 'Standing signals',
    /** `| id | what it reads | thresholds | consumers |` */
    thresholdColumn: 2,
    base: SIGNAL_THRESHOLDS as Record<string, number>,
    deltas: SIGNAL_THRESHOLD_DELTAS as Partial<Record<Variant, Record<string, number>>>,
    ids: null,
  },
] as const;

describe.each(REGISTRIES)('docs/EVENTS.md ↔ $name registry', (registry) => {
  const rows = tableRows(section(registry.heading)).filter((cells) =>
    /^`[a-z-]+`$/.test(cells[0]),
  );

  it('has a documented row per entry', () => {
    expect(rows.length).toBeGreaterThan(0);
    if (registry.ids) {
      expect(rows.map((c) => c[0].replace(/`/g, '')).sort()).toEqual(
        [...registry.ids].sort(),
      );
    }
  });

  const documented = new Map<string, number>();
  for (const cells of rows) {
    for (const [key, value] of thresholdsIn(cells[registry.thresholdColumn])) {
      documented.set(key, value);
    }
  }

  it('documents exactly the thresholds the code defines, and invents none', () => {
    expect([...documented.keys()].sort()).toEqual(Object.keys(registry.base).sort());
  });

  it('quotes every threshold at the value the code actually uses', () => {
    for (const [key, value] of documented) {
      expect(
        value,
        `EVENTS.md says ${key}=${value}, code says ${registry.base[key]}`,
      ).toBe(registry.base[key]);
    }
  });
});

describe('docs/EVENTS.md variant deltas ↔ the per-variant axis', () => {
  const rows = tableRows(section('Variant deltas'));

  /** Documented deltas, keyed `<registry>/<variant>/<KEY>`. */
  const documented = new Map<string, number>();
  for (const cells of rows) {
    for (const variant of Object.keys(VARIANTS) as Variant[]) {
      for (const [key, value] of thresholdsIn(
        cells[cells.length - 2] ?? '',
        `${variant.toUpperCase()}_`,
      )) {
        documented.set(`${cells[0]}/${variant}/${key}`, value);
      }
    }
  }

  /** The same shape, read off the code. */
  const inCode = new Map<string, number>();
  for (const registry of REGISTRIES) {
    for (const [variant, deltas] of Object.entries(registry.deltas)) {
      for (const [key, value] of Object.entries(deltas)) {
        inCode.set(`${registry.name}/${variant}/${key}`, value);
      }
    }
  }

  it('documents exactly the deltas the code declares, and invents none', () => {
    expect([...documented.keys()].sort()).toEqual([...inCode.keys()].sort());
  });

  it('quotes every delta at the value the code actually uses', () => {
    for (const [key, value] of documented) {
      expect(value, `EVENTS.md says ${key}=${value}, code says ${inCode.get(key)}`).toBe(
        inCode.get(key),
      );
    }
  });

  it('only overrides thresholds that exist, and only where they actually differ', () => {
    for (const registry of REGISTRIES) {
      for (const [variant, deltas] of Object.entries(registry.deltas)) {
        // The base *is* the Classic tuning, so a `classic` delta is a contradiction.
        expect(
          variant,
          `${registry.name} deltas restate Classic as an override`,
        ).not.toBe('classic');
        expect(
          VARIANTS,
          `${registry.name} tunes unknown variant ${variant}`,
        ).toHaveProperty(variant);
        for (const [key, value] of Object.entries(deltas)) {
          expect(
            registry.base,
            `${variant} overrides unknown threshold ${key}`,
          ).toHaveProperty(key);
          // A "delta" equal to the Classic value is dead weight pretending to be a rule.
          expect(value, `${variant} ${key} restates the Classic value`).not.toBe(
            registry.base[key],
          );
        }
      }
    }
  });

  it('keeps threshold names unique across registries, so a row is unambiguous', () => {
    const all = REGISTRIES.flatMap((r) => Object.keys(r.base));
    expect(all.sort()).toEqual([...new Set(all)].sort());
  });
});
