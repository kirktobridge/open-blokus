// Doc-debt pairing check: obligations recorded on one side of the doc split must
// have a live counterpart on the other. Born from P36 (2026-07-19): a product
// entry's "still owed" clause survived after the research close voided it, and a
// research note claimed to clear a debt (P37's) belonging to a different
// experiment. Enforced two ways from one source:
//   - PostToolUse hook (settings.json): fires the moment an Edit/Write touches a
//     backlog doc, feeding violations straight back to the session that wrote them.
//   - tests/doc-debts.test.ts: CI durability for edits made outside a session.
//
// Rules (both directions of the `replication-pending` contract):
//   A. Every product entry whose Status carries `replication-pending` must be named
//      (P#) in a research-backlog block that mentions "replication" — the debt
//      needs a research-side tracker, or it is inventory nobody will run.
//   B. Every research block tying a P# to `replication-pending` must point at a
//      product entry that still carries the label — when the debt is cleared or
//      reassigned, both sides move together.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PRODUCT = 'docs/product/BACKLOG.md';
const RESEARCH = [
  'docs/research/backlog/ai-engine.md',
  'docs/research/backlog/advisor.md',
];
const WATCHED = [PRODUCT, ...RESEARCH];

/** Group markdown lines into blocks: headings and list items start a block,
 *  indented continuation lines attach to the current one. */
function blocks(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (/^\s*(?:[-*]|\d+\.)\s/.test(line) || /^#/.test(line) || cur === null) {
      if (cur !== null) out.push(cur);
      cur = line;
    } else {
      cur += '\n' + line;
    }
  }
  if (cur !== null) out.push(cur);
  return out;
}

/** @returns {string[]} human-readable violations; empty = consistent. */
export function checkDocDebts(root = process.cwd()) {
  const problems = [];
  const product = readFileSync(join(root, PRODUCT), 'utf8');

  // Rule A input: product entries whose **Status:** block carries the label.
  const pending = new Set();
  const entries = product.split(/^(?=### P\d+\b)/m);
  for (const entry of entries) {
    const id = /^### (P\d+)\b/.exec(entry)?.[1];
    if (!id) continue;
    const status = blocks(entry).find((b) => /^\s*-\s+\*\*Status:\*\*/.test(b));
    if (status?.includes('replication-pending')) pending.add(id);
  }

  // Rule B input: research blocks mentioning replication, and the P#s they name.
  const tracked = new Set();
  const claims = []; // blocks that bind a P# to the replication-pending label
  for (const rel of RESEARCH) {
    const text = readFileSync(join(root, rel), 'utf8');
    for (const b of blocks(text)) {
      if (!/replication/i.test(b)) continue;
      const pids = [...b.matchAll(/\bP(\d+)\b/g)].map((m) => `P${m[1]}`);
      for (const pid of pids) tracked.add(pid);
      if (b.includes('replication-pending')) {
        for (const pid of pids) claims.push({ pid, rel });
      }
    }
  }

  for (const pid of pending) {
    if (!tracked.has(pid)) {
      problems.push(
        `${pid} is replication-pending in ${PRODUCT} but no docs/research/backlog/ block ` +
          `ties a replication to it — record the owed batch research-side (via /research), ` +
          `or the debt is inventory nobody will run.`,
      );
    }
  }
  for (const { pid, rel } of new Map(claims.map((c) => [`${c.rel}:${c.pid}`, c])).values()) {
    if (!pending.has(pid)) {
      problems.push(
        `${rel} ties ${pid} to a replication-pending label, but ${pid} no longer carries ` +
          `it in ${PRODUCT} — update the research note (debt cleared, reassigned, or never ` +
          `belonged to ${pid}).`,
      );
    }
  }
  return problems;
}

// CLI / hook entry. Modes:
//   --all [root]  check unconditionally (vitest / manual)
//   (hook)        read PostToolUse JSON on stdin; exit 0 fast unless the edited
//                 file is a watched doc, else check and exit 2 on violations.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = process.env.CLAUDE_PROJECT_DIR || process.argv[3] || process.cwd();
  let run = process.argv.includes('--all');
  if (!run) {
    let stdin = '';
    try {
      stdin = readFileSync(0, 'utf8');
    } catch {
      /* no stdin piped */
    }
    let file = '';
    try {
      const payload = JSON.parse(stdin);
      file = payload?.tool_input?.file_path ?? payload?.tool_response?.filePath ?? '';
    } catch {
      /* unparseable → treat as no-op, never block unrelated edits */
    }
    run = WATCHED.some((w) => file.replaceAll('\\', '/').endsWith(w));
  }
  if (run) {
    const problems = checkDocDebts(
      process.argv.includes('--all') && process.argv[3] ? process.argv[3] : root,
    );
    if (problems.length > 0) {
      console.error(`doc-debt-check: ${problems.length} inconsistency(ies):\n- ${problems.join('\n- ')}`);
      process.exit(2);
    }
  }
  process.exit(0);
}
