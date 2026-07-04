---
name: triage
description: Classify a raw idea (dev_notes, conversation, anywhere) as a research experiment vs a product feature and draft the backlog entry — without writing any file. Use for "add this idea", "triage the dev notes", "where does this idea belong", "groom the backlog", or /triage. Hands the draft to /research (research backlog) or /ship (product backlog) to write.
---

# Triage — idea intake & classification

Turns raw ideas into correctly-classified, correctly-shaped backlog drafts. This skill
**writes nothing** — each backlog file has exactly one writer (/research for
`docs/research/`, /ship for `docs/product/BACKLOG.md`), and triage stays write-less so
that stays true. Output = classification + draft + which skill should write it.

## Sources
- [docs/dev_notes/OPEN_IDEAS.md](../../../docs/dev_notes/OPEN_IDEAS.md) — the human's
  raw dump. **Read-only** (edit-guard enforces it) and explicitly not a source of
  truth: ideas in it may already be shipped, deferred, or dead. Always check both
  backlogs (grep the headings) before drafting — don't re-propose what exists.
- Ideas raised in conversation, code review, or a /research finding's fallout.

## The classification test (from FRAMEWORK.md's scope rule)
Ask: **can this state a pre-registered success criterion — a metric + a bar?**
- **Yes** (game-share vs baseline, iters/s, latency ceiling, prediction accuracy) →
  **research experiment**. Draft with FRAMEWORK.md's backlog template (Objective /
  Hypothesis / Method / Success criteria / Cost / Log) with `Status: proposed`.
  Destination: the right `docs/research/backlog/*.md`, written by **/research**
  (Phase P).
- **No** — success is "usability", "feel", "it exists" → **product feature**. Draft
  with the product shape (Status / Value / Scope / Depends on) with
  `Status: proposed`. Destination: the right epic in
  [docs/product/BACKLOG.md](../../../docs/product/BACKLOG.md), written by **/ship**
  (Intake).
- **Both** (an advisor-style feature resting on an unproven signal) → split it:
  the accuracy question → research draft; the delivery → product draft, with
  `Depends on:` pointing at the research ID. The AD#/P# pairs are the precedent.

## Steps
1. Restate the idea in one sentence; run the classification test out loud.
2. Check for an existing entry (`grep -in "<keyword>" docs/research/backlog/*.md docs/product/BACKLOG.md`).
   If one exists, the output is "already tracked as <ID> — update it via its owner"
   — not a duplicate draft.
3. Draft the entry in the destination's template, including where it slots
   (payoff order for research; epic for product).
4. Present draft + destination to the user; on approval, hand to /research or /ship
   to write it.

## Not this skill
- Writing the entry → **/research** (Phase P) or **/ship** (Intake).
- Deciding *when* to build it → the backlogs are pools; sequencing is the user's call.
