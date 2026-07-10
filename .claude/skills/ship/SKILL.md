---
name: ship
description: The sole pen for the product docs — flip product-backlog statuses (claims and terminal), tick BUILD_ORDER, keep ARCHITECTURE's *why* current, and append approved /triage drafts — minimally, without restating code. Runs on main, usually as /land's last step. Use for "mark X shipped", "we shipped Y, update docs", "add the approved draft to the backlog", "flip P# to in-progress", "/ship". Product-side complement to /research (which handles experiments).
---

# Ship — the pen for the product docs

This skill is the pen for the product docs: every edit to them — shipped flips,
`in-progress` claims, intake appends — goes through here, whatever the occasion.
Lightweight: keep the docs honest with the **minimum** edits — usually a status
flip + a one-line note. This is not a rewrite pass.

Project doc discipline (CLAUDE.md) governs: **code + tests own the *what*; docs keep
the *why*.** Don't restate signatures or duplicate what the code already says.

**Single-writer contract:** this skill is the sole writer of
[docs/product/BACKLOG.md](../../../docs/product/BACKLOG.md),
[docs/BUILD_ORDER.md](../../../docs/BUILD_ORDER.md), and
[docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md). It writes **nothing else** —
`docs/research/**` belongs to /research; GAME_SPEC.md and CLAUDE.md are human-owned
(propose diffs, never edit).

**Edits land on main only.** Feature branches never carry edits to these three files
(two parallel branches touching `## Next up` conflict every time). So: the
`in-progress` claim is committed on main *before* branching — that's what makes it
visible to other sessions — and the terminal flip + Next up refresh happen at land
time, with /ship running as **/land**'s last step after the merge passes tests.
Only work that never leaves main (docs-only, tiny fixes) gets its /ship pass
directly.

## Steps
1. **Identify what shipped** — from the user's description or git: `git log --oneline -5`,
   `git diff --stat` if unsure which files/areas changed.
2. **Map to the stale doc(s)** and apply the minimal edit:

| What shipped | Doc | Edit |
|---|---|---|
| Product feature / UX / UI | [docs/product/BACKLOG.md](../../../docs/product/BACKLOG.md) | flip entry `Status:` → `shipped`, or `partial` + note which milestone landed. |
| A deployed research finding | *(not yours)* | **don't edit `docs/research/`** — the research backlog is /research's file. Check its `AE#`/`AD#` is closed (`Status` terminal + `Log:` linked); if not, run **/research** to close it. Here, just cross-link the product entry to the `AE#`/`F#`. |
| A build phase completed | [docs/BUILD_ORDER.md](../../../docs/BUILD_ORDER.md) | tick / delete the phase (it's disposable). |
| Structure/architecture changed | [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) | update the *why* **only** — not signatures (its code blocks are illustrative sketches; `src/` wins). |
| Rules changed | *(human-only)* | **do not edit** [docs/GAME_SPEC.md](../../../docs/GAME_SPEC.md) — it's human-owned and edit-guard blocks it. Propose the exact diff to the user, and flag that ARCHITECTURE needs its matching update once applied (they're a kept-in-sync pair). |
| A new easy-to-get-wrong gotcha | *(human-only)* | suggest the **Invariants** line for CLAUDE.md to the user — it governs every session, so it gets human sign-off. Don't edit it directly. |

3. **Cross-link** if the shipped item had a research question or dependency
   (e.g. AE1 → FINDINGS F6; a backlog feature → its research `AD#`).
4. **Verify:** relative links resolve; no stale `proposed`/`deferred`/`partial` left on
   an entry that's now fully shipped.
5. **Refresh `## Next up`** (product P22): on any product status flip or intake, update
   the `## Next up` block at the top of BACKLOG.md — drop a now-terminal ID, promote the
   next dependency-ready entry (payoff-ranked, ≤5, one-line why). The P21 schema test
   ([tests/backlog-schema.test.ts](../../../tests/backlog-schema.test.ts)) fails CI if
   the queue dangles or lists a terminal ID.

## Keep it lightweight (refuse to over-document)
- A status flip + one-line note is usually the whole job. Prefer editing an existing
  line over adding a section.
- If the only *accurate* doc change would be "the code now does X" — **stop.** Code +
  tests own that. No doc edit needed.
- Don't document a feature that GAME_SPEC / ARCHITECTURE already cover generically.

## Intake (from /triage)
When /triage hands over an approved **product** draft, append it to
[docs/product/BACKLOG.md](../../../docs/product/BACKLOG.md) under the right epic with
`Status: proposed`. No other changes — /triage classifies and drafts; this skill is
just the pen for the product backlog.

## Not this skill
- Merging a branch / testing the merged result → **/land** (this skill is its last
  step, not a replacement for it).
- Running, recording, or **closing** an experiment → **/research** (sole writer of
  `docs/research/`).
- Classifying/drafting a new idea → **/triage**.
- Session wrap-up, commits, handoff → **/checkpoint**.
- A rules/state change → propose the GAME_SPEC diff to the user (human-owned);
  update ARCHITECTURE's *why* yourself once the rule is settled.
