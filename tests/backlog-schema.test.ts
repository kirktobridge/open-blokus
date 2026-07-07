import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Backlog schema test (product P21). The skills orient off the backlogs by
 * grepping only `### <ID>` headings and `**Status:**` lines — never whole files —
 * so that grep is only as trustworthy as the format is uniform. This asserts the
 * format so retrieval is mechanically reliable: the benefit of a structured
 * dataset without leaving markdown. It only *reads* docs — the single-writer
 * contract (BACKLOG.md ← /ship, research/** ← /research) is untouched, and any
 * drift it surfaces is fixed by that file's owner.
 *
 * The canonical heading separator is an em-dash `—`, and `SHIPPED` may only
 * appear as a canonical ` — SHIPPED` suffix (never a hyphen, never baked into the
 * title). Status must be one of the vocab words the file itself documents.
 * Required content fields are asserted only on *open* entries — terminal entries
 * (shipped / won / no-win / played-out) legitimately compress to a status + log.
 */

const DASH = '—'; // em-dash — the canonical heading + SHIPPED separator

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/** All backtick-quoted `words` inside a slice of lines, lowercased. */
function backtickTokens(lines: string[]): Set<string> {
  const out = new Set<string>();
  for (const l of lines) for (const m of l.matchAll(/`([^`]+)`/g)) out.add(m[1].toLowerCase());
  return out;
}

/**
 * Product vocab is documented in BACKLOG.md's own "Status vocab:" paragraph
 * (which wraps across lines). Research vocab is shared and lives in
 * FRAMEWORK.md's "## Status vocabulary" table — both research backlogs point at
 * it ("structured per FRAMEWORK.md"), so it's the single source of truth.
 */
function sectionVocab(text: string, startRe: RegExp, stopAtBlank: boolean): Set<string> {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => startRe.test(l));
  if (start < 0) return new Set();
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ')) {
    if (stopAtBlank && lines[end].trim() === '') break;
    end++;
  }
  return backtickTokens(lines.slice(start, end));
}

// Product: a wrapped "Status vocab:" paragraph in BACKLOG.md. Research: the shared
// "## Status vocabulary" table in FRAMEWORK.md (a markdown table, not a paragraph).
const PRODUCT_VOCAB = sectionVocab(read('../docs/product/BACKLOG.md'), /status vocab/i, true);
const RESEARCH_VOCAB = sectionVocab(
  read('../docs/research/FRAMEWORK.md'),
  /^## Status vocabulary/,
  false,
);

type Backlog = {
  file: string;
  /** Path relative to this test. */
  rel: string;
  /** RegExp an entry ID must match in this backlog. */
  idPattern: RegExp;
  /** The vocab this file's Status values are drawn from. */
  vocab: Set<string>;
};

const BACKLOGS: Backlog[] = [
  {
    file: 'docs/product/BACKLOG.md',
    rel: '../docs/product/BACKLOG.md',
    idPattern: /^P\d+$/,
    vocab: PRODUCT_VOCAB,
  },
  {
    file: 'docs/research/backlog/ai-engine.md',
    rel: '../docs/research/backlog/ai-engine.md',
    idPattern: /^(AE|AD)\d+$/,
    vocab: RESEARCH_VOCAB,
  },
  {
    file: 'docs/research/backlog/advisor.md',
    rel: '../docs/research/backlog/advisor.md',
    idPattern: /^(AE|AD)\d+$/,
    vocab: RESEARCH_VOCAB,
  },
];

type Entry = {
  file: string;
  id: string;
  title: string;
  /** Whole `### …` heading line (trimmed). */
  heading: string;
  /** Leading status word, lowercased (e.g. `proposed`, `no-win`), or null if no Status line. */
  statusToken: string | null;
  /** Body lines between this heading and the next (or EOF). */
  body: string[];
};

type Parsed = {
  file: string;
  /** Vocab words this file's Status values are drawn from, lowercased. */
  vocab: Set<string>;
  entries: Entry[];
  /** IDs listed in the `## Next up` block (product P22), in order. */
  nextUp: string[];
};

const HEADING = new RegExp(`^### (\\S+) ${DASH} (.+?)( ${DASH} SHIPPED)?$`);

/** Bold-wrapped IDs (`**P4**`, `**AE9**`) inside the `## Next up` section. */
function parseNextUp(lines: string[]): string[] {
  const start = lines.findIndex((l) => /^## Next up\b/.test(l));
  if (start < 0) return [];
  let end = start + 1;
  while (end < lines.length && !/^(## |### )/.test(lines[end])) end++;
  const ids: string[] = [];
  for (const l of lines.slice(start, end)) {
    for (const m of l.matchAll(/\*\*(P\d+|AE\d+|AD\d+)\*\*/g)) ids.push(m[1]);
  }
  return ids;
}

function parse(b: Backlog): Parsed {
  const lines = read(b.rel).split('\n');
  const nextUp = parseNextUp(lines);

  const entries: Entry[] = [];
  let current: Entry | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('### ')) {
      const m = HEADING.exec(line);
      // A `### `-level heading that doesn't parse still becomes an entry with a
      // null id so the shape assertion below can flag it.
      current = {
        file: b.file,
        id: m ? m[1] : line,
        title: m ? m[2] : '',
        heading: line,
        statusToken: null,
        body: [],
      };
      entries.push(current);
    } else if (current) {
      current.body.push(line);
      const sm = /\*\*Status:\*\*\s*(.+)/.exec(line);
      if (sm && current.statusToken === null) {
        const tok = /^([A-Za-z][A-Za-z-]*)/.exec(sm[1].trim());
        current.statusToken = tok ? tok[1].toLowerCase() : '';
      }
    }
  }
  return { file: b.file, vocab: b.vocab, entries, nextUp };
}

const parsed = BACKLOGS.map(parse);

// Which statuses mean "still open" (fields required) vs terminal (may compress
// to a status + log).
const OPEN_PRODUCT = new Set(['proposed', 'in-progress', 'partial']);
const OPEN_RESEARCH = new Set(['proposed', 'deferred', 'active']);

// Terminal = the queue is stale if a Next-up entry reached one of these.
const TERMINAL_PRODUCT = new Set(['shipped']);
const TERMINAL_RESEARCH = new Set(['won', 'no-win', 'abandoned', 'played-out']);

const has = (body: string[], label: RegExp) => body.some((l) => label.test(l));

describe('backlog schema', () => {
  for (const p of parsed) {
    describe(p.file, () => {
      const b = BACKLOGS.find((x) => x.file === p.file)!;

      it('finds entries and a documented status vocabulary', () => {
        expect(p.entries.length, 'no `### ` entries parsed').toBeGreaterThan(0);
        expect(p.vocab.size, 'no documented status vocabulary resolved').toBeGreaterThan(0);
      });

      it(`every heading is \`### <ID> ${DASH} Title\` with a valid, unique ID`, () => {
        for (const e of p.entries) {
          expect(HEADING.test(e.heading), `malformed heading: ${e.heading}`).toBe(true);
          expect(b.idPattern.test(e.id), `ID out of namespace: ${e.heading}`).toBe(true);
        }
        const ids = p.entries.map((e) => e.id);
        expect(new Set(ids).size, `duplicate ID within ${p.file}`).toBe(ids.length);
      });

      it('never bakes SHIPPED into the title (canonical ` — SHIPPED` suffix only)', () => {
        for (const e of p.entries) {
          expect(/shipped/i.test(e.title), `SHIPPED in title, not suffix: ${e.heading}`).toBe(
            false,
          );
        }
      });

      it('every entry has a Status drawn from the documented vocab', () => {
        for (const e of p.entries) {
          expect(e.statusToken, `no **Status:** line for ${e.id}`).not.toBeNull();
          expect(
            p.vocab.has(e.statusToken!),
            `status "${e.statusToken}" for ${e.id} not in vocab {${[...p.vocab].join(', ')}}`,
          ).toBe(true);
        }
      });

      it('every open entry carries its required fields', () => {
        const isProduct = b.idPattern.source.startsWith('^P');
        for (const e of p.entries) {
          const tok = e.statusToken ?? '';
          if (isProduct) {
            // Product: Value is universal; Scope only while open (shipped/deferred
            // entries compress).
            expect(has(e.body, /\*\*Value:\*\*/), `${e.id} missing **Value**`).toBe(true);
            if (OPEN_PRODUCT.has(tok)) {
              expect(has(e.body, /\*\*Scope\b/), `open ${e.id} missing **Scope**`).toBe(true);
            }
          } else if (OPEN_RESEARCH.has(tok)) {
            // Research: open questions carry the FRAMEWORK block; terminal ones
            // compress to status + Log.
            for (const [label, re] of [
              ['Objective', /\*\*Objective\b/],
              ['Hypothesis', /\*\*Hypothesis\b/],
              ['Method', /\*\*Method\b/],
              ['Success criteria', /\*\*Success criteria\b/],
              ['Cost', /\*\*Cost\b/],
            ] as const) {
              expect(has(e.body, re), `open ${e.id} missing **${label}**`).toBe(true);
            }
          }
        }
      });

      it('has a `## Next up` block whose IDs all exist and are non-terminal', () => {
        // Product P22: the queue head must never dangle or go stale. Every listed
        // ID must resolve to a real entry in this backlog and not be terminal
        // (shipped / won / no-win / abandoned / played-out) — a shipped item left
        // in the queue fails CI.
        const isProduct = b.idPattern.source.startsWith('^P');
        const terminal = isProduct ? TERMINAL_PRODUCT : TERMINAL_RESEARCH;
        const byId = new Map(p.entries.map((e) => [e.id, e]));

        expect(p.nextUp.length, `${p.file} has no \`## Next up\` IDs`).toBeGreaterThan(0);
        for (const id of p.nextUp) {
          const e = byId.get(id);
          expect(e, `Next-up ID ${id} has no entry in ${p.file}`).toBeDefined();
          expect(
            terminal.has(e!.statusToken ?? ''),
            `Next-up ${id} is terminal ("${e!.statusToken}") — refresh the queue`,
          ).toBe(false);
        }
      });
    });
  }

  it('IDs are globally unique across all backlogs', () => {
    const all = parsed.flatMap((p) => p.entries.map((e) => e.id));
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    expect(dupes, `duplicate IDs across backlogs: ${[...new Set(dupes)].join(', ')}`).toEqual([]);
  });
});
