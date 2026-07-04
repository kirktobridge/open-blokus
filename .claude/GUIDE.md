# Skill framework — quick guide

Four skills, one loop: **triage** an idea in → **research** or build it → **ship**
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

### /ship — "it's built, sync the docs"
Minimal doc updates when something ships: flip the product-backlog status, tick
BUILD_ORDER, touch up ARCHITECTURE's *why*. Owns those three files only.

```
/ship                          ← figure out what shipped from git
we shipped P10, update docs
mark P5 partial — tray finish landed
```

It will *propose* GAME_SPEC or CLAUDE.md changes to you but never edit them —
those are yours.

### /checkpoint — "wrap up the session"
End-of-session closeout: checks nothing is dangling (statuses honest, tree
clean), makes tidy commits, writes `.claude/HANDOFF.md` so next session starts
in seconds.

```
/checkpoint
wrap up
```

## Typical days

**Research idea → answered:**
```
/triage <idea>  →  /research run AE#  →  /research record  →  /research findings  →  /checkpoint
```

**Product/UI idea → shipped:**
```
/triage <idea>  →  (plan + build + npm test)  →  /ship  →  /checkpoint
```

**Starting a fresh session:**
```
read .claude/HANDOFF.md   (or just: "what's next?")
```

## Who writes what (the single-writer map)

| File | Only writer |
|---|---|
| `docs/research/` (backlog, log, FINDINGS) | /research |
| `docs/product/BACKLOG.md`, `BUILD_ORDER.md`, `ARCHITECTURE.md` | /ship |
| `.claude/HANDOFF.md` | /checkpoint |
| `GAME_SPEC.md`, `CLAUDE.md`, `docs/dev_notes/` | **you** (human-only) |
