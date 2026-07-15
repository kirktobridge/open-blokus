# Research

The OpenBlokus research hub: what we've tried, what we've learned, and what we plan
to try next — for AI strategy, engine performance, and (forthcoming) the advisor /
evaluator / game-analysis line of work.

## Layout

| Path | Role |
|------|------|
| [FRAMEWORK.md](FRAMEWORK.md) | **Process.** The experiment template, status vocabulary, and stats discipline everything follows. Start here. |
| [FINDINGS.md](FINDINGS.md) | **Conclusions.** Curated, presentation-ready insights (findings F#) + method lessons (M#). The "so what." |
| [log/](log/) | **Records.** Append-only lab notebook of runs actually executed. Never rewritten. |
| [backlog/](backlog/) | **Questions.** Planned/deferred experiments, one framework block each. |

### Files today

- [log/ai-strategy.md](log/ai-strategy.md) — CPU-strategy + engine runs (append-only).
- [backlog/ai-engine.md](backlog/ai-engine.md) — AI/engine experiments (AE#).
- [backlog/advisor.md](backlog/advisor.md) — advisor **research questions** only:
  evaluator / win-prob / blunder-signal accuracy (AD2–AD4). The advisor's product
  side (logging, recap UI, overlay, tutorial) is in [product backlog](../product/BACKLOG.md).

## How to use it

**Running an experiment:** grab an entry from `backlog/`, follow its Method, append a
record to the matching `log/*.md`, then distil the durable claim into `FINDINGS.md`
and update the backlog entry's status. The full loop and templates are in
[FRAMEWORK.md](FRAMEWORK.md).

**Presenting results:** `FINDINGS.md` is the source — each finding is claim →
evidence → confidence, already written for an audience.

**Adding a new research domain** (e.g. UX experiments): add a `log/<domain>.md` and a
`backlog/<domain>.md`, register its harness row in FRAMEWORK.md, and link them here.

## Research vs product

Research owns **questions** — measurable, answered by the arena or logged data, with a
success bar (see FRAMEWORK). Shippable **features** — UX, UI, anything whose success is
"usability" not a metric — live in [product backlog](../product/BACKLOG.md), the product backlog.
If a backlog entry needs "N/A (product)" for its success criteria, it's in the wrong
file. The advisor spans both: accuracy questions here (AD2–AD4), delivery there (P1–P4).

## Relationship to the rest of the docs

- Rules → [../GAME_SPEC.md](../GAME_SPEC.md); structure/why → [../ARCHITECTURE.md](../ARCHITECTURE.md);
  features/UX → [product backlog](../product/BACKLOG.md). Research owns the *why behind AI/engine
  tuning* — it does not restate rules or track product work.
- [../dev_notes/](../dev_notes/) is the developer's raw, unmaintained idea dump
  (reference only). Research entries derived from it are the curated versions; the
  dev_notes are not a source of truth.
