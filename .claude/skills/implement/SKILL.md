---
name: implement
description: Build a specific product-backlog item (P#) from docs/product/BACKLOG.md — check its dependencies, pick the milestone, branch, implement, test, and verify — then hand the doc flips to /ship. Use for "implement P4", "build the tutorial item", "pick up P3 R1", or /implement. Code-side complement to /research (which runs experiments); writes code + tests only, never the backlog docs.
---

# Implement — build a product backlog item

Takes one entry (or one milestone of one entry) from
[docs/product/BACKLOG.md](../../../docs/product/BACKLOG.md) to working, verified code
on a feature branch. This skill **writes code and tests only** — every backlog/doc
edit goes through its owner: **/ship** owns BACKLOG.md, BUILD_ORDER.md, and
ARCHITECTURE.md; **/research** owns `docs/research/**`; GAME_SPEC.md and CLAUDE.md
are human-owned.

`<ID>` = a product id like `P4`, optionally with a milestone (`P3 R1`).

## Steps

### 1. Locate + gate
- Find the entry: `grep -n -A12 "^### <ID>" docs/product/BACKLOG.md`. Not there →
  it's an untriaged idea; bounce to **/triage**, don't invent an entry.
- **DEPENDS GATE:** read its `Depends on:`. A dependency that is an unshipped `P#`
  or an unanswered research ID (`AE#`/`AD#` not terminal in its backlog) blocks the
  build — stop and tell the user what's blocking, unless the specific milestone is
  explicitly marked unblocked (e.g. "R0 needs nothing else").
- **MILESTONE GATE:** if Scope lists milestones (R0/R1/…), build **one per
  invocation**. If the user didn't name one, propose the first unshipped one and
  confirm — don't silently build the whole epic.

### 2. Set up
- Branch off main: `feat/p<#>-<slug>` (matches existing convention, e.g.
  `feat/p1-game-logging`).
- Flip the entry to `in-progress` **via /ship** (it's the sole writer of BACKLOG.md).
- For anything nontrivial, plan first (plan mode / a short written plan naming the
  files to touch) before editing.

### 3. Build
- The entry's **Scope is the contract** — build what it says, resist adjacent
  improvements. If scope turns out wrong mid-build, stop and renegotiate the entry
  with the user (the rescope note lands in BACKLOG.md via /ship), don't drift.
- CLAUDE.md's **Invariants govern** — don't re-derive them here. The recurring ones:
  rules logic goes in the pure core `src/game/` (no React/boardgame.io imports),
  `G` stays plain JSON, moves stay cheat-resistant.
- Shared assets flagged in the entry ("shares assets with P3", "build once") are
  binding: build the shared component once, in the place both consumers can reach.
- New rules-core behavior gets unit tests next to the existing ones; new UI flows
  get a Playwright spec.

### 4. Verify + close
- `npm test` (vitest **and** Playwright e2e — always both), `npm run typecheck`,
  `npm run lint`. Wrap long runs with `time`.
- Run **/verify** — drive the affected flow in the real app, not just tests.
- Commit on the feature branch. Then run **/ship** to flip the status
  (`shipped`, or `partial` + which milestone) and sync any other stale doc.
- If the work surfaced a *measurable* follow-up question, route it through
  **/triage** — don't tack an experiment onto the feature branch.

## Not this skill
- A research experiment (`AE#`/`AD#`) → **/research**.
- Doc/status edits of any kind → **/ship** (product docs) or **/research** (research docs).
- Classifying a new idea → **/triage**.
- Session wrap-up, commits-as-closeout, handoff → **/checkpoint**.
- A rules change → the GAME_SPEC diff is proposed to the human first (see /ship);
  don't start building on an unapproved rule.
