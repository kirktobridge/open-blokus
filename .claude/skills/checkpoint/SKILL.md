---
name: checkpoint
description: Session-end closeout — verify no dangling state (backlog statuses match reality, working tree clean, no orphan scripts), make the checkpoint commits, and write .claude/HANDOFF.md so the next session resumes cheaply. Use for "wrap up", "end session", "checkpoint", "close out", or /checkpoint.
---

# Checkpoint — session closeout & handoff

A session may end only when: (a) every backlog `Status:` matches reality, (b) the
working tree is clean, (c) `HANDOFF.md` says what's next. This skill enforces that.
It is the **sole writer of `.claude/HANDOFF.md`** (local-only — `.claude/` is
gitignored by design; HANDOFF is session state, not project history).

## Checks (fix or surface each hit — don't silently pass)
1. `git status --short` — uncommitted changes? Group them into checkpoint commits
   (below). Untracked files under `scripts/` or `src/` are a red flag: either commit
   them with their feature/run or ask.
2. `grep -n "Status:" docs/research/backlog/*.md | grep -i active` — any `active`
   entry must have a matching run in `log/` (check via
   `grep "^### Run" docs/research/log/*.md | tail`). Dangling → tell the user the
   loop is open; /research closes it, not this skill.
3. `grep -n "Status:" docs/product/BACKLOG.md | grep -i in-progress` — anything
   in-progress that actually shipped this session should have gone through /ship;
   run it now if missed.

## Checkpoint commits (tied to completions, never time)
One commit per completed unit, code and docs separate:

| Completed unit | Commit shape |
|---|---|
| implementation + tests green | `feat:` / `fix:` / `perf:` |
| a /research record + close | `research(<ID>): <question> — <decision>` (log + FINDINGS + status + `scripts/experiments/` config together) |
| a /ship doc sync | `docs: ...` |

Don't bundle unrelated units; don't commit with failing tests without saying so in
the message and to the user.

## HANDOFF.md (overwrite each session — it's a baton, not a log)
Write `.claude/HANDOFF.md`, exactly this shape, a few lines each:

```markdown
# Handoff — <date>
- **Changed:** <what landed this session, with commit shas>
- **In flight:** <open loops: active experiments, half-done features, failing tests + why>
- **Next:** <the single most likely next action, with its backlog ID>
```

**Next session's entry path:** read HANDOFF.md, then orient with the Phase-0 grep
from /research — not by re-reading the tree.

## Not this skill
- Closing a research loop → **/research**. Doc sync → **/ship**. This skill only
  verifies they ran, commits, and writes the baton.
