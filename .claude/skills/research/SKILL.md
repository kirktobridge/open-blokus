---
name: research
description: Run and maintain OpenBlokus AI/engine experiments end-to-end — start a backlog experiment, run the arena, record a run to the log, and distil findings — enforcing the project's experiment discipline. Use for "run experiment AE3", "record the arena results", "update the research log", "add a finding", "what research is open", or /research. Keeps docs/research/ (backlog, log, FINDINGS) consistent.
---

# Research workflow

Operationalizes the experiment loop for `docs/research/`. This skill orchestrates;
**[docs/research/FRAMEWORK.md](../../../docs/research/FRAMEWORK.md) is the authority**
for templates, the status vocabulary, and stats rules. Read it if unsure — do not
restate or fork its rules here.

The loop (from FRAMEWORK): **backlog entry → run → record to log → distil to FINDINGS
→ flip status.** Detect which phase the user is in from their words/args and run that
phase. `<ID>` = a backlog id like `AE3` (ai-engine) or `AD1` (advisor).

**Single-writer contract:** this skill is the **sole writer of `docs/research/**`**
(backlog, log, FINDINGS). /ship never touches these; when a research win ships as a
feature, the close (Phase 4) still happens here.

Map of the folder:
- [backlog/](../../../docs/research/backlog/) — planned experiments (`AE#`, `AD#`), one framework block each.
- [log/](../../../docs/research/log/) — append-only run records.
- [FINDINGS.md](../../../docs/research/FINDINGS.md) — curated claims (`F#`) + method lessons (`M#`).
- Arena runner: [src/game/ai/arena.cli.ts](../../../src/game/ai/arena.cli.ts),
  `npm run arena [games] [seeds] [baseSeed] -- --config=scripts/experiments/<id>.json`.
- Experiment configs: `scripts/experiments/*.json` — seats + options per run (see Phase 1).
- Stats: `stats.py` next to this file (see Phase 3).

**Token discipline (applies to every phase):** orient by `grep`, not by reading whole
files. The backlog is skimmed via its `Status:` lines; the log is **append/tail/grep
only** — it grows forever and no task needs all of it.

## Phase 0 — orient (`/research`, "what's open")
`grep -n "Status:\|^### " docs/research/backlog/*.md` — that's the whole orientation
read; open a full entry only for the ID you're about to work on. Report what's
`active`, what's `proposed` (highest-payoff first — the files are payoff-ordered), and
any `active` entry with no matching log run (a dangling run — check via
`grep "^### Run" docs/research/log/*.md | tail`). Suggest the next action **across
all backlog files** — merge the `## Next up` heads into one ranked list, not just
the file that was asked about. **Starvation check:** from the same log grep, count
recent runs per domain; a track with a dependency-ready head but no runs among the
last ~8 gets flagged explicitly (the AD track once sat unstarted through ~20 AE
runs) — momentum is not priority, though sequencing stays the user's call. Don't
change anything.

## Phase 1 — run (`/research run <ID>`, "run experiment X")
1. Open the backlog entry. **START GATE:** it must have a concrete, pre-committed
   `Success criteria` (a metric + a bar). If vague/missing, stop and pin it down with
   the user first — pre-registering the bar is method lesson **M2**; deciding it after
   seeing results is how you fool yourself. **The bar must also be achievable:** check
   the entry's `Power:` line, or run `stats.py --power` (Phase 3) against the Method's
   planned n — if the minimum detectable effect exceeds the hypothesized effect,
   resize the run or restate the bar with the user before flipping to `active`.
   A "positive but under the bar" rerun costs more than powering once.
2. Flip that entry's `Status:` to `active`.
3. Configure the run in a **config file, not source**: write (or reuse)
   `scripts/experiments/<id>.json` — `{ "title", "seats": [{name, strategy, options}] }`,
   strategies `random|greedy-size|heuristic|alphabeta|mcts` — matching the entry's
   Method. **Never edit the tables in `arena.cli.ts`** — those are standing baselines;
   the config file is what makes the run reproducible from the log. Commit the config
   with the run record.
4. Run `npm run arena <games> <seeds> <baseSeed> -- --config=scripts/experiments/<id>.json`
   (wrap with `time`). **Seed-average** (multiple seeds) — single-seed tables mislead
   (**M1**). Capture the console output verbatim for Phase 2. For heavy sweeps, run
   several seed batches and pool them in Phase 3.

## Phase 2 — record (`/research record`, "log the results")
Append a run block to the matching `log/<domain>.md` using FRAMEWORK's log template
(Run id, one-line question + backlog id, result table, **Read**, **Decision**).
Get the last run id with `tail -40` on the log and cite prior runs via grep —
**never read the full log**; it's an append-only archive.
- **APPEND-ONLY GATE:** never edit or delete a prior run. A wrong/retracted run stays,
  annotated — the retraction is the lesson (see FINDINGS M1). New runs go at the bottom.
- **NO SYNTHESIS HERE:** the log is raw records. Conclusions/insights go to FINDINGS in
  Phase 4, not the log.
- Compute every stat with `stats.py` (Phase 3), don't eyeball percentages.

## Phase 3 — stats (used inside Phase 2)
Run the bundled helper for game-share + Wilson 95% CI + one-sided z vs 50/50:
```
python3 .claude/skills/research/stats.py WINS GAMES
python3 .claude/skills/research/stats.py --pool W1/G1 W2/G2 ...   # pool seed batches/shards
python3 .claude/skills/research/stats.py --power --bar 52 --effect 54   # n needed to clear the bar
python3 .claude/skills/research/stats.py --power --bar 52 --n 600       # min detectable share at n
```
It flags `n < 200` as directional-only (**M1**) and reports whether the CI clears the
null. Use its numbers verbatim in the log and FINDINGS. `WINS` may be fractional
(arena splits ties). Confirm the config against the success bar the entry pre-registered.

## Phase 4 — distil + close (`/research findings`, "add a finding")
1. Write or update the claim in `FINDINGS.md`: `claim → evidence (run link + n) →
   confidence`. Confidence label is `replicated` (multiple seeds/runs agree),
   `significant` (one well-powered run, CI clear), or `directional` (small/uncontrolled).
   Retracted claims stay struck-through — don't delete them.
2. **CLOSE GATE:** flip the backlog entry's `Status:` to its terminal value
   (`won` / `no-win` / `abandoned` / `played-out` / `deferred`) and link the log run in
   its `Log:` field. An unclosed loop means the backlog lies to the next session.
3. **`won`-close extras (all three, part of the close):**
   - **Deployment pointer:** if the win has shipping value, the entry gains a
     `Deploys as:` line (a product P# via /triage→/ship, or a named retune-in-place
     task) — or states `no deployment surface`. A won result with no owner is
     inventory, not value (F15's w=0.25 sat undeployed behind a default of 0).
   - **Replication before shipped defaults:** if the result changes a shipped
     default (difficulty tiers, mcts defaults), run and pool a second independent
     seed batch before closing — or label the finding `significant,
     replication-pending` and park the batch in `## Next up` (F9's second batch is
     exactly what replication catches).
   - **Staleness sweep:** if the change moves engine throughput or a default, grep
     FINDINGS for tunings that depend on the changed quantity (beam:iteration
     ratios, budget→strength curves, tier time caps) and list the re-check
     candidates in the close — file a cheap re-validation entry or state why each
     is unaffected (F12's 2.5× iteration jump silently changed what F8's
     `beam ≈ iters/6` rule sees).
4. **Refresh `## Next up`** (product P22): update that backlog file's `## Next up`
   block — a just-closed entry leaves the head; promote the next dependency-ready one.
   The P21 schema test fails CI if the queue lists a now-terminal ID.

## Phase P — propose (new entry, usually via /triage)
When /triage (or the user) hands over a **research** draft: append a framework block
(template in FRAMEWORK.md) with `Status: proposed` to the right `backlog/*.md`, slotted
by expected payoff. Verify it has a pre-registerable success bar — if it can't state
one without "N/A", bounce it back to /triage as a product item. Verify the `Power:`
line is filled (`stats.py --power`, Phase 3) and the bar is reachable at the Method's
n. **New-track gate (M5):** if this is the first entry of a new domain or claim-type,
it must name the track's external readout — and if none exists, building one *is* the
first entry, drafted before any self-relative run. **Variant gate (M6):** the entry
carries a `Variant:` line (`classic` / `duo` / `both` / `mechanism`, vocabulary in
FRAMEWORK.md's `## Variant scope`) — the schema test fails an open entry without one.
Where the Method's corpus or harness is a different variant than the question, name
the gap in the entry rather than inheriting it silently. Also slot the new entry
into that file's `## Next up` block if it's dependency-ready (payoff-ranked).

## Discipline checklist (refuse to skip, applies to every phase)
- [ ] Success bar pre-registered before running (M2)
- [ ] Bar achievable at the planned n (`stats.py --power`) before flipping to `active`
- [ ] Seed-averaged; not calling a win off one seed or n < ~200 (M1)
- [ ] Stats from `stats.py`, not eyeballed
- [ ] Run config in `scripts/experiments/`, `arena.cli.ts` untouched
- [ ] Log append-only; synthesis in FINDINGS, not the log
- [ ] Backlog `Status` flipped + run linked at close
- [ ] `won` close: deployment pointer + replication-for-shipped-defaults + staleness sweep
- [ ] New track names its external readout before self-relative runs (M5)
- [ ] Open entry carries `Variant:`; a finding from F19 on carries its variant tag (M6)
