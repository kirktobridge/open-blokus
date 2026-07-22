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

## Track anchor (M5)

The outside-world readout this track validates against, named before any self-relative
advisor number is trusted: **final outcomes of logged games** — arena/self-play logs
now (Run O's 697k positions), with the human-game distribution re-checked once P1 data
accrues. AD2/AD3 are scored by whether their score / win-probability tracks those
held-out outcomes. AD4 adds a second, non-outcome anchor: a **blinded human-judgement
sample** (~20–30 flagged + unflagged moments, judged without seeing the model's
labels), because "matches a strong observer" doesn't reduce to game outcome. No
advisor claim ships on a self-relative number alone (M5).

---

## Next up

The dependency-ready head, highest-payoff first — the authoritative "what to run next."
Refreshed by /research at close (Phase 4) and intake (Phase P); product P22. The schema
test (product P21) fails CI if any ID here is missing or terminal.

1. **AD2** — position evaluator: arena-log validation unblocked; gates AD3 + AD4.
2. **AD4** — blunder / key-moment signal: P1 logging shipped, but still waits on AD2 — *blocked*.
3. **AD3** — win probability: waits on AD2 — *blocked*.

---

### AD2 — Position evaluator ("how am I doing right now?")
- **Drafted:** 2026-07-02
- **Status:** proposed (arena-log validation unblocked; human-game validation waits on P1)
- **Variant:** classic — the Run O validation corpus (697k positions) is Classic 4p
  self-play, and the F15 rank term this leans on is algebraically void at two colors
  (AE31). A Duo evaluator needs its own corpus and its own value signal.
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
- **Power:** held-out sample = a split of the Run O self-play corpus (697k logged positions), sized by the target correlation CI width; --power n/a (not a binomial game-share bar).
- **Cost / risk:** low-moderate; largely reuses existing eval + logged data + the
  kept F11 infra (self-play dump, trainer, `leafValue` injection).
- **Ships as:** part of backlog P2/P3.

### AD3 — Win probability
- **Drafted:** 2026-07-02
- **Status:** proposed (arena-log validation unblocked; human-game calibration waits
  on P1, AD2)
- **Variant:** classic — calibration rides on AD2's Classic evaluator and a Classic
  outcome corpus; win-probability does not transfer across variants unmeasured.
- **Objective:** turn a position into a calibrated win-probability per color.
- **Hypothesis:** MCTS rollout outcomes and/or a value model over logged games yield
  a probability that is *calibrated*, not just correctly ordered. (The shipped
  `mctsSearch` already accumulates a per-color reward vector = rollout win-rate — a
  ready signal source; the F11 net's sigmoid output is a second candidate, already
  a validated winner *predictor* on Run O data.)
- **Method:** derive win-prob from rollout win-rates or a trained value head; measure
  calibration (reliability curve) on logged games.
- **Success criteria:** calibrated within tolerance across game phases.
- **Power:** held-out sample = logged-game outcomes (Run O corpus split now, P1 human games later), sized by per-phase reliability-bin counts; --power n/a (not a binomial game-share bar).
- **Cost / risk:** moderate; depends on logged-data volume and AD2.
- **Ships as:** part of backlog P3.

### AD4 — Blunder / key-moment signal detection
- **Drafted:** 2026-07-02
- **Status:** proposed (blocked on P1 logging, AD2). **Zero engine work needed:** the
  existing `mctsSearch` root's children already carry per-color visit/reward stats,
  so best-move gap = played move's Q vs best child's Q straight off the returned tree.
  Payoff doubled: besides P2 (recap), this signal now also gates product **P14 M2**
  (daily-puzzle move grading).
- **Variant:** classic — blunder/swing thresholds are tuned against Classic score
  magnitudes; Duo's 14×14 swings are a different scale.
- **Objective:** identify turn-level "good plays," blunders, and key swings in a
  finished game — the *signal*, not the presentation.
- **Hypothesis:** running the strongest available intelligence (MCTS) over each logged
  position and diffing its preferred move / eval-swing against what was played
  surfaces the same key moments a strong observer would flag.
- **Method:** for each logged turn, compute eval-swing + MCTS best-move gap; threshold
  into event types. Validate against a **blinded human-judgement benchmark built as
  part of this entry**: sample ~20–30 flagged + unflagged moments across a handful of
  games, have a human label each (good / blunder / key-swing) *without seeing the
  detector's output*, then score detector↔human agreement. Building that sample is a
  deliverable of AD4, not a footnote. Interest: games where humans beat the AI.
- **Success criteria:** flagged moments match human judgement on a sample of games.
- **Power:** held-out sample = the blinded human-judgement benchmark built in Method (~20–30 flagged/unflagged moments), sized by that sample's label-agreement CI; --power n/a (not a binomial game-share bar).
- **Cost / risk:** moderate; MCTS-over-log is compute-heavy but offline.
- **Ships as:** backlog P2 (recap) turns this signal into messages + UI.
