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

### F8 — MCTS `beam` must scale with the iteration budget; a fixed wide beam breaks the low tier
`significant`. Time budgets deliver *few* iterations (Leg B: 500 ms ≈ 30/move, and
only ~17 early-game where branching is highest; 2000 ms ≈ 139). At the shipped
default `beam=16`, the ~30-iteration medium tier spreads ~2 rollouts over 16
children, so the most-visited pick is noise — **medium *loses* to the heuristic**
(31.4 % game-share, [24.7, 38.9], n=160) despite being the "harder" tier. Narrowing
the beam recovers it monotonically: `beam 12→51 %, 8→64 %, 6→66 %, 4→70 %`. The
lever is the **beam:iterations ratio** (~5 rollouts/child; rule `beam ≈ iters/6`,
matching the winning it40/beam8 of F6), not the time budget — which is why hard
(139 iters / beam 16 ≈ 9 per child) is fine (77.8 % vs heuristic) and beats medium
90.5 %. **Fix (shipped):** per-tier beam (medium → 6, hard → 16); no latency change
(both budgets' p95 move-time already clear the 2.5 s cap). **Confirmed under real
time budgets** (Run J-confirm): medium 67 % vs easy (was 31 % at beam 16), hard
63 % vs medium — a monotonic, significant ladder. Runs J / J-confirm; resolved
[AE10 + AE5](backlog/ai-engine.md).

### F9 — RAVE / AMAF value sharing does not buy strength in Blokus MCTS
`replicated` (no-win). At **matched iterations** (150 iters, beam 16, rolloutDepth 12),
RAVE vs plain UCT pooled to **54.0 % game-share, CI [49.1, 58.8], n=400** (Runs L+M,
two independent seed batches) — the pre-registered "CI clear of 50 %" bar is **not
met**; the second batch regressed to 52 %, so the first batch's 56 % was mostly noise.
Even the small nominal edge is illusory as a *shipping* case: at matched **wall-clock**
RAVE fares worse, paying AMAF tracking + sibling-backprop overhead per iteration for no
iteration-efficiency gain. Two likely reasons AMAF underperforms here: (1) the
heuristic beam already supplies the early-search prior RAVE exists to add, and (2)
Blokus placements rarely recur across lines and a move's value is strongly
position-dependent, so the "all-moves-as-first" assumption carries little signal. Code
kept behind `rave:false` (default, zero-cost) for a possible revisit at other budgets.
Run L/M; closed [AE3](backlog/ai-engine.md) as no-win.

### F10 — MCTS is legality-bound, not eval- or tree-bound: ~75% of time is cell-by-cell legality/gen
`significant` (single well-controlled CPU profile, Run N). On a peak-branching
mid-opening position (541 legal moves), a 150-iter search spends **rollout 46 % /
move-gen 19.5 % / tree+backprop 0.7 %**; by leaf function `isLegalPlacement` is 31 %
and, folding in its per-cell primitives (`inBounds`, `get`, `idx`, `isSameColor`),
**~75 % of all time is legality-testing + move generation done cell-by-cell**. Two
consequences: (1) it explains F9 — RAVE tweaks the 0.7 % tree layer, so it *couldn't*
matter; (2) it picks the next lever — a **bitboard** representation (occupied /
adjacency / corner masks) collapses the per-cell primitives into mask ops and speeds
*both* rollout and gen, unlike a learned eval (AE4), which only touches rollout
evaluation while our rollout cost is legality *sampling*. Points to [AE9](backlog/ai-engine.md)
as the next win. Run N.

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

### M4 — Fit-check an algorithm's core assumption against Blokus *before* backlogging it
RAVE (F9) cost two 132-min runs to reach a no-win we could have predicted: its
"all-moves-as-first" premise — a move's value is roughly order-independent — is
false for Blokus, where a placement is glued to exact board state (same piece one
turn later is often *illegal*). The tell was available a priori, for free. So before
an idea graduates idea → `proposed`, state the one assumption the technique needs
and ask whether our domain honours it. Cheap to fail on paper; expensive to fail in
the arena. (Assumption-free changes — bitboards, a learned eval — carry no such
risk and skip this gate.)
