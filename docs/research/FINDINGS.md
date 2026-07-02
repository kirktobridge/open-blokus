# Findings

Curated, presentation-ready takeaways from OpenBlokus research. Each finding is a
durable claim backed by logged evidence — the "so what," lifted out of the raw run
tables. Raw records live in [log/](log/); method + stats discipline in
[FRAMEWORK.md](FRAMEWORK.md); open threads in [backlog/](backlog/).

**How to read a finding:** claim → evidence (with run link + sample size) →
confidence. Confidence is `replicated` (multiple seeds/runs agree), `significant`
(single well-powered run, CI clear), or `directional` (small sample, treat as a
hint). Retracted claims are kept struck-through — the retraction *is* the lesson.

---

## AI strategy

### F1 — Positional heuristic ≫ greedy-size ≫ random
`replicated`. The shipped weighted eval (`size·10 + frontier·3 + center·1 +
block·2`) beats size-greedy ~88% game-share and random ~100%, stable across seeds
(Runs A, C). Positional play beats raw size decisively when the positional term is
kept separate and size-dominant. See F5 for why cchung89 found the opposite.

### F2 — `frontier` (own-mobility) is the load-bearing term
`replicated`. Ablating it collapses the bot to 15.5% — far outside any error band
(Run C). `block` is a mild real win (~4 pts, within ±std); `center` ≈ noise (`full`
and `no-center` overlap completely — likely because it's averaged over the whole
game, not just the opening). Weight `frontier: 3` stays; only `f=10` is clearly
worse (overweighting position starves the size term). Corroborated by F3.

### F3 — Own-mobility is essential to any leaf eval, too
`significant`. In the depth-1 eval sweeps (Run E), `mobility=0` collapses the eval
to 29% while `mobility=0.5` reaches ~55%. Independent confirmation of F2 from a
different code path: whatever the bot optimizes, keeping its own future options
open is the dominant signal.

### F4 — The hand-crafted heuristic hit a structural ceiling
`significant`. Depth-2 alpha-beta (Run D), a weight-tuned depth-1 eval (Run E), and
an *unconfounded* pure eval (Run F, beam=all) all land 47–55% vs the heuristic —
statistically indistinguishable, at up to ~100× the cost. Voronoi territory control
(Run G) was neutral-to-harmful at every weight. Root cause: the alpha-beta beam is
ordered *by the heuristic*, so search can only re-rank the heuristic's top-K and
can't diverge far by construction. Run F is the clincher — removing that confound
did **not** surface a better eval. With the current features (size, frontier,
block, center), reweighting and deeper search are **played out**.

### F5 — Why we beat the heuristic where cchung89's "advanced" bot lost to greedy
`directional` (comparison, not a controlled rerun). cchung89 reported *simple
greedy beat their advanced (size + corner-diff) greedy*; we find positional play
wins. Likely because their corner term was blended into one metric, possibly
miscounted (ignoring the ortho-adjacency rule) and/or overweighted vs size, and
judged only against random (which compresses the gap between two strong bots). We
keep terms separate, size-dominant, and measure head-to-head with seed-averaging.
Our own `f=10` result is direct evidence that overweighting the positional term
hurts — the trap that probably bit their advanced bot.

### F6 — MCTS breaks the ceiling and scales with compute; rollout *quality* is the lever
`significant`. Maxn UCT MCTS with per-color reward vectors (fixes the paranoid
mismatch) is the first strategy to genuinely beat the heuristic: `it=80/d=8` →
54.6% game-share, p = 0.0007 over 1,200 games (Run H). Unlike the F4 plateau,
strength scales monotonically with budget, and with **full rollouts** (`d=0`) it
climbs to 90% by `it=320` (Run I), decelerating toward a mid-90s ceiling. The
dominant factor is rollout depth, not iteration count: at a fixed tiny `it=40`,
truncated rollouts *lose* (39%) while full rollouts *win big* (68%) — a 29-point
swing. The placed-leader reward is exact at a terminal state but a weak proxy at a
mid-rollout cutoff. **Practical takeaway: always full rollouts; spend the move-time
budget on iterations.** Cost is ~100–1000× the heuristic, so this is a
budget-capped "hard" bot, not a drop-in.

---

## Engine

### F7 — Anchor-restricted move generation is ~16× faster, exact
`significant`. Every legal placement (post-first-move) must cover an empty cell
diagonally adjacent to the color's own pieces, so `generateLegalMoves`/`hasAnyMove`
test only positions anchored to that small frontier set instead of all 400 cells.
Output is byte-identical to the full scan (differential test in
[tests/moves-opt.test.ts](../../tests/moves-opt.test.ts)); throughput went 47 →
766 calls/s mid-game — i.e. ~16× more MCTS iterations per time budget at no
accuracy cost. Details in [log/ai-strategy.md](log/ai-strategy.md) (Engine note).

---

## Method lessons (the ones we paid for)

These are process findings — how we now *know* things. Enforced going forward by
[FRAMEWORK.md](FRAMEWORK.md).

### M1 — Single-seed tables lie; seed-average before believing
Run A's "`frontier=6 > frontier=3`" did **not** replicate across seeds 99/7 (Run
B). ~~frontier=6 is a win~~ — retracted. This bit us again in D (d1 vs d2), E (the
60% peak), and F (a 0.61 smoke). Every apparent breakout at n < ~200 shrank toward
noise under proper sampling. Default to seed-averaging + reporting mean ± std.

### M2 — Well-powered wins survive; small-sample wins evaporate
The MCTS edge is the counter-case that proves the rule: a 30-game 60% looked
inflated (real edge ~5 pts at that budget), but the 1,200-game rerun held at 54.6%
with a CI clear of 50. Skepticism vindicated *and* the real signal confirmed —
because we powered the run. Use Wilson CIs + a one-sided z-test vs 50/50, not eyeballed percentages.

### M3 — Beware confounds baked into the harness
The F4 plateau looked like "no better eval exists" but was partly the
heuristic-ordered beam constraining search. We only trusted the conclusion after
Run F removed the confound (beam=all) and *still* saw no gain. When a result is
suspiciously flat, ask what the harness is holding fixed.
