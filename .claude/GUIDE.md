# Skill framework — quick guide

Six skills, one loop: **triage** an idea in → **implement** (product) or
**research** (experiment) it on a branch → **land** the branch on main →
**ship** the docs → **checkpoint** the session. Each tracking file has exactly
one skill that writes it, so nothing goes stale or gets double-edited.

## The skills

### /triage — "I have an idea"
Sorts a raw idea into the right backlog and drafts the entry. Writes nothing
until you approve.

```
/triage pieces could make a soft click sound when placed
/triage what if MCTS pruned symmetric first moves
triage the dev notes
```

→ You get: research or product? already tracked? + a ready draft.
Approve it and /research or /ship writes it in.

### /research — "run the experiment"
The whole experiment loop for `docs/research/`: pick a backlog entry, run the
arena, log the run, distil the finding, close the entry. Owns all of
`docs/research/`.

```
/research                     ← what's open, what's next
/research run AE9             ← start an experiment
/research record              ← log arena results
/research findings            ← distil + close the loop
```

Arena setups go in `scripts/experiments/<id>.json` — never edited into src.

### /implement — "build P#"
Takes one product-backlog entry (or one milestone of it) to verified code on a
feature branch. Claims the entry `in-progress` on main first (via /ship) so
parallel sessions see the claim; writes code + tests only, never the docs.

```
/implement P4
pick up P3 R1
```

### /land — "merge it into main"
The integration step: merge one finished branch into main, re-run the full suite
on the merged result, then run /ship's doc flips there. Doc flips happen at land
time — never on the branch — so parallel branches can't conflict on the backlog.
Runs in a forked subagent (`context: fork`), so the merge/test output doesn't eat
the session's context — you get back a compact landing report.

```
/land feat/p10-long-move-feedback
land this branch
```

### /ship — "sync the docs"
The pen for the product docs — nothing else writes BACKLOG.md, BUILD_ORDER.md,
or ARCHITECTURE.md, and it writes them **on main only**. Flips statuses (claims
+ terminal), refreshes `## Next up`, appends approved /triage drafts. Usually
runs as /land's last step.

```
/ship                          ← figure out what shipped from git
mark P5 partial — tray finish landed
add the approved draft to the backlog
```

It will *propose* GAME_SPEC or CLAUDE.md changes to you but never edit them —
those are yours.

### /checkpoint — "wrap up the session"
End-of-session closeout: checks nothing is dangling (statuses honest, tree
clean, unmerged branches accounted for), makes tidy commits, and updates **this
branch's section** of `.claude/HANDOFF.md`. HANDOFF holds one section per
in-flight branch — parallel sessions each own theirs — and marks which branches
are ready for /land.

```
/checkpoint
wrap up
```

## Typical days

**Research idea → answered:**
```
/triage <idea>  →  /research run AE#  →  /research record  →  /research findings  →  /land  →  /checkpoint
```

**Product/UI idea → shipped:**
```
/triage <idea>  →  /implement P#  →  /land  →  /checkpoint
```

**Parallel sessions:** one branch per session (use `git worktree` for truly
simultaneous work); each /checkpoint touches only its own HANDOFF section;
/land integrates one branch at a time, on main.

**Starting a fresh session:**
```
read .claude/HANDOFF.md   (or just: "what's next?")
```

## Who writes what (the single-writer map)

| File | Only writer | Where |
|---|---|---|
| `docs/research/` (backlog, log, FINDINGS) | /research | branch or main |
| `docs/product/BACKLOG.md`, `BUILD_ORDER.md`, `ARCHITECTURE.md` | /ship | **main only** |
| `.claude/HANDOFF.md` | /checkpoint (own branch's section only) | local, gitignored |
| `GAME_SPEC.md`, `CLAUDE.md`, `docs/dev_notes/` | **you** (human-only) | — |
