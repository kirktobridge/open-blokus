import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EVENT_IDS, EVENT_THRESHOLDS } from '../src/client/drama';

/**
 * Registry alignment test (P32, in the spirit of P21's backlog-schema test): the
 * event vocabulary is documented in docs/EVENTS.md and implemented in drama.ts, and
 * this asserts the two agree **in both directions** — no undocumented event, no
 * documented event that doesn't exist, no threshold whose doc'd value has drifted
 * from the code. The doc is a source of truth precisely because it can't rot.
 */

const doc = readFileSync(fileURLToPath(new URL('../docs/EVENTS.md', import.meta.url)), 'utf8');

/** Rows of the vocabulary table: `| `id` | text | trigger | thresholds | consumers |`. */
interface Row {
  id: string;
  thresholds: string;
}

function vocabularyRows(): Row[] {
  const rows: Row[] = [];
  for (const line of doc.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 5) continue;
    const id = cells[0].match(/^`([a-z-]+)`$/)?.[1];
    if (!id) continue; // header / separator / the consumers table
    rows.push({ id, thresholds: cells[3] });
  }
  return rows;
}

describe('docs/EVENTS.md ↔ drama.ts', () => {
  const rows = vocabularyRows();

  it('documents every event id, and invents none', () => {
    expect(rows.map((r) => r.id).sort()).toEqual([...EVENT_IDS].sort());
  });

  it('quotes every threshold at the value the code actually uses', () => {
    const documented = new Map<string, string>();
    for (const row of rows) {
      for (const [, key, value] of row.thresholds.matchAll(/([A-Z][A-Z_]+)=([\d.]+)/g)) {
        documented.set(key, value);
      }
    }
    for (const [key, value] of documented) {
      expect(EVENT_THRESHOLDS, `EVENTS.md documents unknown threshold ${key}`).toHaveProperty(key);
      expect(
        Number(value),
        `EVENTS.md says ${key}=${value}, code says ${EVENT_THRESHOLDS[key as keyof typeof EVENT_THRESHOLDS]}`,
      ).toBe(EVENT_THRESHOLDS[key as keyof typeof EVENT_THRESHOLDS]);
    }
  });

  it('documents every threshold the code defines', () => {
    const documented = new Set<string>();
    for (const row of rows) {
      for (const [, key] of row.thresholds.matchAll(/([A-Z][A-Z_]+)=/g)) documented.add(key);
    }
    expect([...documented].sort()).toEqual(Object.keys(EVENT_THRESHOLDS).sort());
  });
});
