# Backlog — advisor research questions (evaluation & analysis)

The **research** prerequisites for the advisor: can we compute a *trustworthy*
position score, win-probability, and blunder signal? These are measurable questions
(validated on logged games), structured per [../FRAMEWORK.md](../FRAMEWORK.md).

The **product** side — recap UI, mid-game overlay, tutorial, and the game-logging
foundation — lives in the [product backlog](../../product/BACKLOG.md) (Advisor epic, P1–P4). Split
rule: research answers "is the signal accurate?"; the roadmap ships "how it's shown."
Each roadmap feature depends on the matching question here.

Raw seeds: [../../dev_notes/OPEN_IDEAS.md](../../dev_notes/OPEN_IDEAS.md) (unmaintained).
Only **human-game** validation is blocked on game logging — roadmap
[P1](../../product/BACKLOG.md#p1--game-logging-foundation-infra). First-pass validation
can start now on **arena/self-play logs** (the Run O pipeline generated 697k positions),
with the human-play distribution re-checked once P1 lands.

---

### AD2 — Position evaluator ("how am I doing right now?")
- **Status:** proposed (arena-log validation unblocked; human-game validation waits on P1)
- **Objective:** score the current game state from a color's perspective.
- **Hypothesis:** the same intelligence the bot uses (heuristic, MCTS, **or the F11
  value net**) can be surfaced as a state-of-game readout without a new model.
- **Method:** expose the existing eval as a per-color score; validate that its
  ranking tracks eventual game outcomes on logged games. **Candidate order:** start
  with the F11 net — it already passed exactly this gate (out-predicts the static
  eval as a mid-game winner predictor, 42.9% vs 39.1% held-out, Run O); its no-win
  was as an MCTS *leaf eval*, a different job. Compare against heuristic + MCTS
  rollout stats as baselines.
- **Success criteria:** evaluator score correlates with final placement/win on held-out
  logged games.
- **Cost / risk:** low-moderate; largely reuses existing eval + logged data + the
  kept F11 infra (self-play dump, trainer, `leafValue` injection).
- **Ships as:** part of backlog P2/P3.

### AD3 — Win probability
- **Status:** proposed (arena-log validation unblocked; human-game calibration waits
  on P1, AD2)
- **Objective:** turn a position into a calibrated win-probability per color.
- **Hypothesis:** MCTS rollout outcomes and/or a value model over logged games yield
  a probability that is *calibrated*, not just correctly ordered. (The shipped
  `mctsSearch` already accumulates a per-color reward vector = rollout win-rate — a
  ready signal source; the F11 net's sigmoid output is a second candidate, already
  a validated winner *predictor* on Run O data.)
- **Method:** derive win-prob from rollout win-rates or a trained value head; measure
  calibration (reliability curve) on logged games.
- **Success criteria:** calibrated within tolerance across game phases.
- **Cost / risk:** moderate; depends on logged-data volume and AD2.
- **Ships as:** part of backlog P3.

### AD4 — Blunder / key-moment signal detection
- **Status:** proposed (blocked on P1 logging, AD2). **Zero engine work needed:** the
  existing `mctsSearch` root's children already carry per-color visit/reward stats,
  so best-move gap = played move's Q vs best child's Q straight off the returned tree.
  Payoff doubled: besides P2 (recap), this signal now also gates product **P14 M2**
  (daily-puzzle move grading).
- **Objective:** identify turn-level "good plays," blunders, and key swings in a
  finished game — the *signal*, not the presentation.
- **Hypothesis:** running the strongest available intelligence (MCTS) over each logged
  position and diffing its preferred move / eval-swing against what was played
  surfaces the same key moments a strong observer would flag.
- **Method:** for each logged turn, compute eval-swing + MCTS best-move gap; threshold
  into event types. Validate against human judgement. Interest: games where humans beat
  the AI.
- **Success criteria:** flagged moments match human judgement on a sample of games.
- **Cost / risk:** moderate; MCTS-over-log is compute-heavy but offline.
- **Ships as:** backlog P2 (recap) turns this signal into messages + UI.
