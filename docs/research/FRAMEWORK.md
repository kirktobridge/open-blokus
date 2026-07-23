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
- **Variant:** classic | duo | both | mechanism — which variant this runs on (see
  **Variant scope** below). Required while the entry is open.
- **Objective:** the question in one sentence — what decision does the answer change?
- **Hypothesis:** predicted direction + the mechanism (why we expect it).
- **Method:** harness, contestants/configs, N games, seeds, what's held fixed.
- **Success criteria:** the metric + the bar to act (e.g. "adopt if game-share CI
  clears 52% over ≥600 games"). State this *before* running.
- **Power:** planned n and the minimum detectable effect at the bar
  (`stats.py --power`) — the bar must be reachable by the Method's n.
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
<tuning-type results (ratios, budgets, curves) add: **Measured under:** engine
state — commit sha or shorthand like "post-AE9 bitboards" — so a later engine
step-change can find what it stales>

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

See method lessons M1–M5 in [FINDINGS.md](FINDINGS.md) for the runs that taught us
these.

1. **Seed-average.** Single-seed tables mislead. Use `runTournamentSeeds` (N seeds)
   and report **mean ± sample-std**. `mulberry32(seed)` keeps it reproducible.
2. **Cancel first-move bias.** Rotate which color each contestant occupies
   (`runTournament` does this); credit wins by name; split ties evenly.
3. **Report two readouts.** *per-seat win rate* (a name in 2 of 4 seats caps ~0.5)
   and *game-share* (`wins/games`).
4. **Power the run, then use real tests.** Wilson 95% CI + one-sided z vs 50/50 —
   not eyeballed percentages. A result at n < ~200 is `directional` at best.
   Size the run *before* starting: `stats.py --power` turns bar + hypothesized
   effect into the required n (and planned n into the minimum detectable effect) —
   a bar the planned n cannot clear is a mis-registered bar.
5. **Pre-register the bar.** Decide the success threshold before seeing results.
6. **Interrogate confounds.** Ask what the harness holds fixed (e.g. a
   heuristic-ordered beam). A suspiciously flat result may be the harness, not the
   world — rerun with the confound removed before concluding.
7. **Anchor externally, early.** A new research track names its outside-world
   readout *before* self-relative runs accumulate (M5); where a standing readout
   exists (Pentobi bridge, `npm run arena:pentobi`), report wins against it, not
   only against the incumbent.

## Confidence labels (used in FINDINGS)

- `replicated` — multiple seeds/runs independently agree.
- `significant` — one well-powered run, CI clear of the null.
- `directional` — small sample or uncontrolled comparison; a hint, not a fact.

## Variant scope

Method lesson **M6**: a tuned constant is scoped to the variant it was measured on, so
the claim has to say which. A constant is presumed variant-scoped until measured
otherwise; a mechanism is presumed portable but still says so — the point is to make
the transfer question explicit, not to assume either answer.

| variant | meaning |
|---------|---------|
| `classic` | 20×20, four colors, basic scoring — the GAME_SPEC.md game |
| `duo` | 14×14, two colors, interior start cells, advanced-only scoring — GAME_SPEC_DUO.md |
| `both` | measured on (or claimed for) both variants |
| `mechanism` | a mechanism-level claim — search technique, throughput, methodology — presumed to transfer, with no constant riding on the board |

Two places carry it, and [tests/backlog-schema.test.ts](../../tests/backlog-schema.test.ts)
enforces both: every **open** backlog entry carries a **Variant:** line, and every
finding from **F19** on carries a bold tag on its Confidence line (the **(Classic)**
form F17/F18 already use). F1–F18 are grandfathered — M6 exists precisely because none
of them said so.

## Harnesses

| domain | harness | entry |
|--------|---------|-------|
| AI strategy | headless arena, pure rules core | [src/game/ai/arena.ts](../../src/game/ai/arena.ts) · `npm run arena [games] [seeds] [baseSeed]` |
| regression guard | ~180 games every `npm test` | [tests/arena.test.ts](../../tests/arena.test.ts), [tests/alphabeta.test.ts](../../tests/alphabeta.test.ts) |
| engine profiling | CPU profile scripts | [scripts/profile-mcts.ts](../../scripts/profile-mcts.ts) · `npx vite-node scripts/profile-mcts.ts` (Run N / F10) |
| population play / pool Elo | round-robin over a frozen pool → Bradley-Terry Elo | `npm run arena … --pool=scripts/experiments/pool.json [--members=a,b,c]` (F19); shard heavy pools — see below |
| advisor / evaluator | *not built yet — see [backlog/advisor.md](backlog/advisor.md)* | needs [product backlog](../product/BACKLOG.md) P1 game-logging first |

**Experiment configs:** an experiment's arena setup lives in
`scripts/experiments/<id>.json` (title + seats, each `{name, strategy, options}`) and
runs via `npm run arena <games> <seeds> <baseSeed> -- --config=scripts/experiments/<id>.json`.
Never edit the hardcoded tables in `arena.cli.ts` for a run — those are the standing
baselines. Commit the config alongside the log record so every run is reproducible.

**Heavy / sharded sweeps — reuse, don't re-derive.** When one process is too slow
(MCTS pools; the champion is ~130 s/game), shard with the existing tooling rather than
rebuilding it: `scripts/experiments/ae21-sweep.sh` runs parallel seed-batches of a
`--pool` round-robin (resumable), `ae21-champion.sh` runs one heavy contestant as
isolated pair-sweeps (no seed-collision), and `ae21-pool.ts` sums the shards → refits
Elo → Wilson CIs. `ae28-sweep.sh` is the single-config head-to-head analog. Oversubscribing
cores is safe **only** for fixed-work engines (fixed-iteration MCTS, fixed-depth alphabeta) —
CPU contention then moves wall-time, never strength; never shard a wall-clock-budgeted tier.
Cost is real (AE21's full pool was ~85 CPU-h even sharded — Sweep A alone ~51) — **`time`
every batch and size n from a measured probe, never a guess** (M1's sibling: the estimate
lies too — AE21's first ETA was ~4× low).

New research domains (advisor, UX) add their own harness row here and their own
`log/*.md` + `backlog/*.md` files following the same templates.
