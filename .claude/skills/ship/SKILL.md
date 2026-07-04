---
name: ship
description: When a feature/change ships, update the docs it makes stale — flip the product-backlog status, tick BUILD_ORDER, keep ARCHITECTURE's *why* current — minimally, without restating code. Use for "mark X shipped", "we shipped Y, update docs", "ship the feature", "/ship". Product-side complement to /research (which handles experiments).
---

# Ship — doc sync on feature completion

Lightweight. When something ships, keep the docs honest with the **minimum** edits —
usually a status flip + a one-line note. This is not a rewrite pass.

Project doc discipline (CLAUDE.md) governs: **code + tests own the *what*; docs keep
the *why*.** Don't restate signatures or duplicate what the code already says.

**Single-writer contract:** this skill is the sole writer of
[docs/product/BACKLOG.md](../../../docs/product/BACKLOG.md),
[docs/BUILD_ORDER.md](../../../docs/BUILD_ORDER.md), and
[docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md). It writes **nothing else** —
`docs/research/**` belongs to /research; GAME_SPEC.md and CLAUDE.md are human-owned
(propose diffs, never edit).

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
- Running, recording, or **closing** an experiment → **/research** (sole writer of
  `docs/research/`).
- Classifying/drafting a new idea → **/triage**.
- Session wrap-up, commits, handoff → **/checkpoint**.
- A rules/state change → propose the GAME_SPEC diff to the user (human-owned);
  update ARCHITECTURE's *why* yourself once the rule is settled.
