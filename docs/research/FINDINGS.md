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
budget on iterations.** (The it→strength curve here is per-iteration and
engine-invariant, but iteration counts per *time* budget are up ~2.5× since AE9
bitboards — see AE27.) Cost is ~100–1000× the heuristic, so this is a
budget-capped "hard" bot, not a drop-in.

### F14 — Absolute strength: our best bot ≈ Pentobi level 1–2 (the first external anchor)
`significant`. Bridged our arena to `pentobi-gtp` (the calibrated open-source
reference) over GTP and placed our tiers on Pentobi's 1–9 ladder in 4p Classic 2v2,
game-share vs a 50% null (Run R, AE19). **Our shipped easy tier (heuristic) is
CI-clear below even L1** (21.2% game-share, CI [16.5,26.9], n=240), decaying
monotonically to ~0% by L4. **Our strongest tier (extreme, 500-iter MCTS) beats L1
CI-clear** (61.8%, CI [54.9,68.2], n=200) and is ~even with L2 (45.3%, CI
[35.9,55.1], n=100, directional). So the ceiling of everything we ship is roughly
**one calibrated Pentobi level (≈ L1–L2)** — a sobering absolute number after a
research history of self-relative wins, and the reason AE19 exists. The 150→500-iter
jump (43%→62% vs L1) re-confirms F6 (MCTS scales with compute). Bridge is the
standing external readout: `npm run arena:pentobi`, replay-verified against our rules
core every game. Method note (M): CPU contention is safe to oversubscribe here
because both our fixed-iteration tiers and Pentobi's simulation-based levels are
strength-invariant to wall-clock — only run-time changes.

### F15 — Light rank-normalized reward shaping wins placement for free; heavy over-trades
`significant`. The winner-take-all placed-leader reward left a real gradient on the
table between 2nd and 4th. Blending Pentobi's ties-averaged rank-normalized term into
it — reward `(1−w)·winner + w·rankNorm`, `rankNorm = (beaten+(tied−1)/2)/(n−1)` over
placed squares — improves a losing bot's final standing **at no cost to wins, at the
right weight** (Run S, AE15, n=600 head-to-head + n=648 pooled game-share). At
**w=0.25**: placement −0.24 (CI [−0.35,−0.13]), placed squares +1.3 (CI [+0.64,+1.96]),
game-share 53.2% (CI [49.4,57.1] — clears the 48% guard, leans >50%). At **w=0.5** the
placement gain persists but game-share CI sinks to 45.4%, under the floor — score-greed
starts fighting win-seeking, the exact M4 conflict AE15 pre-registered. Shipping value
is **w=0.25**; default `rankRewardWeight` stays 0 (byte-identical, F13/AE18 golden
intact). Twofold payoff: better lost-position behaviour for players, and a
non-degenerate value signal for the advisor (AD2/AD3) where winner-take-all reads a
flat 0. Per P13 this is a lost-position lever (not a ceiling lever) → retune tiers
in place, not a new rung.

### F16 — Rollout *width* beats rollout *smarts*: scoring playout candidates buys nothing
`significant` (rejection) / `directional` (the width lever). F6 named rollout quality
as the strength lever, so AE11 tried to make each playout move smarter: rank the
rejection-sampled candidates by the full heuristic (size + frontier + center + block)
instead of by size alone, greedily (`score`) or Boltzmann-sampled (`softmax`,
Pentobi's gamma-sampled playout in spirit). **Neither buys anything** at matched
wall-clock: 48.8% (CI [44.9,52.8]) and 49.3% (CI [45.3,53.3]) game-share over n=600
each (Run T). The signal that *did* move was the control arm — same size-greedy rule,
candidate pool 6→12: **54.4% (CI [50.4,58.3], p=0.016)**, plus better placement (2.41
vs 2.59) and placed squares (73.1 vs 71.6). Under the pre-registered 52% bar, so AE11
closes `no-win` and the width lever moves to AE26 with its own bar.

Two things worth carrying forward. **(1) Smarter playouts are not slower here.** A
playout that plays bigger pieces reaches terminal in fewer plies, and at `rolloutDepth
0` that shortening pays for the extra scoring — `score`/`softmax` cost ~1% throughput,
and 12-sample size-greedy is *1.23× faster* than 6-sample. The usual "policy cost eats
the quality gain" tradeoff does not bind. **(2) The lever is the max, not the ranking.**
Sampling more candidates and taking the largest raises the *size* of the piece played;
re-ranking the same 6 candidates by a richer score does not. This is consistent with
F2 (frontier is load-bearing) only in the tree, not in the playout: inside a rollout,
positional terms appear to be noise the terminal reward washes out, while piece size
compounds directly into the placed-leader signal. A rollout policy should be judged by
what it does to the *reward's* variance, not by how well it plays.

### F17 — Wider rollout sampling wins at matched wall-clock, but the win is mostly the *iterations* it buys, not the width
Confidence: `significant` (matched-clock win) / `replicated` decomposition (three
same-iteration contrasts agree). F16 left the width lever (`rolloutSamples`) open;
AE26 swept {12,24,48} vs the shipped 6 at matched wall-clock, each arm at its benched
iteration budget (12→57, 24→65, 48→65 vs base 48), n=600 each (Run U). Strength is
**monotone increasing in width** over [6,48] — `s24` 62.6% (CI [58.6,66.3]) and `s48`
64.9% (CI [61.0,68.7]) both clear the pre-registered 52% bar decisively; no interior
optimum, still climbing at 48. Placement and placed-squares track game-share.

The mechanism is the surprise. A same-samples iteration-only control (6@57 vs 6@48)
scores **58.0%** — the +9-iter bump *alone* buys +8 pts. Holding iterations fixed to
isolate width: **6→12 at 57 it is −2.3 pts** (the 12-arm underperforms the pure-iter
control — so Run T's/F16's "54.4% from width" was really the iterations), while
**24→48 at 65 it is +2.3 pts** (same baseline and iters, so a genuine but small width
term at the high end). So width's value is almost entirely that bigger pieces shorten
playouts and buy iterations — and that speedup **saturates at ~24 samples** (bench:
24 and 48 are both 1.35× / 65 it), beyond which only a small direct width effect
remains. Practically: under the shipped **time-budget** tiers, widening `rolloutSamples`
toward 24 captures the iteration gain for free (more sims at fixed time); 48 is the
best measured but adds only the ~2-pt width term at higher late-game rejection cost
(the `fallbackMove`-exhaustion risk was not instrumented — an open caveat). Ties back
to F6 (rollout *quality* is the lever) with a sharpened reading: here "quality" cashes
out as playout *length* → simulation *count*, not per-move cleverage.

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
[AE10 + AE5](backlog/ai-engine.md). (Beams + the iters-per-time-budget counts here
were measured pre-AE9 bitboards; timed tiers now complete ~2.5× the iterations per
budget — see AE27.)

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

### F11 — A small learned value net can't replace full rollouts, even at 15–100× the iterations
`significant` (600 games, 8 shards agree, Run O). A 609-param value net trained on
697k self-play positions **passes its offline gate** — it out-predicts the shipped
static eval as a mid-game winner predictor (42.9% vs 39.1% held-out, discordant
pairs 57.9% [56.8, 59.0]) — yet as an MCTS **leaf eval replacing rollouts** it
loses **27.6% [24.2, 31.3]** game-share vs full-rollout MCTS at matched 500 ms/move,
despite completing 15–100× more iterations (rootN 340–1,593 vs 15–46). The lesson
pairs with F6: strength lives in the *quality* of the leaf estimate, and a terminal
rollout outcome carries far more signal than a cheap static approximation — more
tree does not buy back a worse leaf. "Beats the heuristic as a predictor" is a much
lower bar than "matches a rollout as a value". Infra kept at zero cost: `leafValue`
injection in `mcts.ts` (default off), self-play dump + trainer scripts. Revisit only
with step-change capacity (board-plane input, policy head, MCTS-quality labels) —
and after AE9 raises the rollout baseline. Run O; closed
[AE4](backlog/ai-engine.md) as no-win.

### F12 — Bitboard legality is ~2.5× faster than the cell-by-cell scan, byte-identical, and that throughput converts to strength
`significant` (differential test + 640-game arena, Run P). Storing the 20×20 board
as one 20-bit word per row and testing GAME_SPEC §4 with masked lookups (global
occupancy + per-color own cells + lazily-cached orthogonal/diagonal dilations)
replaces the per-cell neighbor scan that F10 fingered as ~75% of MCTS time. It is
**byte-identical** to `isLegalPlacement` (>100k candidates over 48 positions + the
incremental rollout path; all deterministic search tests unchanged) and **2.48×
faster** (997 vs 402 iters/s, mid-opening, matched engine config). Because output
is identical at fixed iterations, per-iteration strength is unchanged, so "matched
wall-clock" = a 2.5× iteration head-to-head: the faster engine wins **71.4% [67.8,
74.8]** game-share over 640 games (z = +10.8). Confirms the F10 diagnosis and, from
the throughput side, F6/F8 (more search buys strength). The big lever was killing
per-cell allocation (~40 short-lived objects per pentomino test) and amortizing the
dilations across candidates, not exotic bit-tricks. Bitboard legality now backs
`generateLegalMoves`/`hasAnyMove` and the MCTS rollouts; `isLegalPlacement` stays as
the bgio/UI path and reference. This raises the standing rollout baseline for every
future speed/quality experiment. Run P; closed [AE9](backlog/ai-engine.md) as won.

### F13 — Research-harness throughput: dump sharding is 4.6×, the arena-driver win was eaten by AE9
`significant` (byte-identical diffs + timed runs, Run Q). Two byte-identical tooling
speedups: (1) `selfplay-dump --jobs=N` shards per-game-seeded games across processes
and concatenates in order → **4.6×** on 8 cores (200 games 17.0→3.7 s), verified
`diff`-identical to single-process — this is the win that matters, cutting every
future self-play dump's cost. (2) Replacing the arena driver's per-move
`recomputeStuck` (`hasAnyMove` ×4) with lazy stuck-on-null detection is only **1.12×**
now, because AE9 (F12) already made `hasAnyMove` ~2.5× cheaper so the eliminated
scans mostly short-circuit — a **sequencing lesson**: a speedup's value is contingent
on what already landed; AE9 subsumed most of this one, exactly as the entry's cost
note predicted. Deferred the trainer feature-cache sub-item with the value-net path
(F11 dormant). Guardrails: golden wins/ties test locks the driver's byte-identity
(the tournament rng is shared across games, so any stray draw cascades). Run Q;
closed [AE18](backlog/ai-engine.md) as won (live subset).

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

### M5 — Anchor a new track externally before self-relative runs accumulate
Runs A–Q were all self-relative; only Run R (the Pentobi bridge, F14) revealed that
everything we ship tops out around Pentobi L1–L2 — a sobering absolute number after
a research history of self-relative wins, and one that immediately redirected effort
(per-simulation quality, AE24) better than any incumbent-relative result had. The
anchor was buildable from day one; we just didn't prioritize it. So: a new research
track names its outside-world readout *first* — Pentobi for strength, a
human-judgement benchmark for the advisor — and if no readout exists, building one
is the track's first entry, not a footnote. Enforced at /triage (classification) and
/research Phase P (entry gate).
