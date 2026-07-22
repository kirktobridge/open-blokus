# Skill framework — quick guide

Seven skills, one loop with two tracks. **triage** sorts an idea in: product
features — the usual case — go to **implement**, then **verify** in the running
app; AI/engine experiments go to **research** and are proven in the arena
instead. Both tracks end the same way: **land** the branch on main → **ship**
the docs → **checkpoint** the session. Each tracking file has exactly one skill
that writes it, so nothing goes stale or gets double-edited.

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

### /verify — "does it actually work?"
Drives the affected flow in the *running app* (real servers, headless
Playwright, screenshots) and reports what was observed — the step after tests
pass and before /land. Also the launch recipe when you just want the app run or
screenshotted. Forked, writes nothing in-repo (throwaway scripts live in the
scratchpad; a flow worth keeping becomes a real `e2e/` spec via /implement).

```
/verify                        ← observe the working-tree change end-to-end
run the app and screenshot the lobby
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

It will *propose* GAME_SPEC changes to you but never edit them — those are yours.

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

**Parallel sessions** (2–3 at once, e.g. via remote control):

- **One session = one branch = one worktree.** The main checkout belongs to
  whichever session is integrating (/land, /ship, /checkpoint on main); branch
  sessions never edit it.
- **Claims are read from main**, not your checkout — a worktree's BACKLOG.md
  copy predates claims made since you branched. /implement's claim gate does
  this (`git show main:…`).
- **e2e and /verify are serialized — one session at a time.** Playwright reuses
  whatever server holds :5173/:8000, so a parallel run silently tests the
  *other* worktree's code and passes anyway. Branch sessions run targeted tests
  only; the full suite runs once, at /land (forked, so its output stays out of
  your context).
- **Start narrow, end early** (token budget): open with "continue P38 per
  HANDOFF" rather than "what's next?" so the session reads its HANDOFF section
  instead of re-exploring the repo, and /checkpoint + close as soon as its
  milestone is done — an idle open session just accretes context.
- **One /checkpoint at a time**: HANDOFF is a single file; simultaneous writers
  clobber each other (last one wins).

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
| *(nothing — scratchpad scripts only)* | /verify | — |
| `GAME_SPEC.md`, `docs/dev_notes/` | **you** (human-only) | — |
