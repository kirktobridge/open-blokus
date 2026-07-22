---
name: implement
description: Build a specific product-backlog item (P#) from docs/product/BACKLOG.md — check its dependencies, pick the milestone, branch, implement, test, and verify — then hand integration to /land (which runs /ship's doc flips on main). Use for "implement P4", "build the tutorial item", "pick up P3 R1", or /implement. Code-side complement to /research (which runs experiments); writes code + tests only, never the backlog docs.
---

# Implement — build a product backlog item

Takes one entry (or one milestone of one entry) from
[docs/product/BACKLOG.md](../../../docs/product/BACKLOG.md) to working, verified code
on a feature branch. This skill **writes code and tests only** — every backlog/doc
edit goes through its owner: **/ship** owns BACKLOG.md, BUILD_ORDER.md, and
ARCHITECTURE.md; **/research** owns `docs/research/**`; GAME_SPEC.md is human-owned.

`<ID>` = a product id like `P4`, optionally with a milestone (`P3 R1`).

## Steps

### 1. Locate + gate
- **No ID given?** The product `## Next up` block (top of BACKLOG.md) is the ranked,
  dependency-ready head — propose its first entry (P22).
- Find the entry: `grep -n -A12 "^### <ID>" docs/product/BACKLOG.md`. Not there →
  it's an untriaged idea; bounce to **/triage**, don't invent an entry.
- **CLAIM GATE:** `git show main:docs/product/BACKLOG.md | grep -n "in-progress"`
  first — **main's version, never the checked-out copy**: in a worktree the local
  file reflects when you branched, so it can miss a claim another session made
  since. Target entry already `in-progress` → stop; it's claimed by another session/branch
  (stale claims are cleared via /checkpoint, not overridden here). Another entry
  in-progress whose flagged shared assets overlap this one's Scope → stop too;
  the first claimant builds the shared piece.
- **DEPENDS GATE:** read its `Depends on:`. A dependency that is an unshipped `P#`
  or an unanswered research ID (`AE#`/`AD#` not terminal in its backlog) blocks the
  build — stop and tell the user what's blocking, unless the specific milestone is
  explicitly marked unblocked (e.g. "R0 needs nothing else").
- **MILESTONE GATE:** if Scope lists milestones (R0/R1/…), build **one per
  invocation**. If the user didn't name one, propose the first unshipped one and
  confirm — don't silently build the whole epic.
- **PREMISE GATE:** the entry text is a snapshot from drafting time; the code may
  have moved since. Grep the code symbols the entry names and check every factual
  claim its Status/Scope makes about the code ("default is 0", "X is undeployed",
  "tiers lack Y") against `src/` **before claiming**. A stale premise is a
  scope-renegotiation trigger *now*, not a footnote to build through: surface the
  mismatch to the user and get the entry rescoped via /ship first. Follow-up
  obligations listed in Scope (re-runs, recalibrations, replications) **inherit its
  premises** — a dead premise silently voids or reshapes them, and if carried
  verbatim they propagate into the commit message and /land's doc flip as
  obligations nobody owes (P36's ladder re-run was exactly this).

### 2. Set up
- **CLEAN-TREE GATE:** `git status` must be clean before branching. Dirty tree =
  another task's live state — bounce to /checkpoint; don't branch over it. For a
  deliberately parallel session, take a `git worktree` instead of sharing the tree.
- Flip the entry to `in-progress` **via /ship, committed on main before branching** —
  a flip made on your branch is invisible to other sessions, which defeats the claim
  gate. (/ship edits its files on main only.)
- Then branch off main: `feat/p<#>-<slug>` (matches existing convention, e.g.
  `feat/p1-game-logging`).
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
- Commit on the feature branch. Then **/land** merges it into main, re-runs the
  suite on the merged result, and runs /ship's terminal flip there (`shipped`, or
  `partial` + which milestone) — doc flips never happen on the branch.
- Re-derive any "still owed" follow-ups from the **actual diff**, not the entry's
  Scope text (premise gate, step 1): name in the hand-off to /land only obligations
  the change as-built really incurs, and say explicitly which scope-listed ones
  turned out void and why — /ship writes what it's handed.
- If the work surfaced a *measurable* follow-up question, route it through
  **/triage** — don't tack an experiment onto the feature branch.

## Not this skill
- A research experiment (`AE#`/`AD#`) → **/research**.
- Merging into main → **/land**.
- Doc/status edits of any kind → **/ship** (product docs) or **/research** (research docs).
- Classifying a new idea → **/triage**.
- Session wrap-up, commits-as-closeout, handoff → **/checkpoint**.
- A rules change → the GAME_SPEC diff is proposed to the human first (see /ship);
  don't start building on an unapproved rule.
