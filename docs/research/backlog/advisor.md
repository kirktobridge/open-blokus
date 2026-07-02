# Backlog — advisor, evaluator & game analysis

Research-adjacent features that need an evidence/data foundation before they ship:
logging, position evaluation, win probability, and play-by-play analysis. Structured
per [../FRAMEWORK.md](../FRAMEWORK.md). Seeds for these come from the developer idea
dump in [../../dev_notes/OPEN_IDEAS.md](../../dev_notes/OPEN_IDEAS.md) (reference
only, unmaintained) — this file is the curated, research-framed version.

These are earlier-stage than the AI/engine backlog: several are *capability*
prerequisites, not yet crisp experiments. Objective/hypothesis are provisional until
the foundation (AD1) exists.

---

### AD1 — Game logging foundation
- **Status:** proposed (foundational — unblocks AD2–AD5 and AE4)
- **Objective:** capture move-by-move game data so analysis, advisory, and learned
  models become possible.
- **Hypothesis:** a structured per-move log (state, legal moves, chosen move, timing)
  is sufficient raw material for evaluator training, recap generation, and self-play
  datasets — without bespoke instrumentation per feature.
- **Method:** design a game-log schema + a system that manages it; decide the split
  between **app-logging** (debug/telemetry) and **game-logging** (analysis data);
  emit from the arena and from real matches.
- **Success criteria:** a logged game round-trips into an analyzable record; the
  arena can dump self-play datasets; schema stable enough that AD2/AE4 build on it.
- **Cost / risk:** moderate; a schema-design decision with long-lived consequences —
  get the app-vs-game logging boundary right early.

### AD2 — Position evaluator ("how am I doing right now?")
- **Status:** proposed (blocked on AD1)
- **Objective:** score the current game state from a color's perspective.
- **Hypothesis:** the same intelligence the bot uses (heuristic today, MCTS/value-net
  later) can be surfaced as a state-of-game readout without a separate model.
- **Method:** expose the existing eval as a per-color score; validate that its
  ranking tracks eventual game outcomes on logged games (AD1).
- **Success criteria:** evaluator score correlates with final placement/win on held-out
  logged games.
- **Cost / risk:** low-moderate; largely reuses existing eval + AD1 data.

### AD3 — Win probability
- **Status:** proposed (blocked on AD1, AD2)
- **Objective:** turn a position into a calibrated win-probability per color.
- **Hypothesis:** MCTS rollout outcomes and/or a value model over logged games yield
  a probability that is *calibrated*, not just correctly ordered.
- **Method:** derive win-prob from rollout win-rates or a trained value head; measure
  calibration (reliability curve) on logged games.
- **Success criteria:** calibrated within tolerance across game phases.
- **Cost / risk:** moderate; depends on AD1 data volume and AD2.

### AD4 — Post-game recap (play-by-play, blunders, key moments)
- **Status:** proposed (blocked on AD1, AD2)
- **Objective:** generate turn-level annotations — "good plays," "blunders," key
  swings — for a finished game.
- **Hypothesis:** running the strongest available intelligence (MCTS) over each logged
  position and diffing its preferred move / eval-swing against what was played
  surfaces the same key moments a strong observer would flag (e.g. "Turn 6: you closed
  your own corridor"). A local LLM could later narrate from that structured signal.
- **Method:** for each logged turn, compute eval-swing + MCTS best-move gap; threshold
  into event types; template plain-English messages. Shares assets with a future
  mid-game advisor. Special interest: games where humans beat the AI.
- **Success criteria:** flagged moments match human judgement on a sample of games;
  messages are accurate and legible.
- **Cost / risk:** moderate; MCTS-over-log is compute-heavy but offline.

### AD5 — Mid-game advisor overlay
- **Status:** deferred (until UI/style is finalized AND the evaluator is solid)
- **Objective:** in-game guidance — legal/optimal plays, heatmaps, priorities,
  candidate-move suggestions with reasons.
- **Hypothesis:** the AD2 evaluator + AD4 signals, surfaced live, help players without
  overwhelming them — best rolled out in stages.
- **Method:** staged milestones — R1 "show legal placements," R2 "suggest 2–3
  candidate moves with plain-English reasons," R3 "heatmaps / strategic priorities."
- **Success criteria:** per-milestone usability; suggestions demonstrably align with
  the evaluator.
- **Cost / risk:** high UI complexity — explicitly deferred on two blockers above.

### AD6 — Pre-game tutorial (interactive)
- **Status:** deferred (product feature, low research content)
- **Objective:** teach the four core ideas — corner-touch rule, no own-edge-touch,
  first move from your corner, preserving expansion lanes.
- **Hypothesis:** a short interactive walkthrough (place a legal piece → see an illegal
  edge-touch rejected → see multiple corner options → compare a "bad but legal" vs a
  "better for growth" move) onboards faster than text.
- **Method:** scripted 4-step interactive sequence; mostly UI, minimal research.
- **Success criteria:** N/A (product) — listed here to keep the advisor family together.
- **Cost / risk:** low research, moderate UI; not gated on logging.
