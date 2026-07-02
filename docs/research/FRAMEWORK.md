# Research framework

How OpenBlokus runs and records experiments. One template, one status vocabulary,
one set of stats rules — so results are comparable and mistakes aren't re-made.
This file owns the *process*; [FINDINGS.md](FINDINGS.md) owns the *conclusions*.

**Scope:** this framework is for **experiments** — measurable questions with a
pre-registered success bar. Shippable **features** (UI, UX, whose success is
"usability" not a metric) go in the [product backlog](../product/BACKLOG.md),
not here. If an entry can't state a success criterion without writing "N/A", it's a
product item.

## The loop

```
idea → backlog entry (objective + hypothesis + method + success)
     → run it → append a record to log/
     → distil the durable claim into FINDINGS.md
     → update the backlog entry's status
```

Backlog = questions we intend to answer. Log = append-only lab notebook of what we
actually ran (never rewritten — a wrong run stays, annotated). Findings = the
curated answers, presentation-ready.

## Backlog entry template

Each planned experiment is one block in a `backlog/*.md` file:

```markdown
### <id> — <short title>
- **Status:** proposed
- **Objective:** the question in one sentence — what decision does the answer change?
- **Hypothesis:** predicted direction + the mechanism (why we expect it).
- **Method:** harness, contestants/configs, N games, seeds, what's held fixed.
- **Success criteria:** the metric + the bar to act (e.g. "adopt if game-share CI
  clears 52% over ≥600 games"). State this *before* running.
- **Cost / risk:** rough compute + whether it's a code change or pure benchmark.
- **Log:** — (link to the run record once executed)
```

Objective, hypothesis, and success criteria are the load-bearing three: pre-committing
to what would count as a win is what stops M1/M2 (see below) from biting.

## Log entry template

Each completed run is one block appended to a `log/*.md` file:

```markdown
### Run <letter/id> — <title> (<seeds/games summary>)
<one line: what question, from which backlog id>

| config | games | metric | 95% CI | p |
...table...

**Read:** what the numbers say, noise-aware.
**Decision:** adopt / no-win / abandoned / needs-more-games + why.
```

## Status vocabulary

Shared by backlog and log. A backlog entry moves through these; a finding cites the
terminal one.

| status | meaning |
|--------|---------|
| `proposed` | written up, not started |
| `active` | currently running / in progress |
| `won` | resolved, cleared its success bar → adopted |
| `no-win` | resolved, ran cleanly, didn't clear the bar (parity or loss) |
| `abandoned` | stopped for a structural reason (impractical, confounded, wrong objective) |
| `deferred` | valid, intentionally not-yet — blocked on another feature or budget |
| `played-out` | further variants sit inside the noise band; not worth more games |

## Stats discipline (non-negotiable, learned the hard way)

See method lessons M1–M3 in [FINDINGS.md](FINDINGS.md) for the runs that taught us
these.

1. **Seed-average.** Single-seed tables mislead. Use `runTournamentSeeds` (N seeds)
   and report **mean ± sample-std**. `mulberry32(seed)` keeps it reproducible.
2. **Cancel first-move bias.** Rotate which color each contestant occupies
   (`runTournament` does this); credit wins by name; split ties evenly.
3. **Report two readouts.** *per-seat win rate* (a name in 2 of 4 seats caps ~0.5)
   and *game-share* (`wins/games`).
4. **Power the run, then use real tests.** Wilson 95% CI + one-sided z vs 50/50 —
   not eyeballed percentages. A result at n < ~200 is `directional` at best.
5. **Pre-register the bar.** Decide the success threshold before seeing results.
6. **Interrogate confounds.** Ask what the harness holds fixed (e.g. a
   heuristic-ordered beam). A suspiciously flat result may be the harness, not the
   world — rerun with the confound removed before concluding.

## Confidence labels (used in FINDINGS)

- `replicated` — multiple seeds/runs independently agree.
- `significant` — one well-powered run, CI clear of the null.
- `directional` — small sample or uncontrolled comparison; a hint, not a fact.

## Harnesses

| domain | harness | entry |
|--------|---------|-------|
| AI strategy | headless arena, pure rules core | [src/game/ai/arena.ts](../../src/game/ai/arena.ts) · `npm run arena [games] [seeds] [baseSeed]` |
| regression guard | ~180 games every `npm test` | [tests/arena.test.ts](../../tests/arena.test.ts), [tests/alphabeta.test.ts](../../tests/alphabeta.test.ts) |
| advisor / evaluator | *not built yet — see [backlog/advisor.md](backlog/advisor.md)* | needs [product backlog](../product/BACKLOG.md) P1 game-logging first |

New research domains (advisor, UX) add their own harness row here and their own
`log/*.md` + `backlog/*.md` files following the same templates.
