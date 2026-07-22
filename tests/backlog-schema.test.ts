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
 *
 * Variant scope (product P57) makes FINDINGS M6 true rather than merely claimed:
 * an open research entry names the variant it will run on, and a finding from F19
 * on names the variant it was measured on. F1–F18 predate the rule and are
 * grandfathered — M6 exists *because* none of them said so.
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
const FRAMEWORK = read('../docs/research/FRAMEWORK.md');
const PRODUCT_VOCAB = sectionVocab(read('../docs/product/BACKLOG.md'), /status vocab/i, true);
const RESEARCH_VOCAB = sectionVocab(FRAMEWORK, /^## Status vocabulary/, false);

// M6's variant vocabulary, sourced from FRAMEWORK.md's "## Variant scope" table so
// the doc stays the definition and this test stays the enforcement.
const VARIANT_VOCAB = sectionVocab(FRAMEWORK, /^## Variant scope/, false);

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

/**
 * The terminal vocab for whichever backlog an entry belongs to. A `Depends on:`
 * can point across files (product P54 blocks research AE29), so the set is chosen
 * by the *dependency's* own ID kind, not the referrer's.
 */
const terminalOf = (e: { id: string }) =>
  /^P\d+$/.test(e.id) ? TERMINAL_PRODUCT : TERMINAL_RESEARCH;

/**
 * `- **Drafted:** YYYY-MM-DD` → the date string, or null.
 *
 * Semantics: **when this entry's claims were last established** — first drafted, or
 * last re-verified against `src/`. Bumping it on re-verification is the intended
 * workflow, not a loophole: the staleness check below asks "has anything landed
 * since someone last confirmed this entry is true?", and re-confirming it is
 * precisely how you answer yes. Bumping it *without* re-reading the code is the
 * abuse, and no test can catch that — only the habit can.
 */
function draftedOn(body: string[]): string | null {
  for (const l of body) {
    const m = l.match(/\*\*Drafted:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  return null;
}

/**
 * The date a terminal entry reached its terminal state, read from the free-form
 * parenthetical the docs already use (`shipped (2026-07-21, merge e69687c)`,
 * `**Rescoped 2026-07-06**`). Returns the *latest* date in the entry's Status
 * line(s) — good enough to answer "did this land after that was drafted?" and
 * conservative: no date means no staleness claim.
 */
function terminalDateOf(body: string[]): string | null {
  const dates: string[] = [];
  for (const l of body) {
    if (!/\*\*Status:\*\*/.test(l) && dates.length === 0 && !/^\s{2,}/.test(l)) continue;
    if (/\*\*Status:\*\*/.test(l) || dates.length > 0) {
      for (const m of l.matchAll(/(\d{4}-\d{2}-\d{2})/g)) dates.push(m[1]);
    }
    if (/^- \*\*(?!Status)/.test(l) && dates.length > 0) break; // next field ends Status
  }
  return dates.length ? dates.sort()[dates.length - 1] : null;
}

/**
 * IDs an entry declares it depends on — **the first physical line of the
 * `Depends on:` field only**.
 *
 * Deliberately conservative. The field's wrapped continuation routinely carries
 * narrative cross-references ("R0.2 note: …P15 M2's planned reuse of it is gone",
 * "**Blocks** AE29–AE31"), which are *not* dependencies; consuming them made this
 * check report P2 as depending on P15 the first time it ran. A staleness tripwire
 * that cries wolf gets ignored, which is strictly worse than one with modest
 * reach — so this under-reports by construction rather than guessing.
 */
function dependsOn(body: string[], idPattern: RegExp): string[] {
  const line = body.find((l) => /\*\*Depends on:\*\*/.test(l));
  if (!line) return [];
  const ids = [...line.matchAll(/\b((?:P|AE|AD)\d+)\b/g)]
    .map((m) => m[1])
    .filter((id) => idPattern.test(id));
  return [...new Set(ids)];
}

/** The first word of a `**Variant:**` line, lowercased, or null if there's no such line. */
function variantToken(body: string[]): string | null {
  for (const l of body) {
    const m = /\*\*Variant:\*\*\s*(.+)/.exec(l);
    if (m) {
      const tok = /^([A-Za-z][A-Za-z-]*)/.exec(m[1].trim());
      return tok ? tok[1].toLowerCase() : '';
    }
  }
  return null;
}

/**
 * Findings in FINDINGS.md, as `### F<n> — Title` + body. Method lessons (`### M<n>`)
 * are about *how we run experiments*, not about a measured constant, so M6's
 * variant-scope rule doesn't apply to them.
 */
function parseFindings(): { n: number; heading: string; body: string[] }[] {
  const out: { n: number; heading: string; body: string[] }[] = [];
  let current: { n: number; heading: string; body: string[] } | null = null;
  for (const raw of read('../docs/research/FINDINGS.md').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const m = /^### F(\d+) /.exec(line);
    if (m) {
      current = { n: Number(m[1]), heading: line, body: [] };
      out.push(current);
    } else if (line.startsWith('### ')) {
      current = null; // an M# lesson or other section — stop collecting
    } else if (current) {
      current.body.push(line);
    }
  }
  return out;
}

/** F1–F18 predate M6; the rule binds from F19 on. */
const VARIANT_TAGGED_FROM = 19;

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
              ['Variant', /\*\*Variant\b/],
            ] as const) {
              expect(has(e.body, re), `open ${e.id} missing **${label}**`).toBe(true);
            }
            // M6: and the variant it names must be one the framework defines.
            const v = variantToken(e.body);
            expect(
              VARIANT_VOCAB.has(v ?? ''),
              `open ${e.id} has **Variant:** "${v}" — not in {${[...VARIANT_VOCAB].join(', ')}}`,
            ).toBe(true);
          }
        }
      });

      it('every open entry is dated', () => {
        // An entry is a snapshot of what was true when someone wrote it. Without a
        // date, a claim drafted before the code it describes is indistinguishable
        // from one written this morning — which is exactly how P54 shipped a scope
        // whose premise two other entries had already invalidated. The date is what
        // makes /implement's premise gate *affordable*: re-verify the old ones
        // rather than all of them.
        const open = b.idPattern.source.startsWith('^P') ? OPEN_PRODUCT : OPEN_RESEARCH;
        const today = new Date().toISOString().slice(0, 10);
        for (const e of p.entries) {
          if (!open.has(e.statusToken ?? '')) continue;
          const d = draftedOn(e.body);
          expect(d, `open ${e.id} has no **Drafted:** YYYY-MM-DD`).not.toBeNull();
          expect(d! <= today, `${e.id} is drafted in the future (${d})`).toBe(true);
        }
      });

      it('flags an open entry older than a dependency that has since landed', () => {
        // P54's failure, mechanized. An entry drafted *before* something it depends
        // on reached a terminal state is presumptively stale: the dependency
        // usually moved the very code the entry describes (P20 M2b's sweep is what
        // silently voided most of P54's scope). This does not mean the entry is
        // wrong — it means nobody may build it without re-checking against `src/`
        // and re-dating it. Conservative by construction: it only fires when *both*
        // dates are parseable, so a missing date never invents an alarm.
        const isProduct = b.idPattern.source.startsWith('^P');
        const open = isProduct ? OPEN_PRODUCT : OPEN_RESEARCH;
        const byId = new Map(parsed.flatMap((q) => q.entries.map((e) => [e.id, e] as const)));

        for (const e of p.entries) {
          if (!open.has(e.statusToken ?? '')) continue;
          const drafted = draftedOn(e.body);
          if (!drafted) continue; // the check above owns that failure
          for (const depId of dependsOn(e.body, /^(P|AE|AD)\d+$/)) {
            const dep = byId.get(depId);
            if (!dep || !terminalOf(dep).has(dep.statusToken ?? '')) continue;
            const landed = terminalDateOf(dep.body);
            if (!landed || landed <= drafted) continue;
            expect.fail(
              `${e.id} (drafted ${drafted}) depends on ${depId}, which landed ` +
                `${landed} — presumptively stale. Re-verify its claims against ` +
                `src/ and bump **Drafted:**, or rescope it, before building.`,
            );
          }
        }
      });

      it('every `won` entry names where it deployed', () => {
        // The close side of the schema. The open-side check above guards fields on
        // the way *in*; this guards the way *out*. FRAMEWORK's won-close requires a
        // `Deploys as:` pointer because a won result with no owner is inventory, not
        // value — and the intent is easy to bury in Status/Log prose ("ship the
        // knob (product-side)"), where nothing can grep it and no one is accountable
        // for it. A structured field is checkable; a sentence is not. State
        // `no deployment surface` when there genuinely is none.
        if (b.idPattern.source.startsWith('^P')) return; // research backlogs only
        for (const e of p.entries) {
          if (e.statusToken !== 'won') continue;
          expect(
            has(e.body, /\*\*Deploys as:\*\*/),
            `won ${e.id} has no **Deploys as:** — name the product P#, the ` +
              `retune-in-place task, or "no deployment surface"`,
          ).toBe(true);
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

  describe('docs/research/FINDINGS.md', () => {
    it('resolves a documented variant vocabulary', () => {
      expect(
        VARIANT_VOCAB.size,
        'no `## Variant scope` vocabulary resolved from FRAMEWORK.md',
      ).toBeGreaterThan(0);
    });

    it(`every finding from F${VARIANT_TAGGED_FROM} on names the variant it was measured on`, () => {
      // M6: a constant is presumed variant-scoped until measured otherwise, and a
      // mechanism is presumed portable but still says so. The tag is the `**(Classic)**`
      // form F17/F18 already use.
      const tag = new RegExp(`\\*\\*\\((${[...VARIANT_VOCAB].join('|')})\\)\\*\\*`, 'i');
      for (const f of parseFindings()) {
        if (f.n < VARIANT_TAGGED_FROM) continue;
        expect(
          f.body.some((l) => tag.test(l)),
          `F${f.n} has no variant tag — add one of **(${[...VARIANT_VOCAB].join(')** / **(')})**`,
        ).toBe(true);
      }
    });
  });

  it('IDs are globally unique across all backlogs', () => {
    const all = parsed.flatMap((p) => p.entries.map((e) => e.id));
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    expect(dupes, `duplicate IDs across backlogs: ${[...new Set(dupes)].join(', ')}`).toEqual([]);
  });
});
