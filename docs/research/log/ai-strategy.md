# AI strategy experiments

Running log of CPU-strategy research: what we tried, how, and what we found.
The harness is the headless arena in [src/game/ai/arena.ts](../../../src/game/ai/arena.ts)
(`npm run arena [games] [seeds] [baseSeed]`, runner
[arena.cli.ts](../../../src/game/ai/arena.cli.ts)). Inspired by
[cchung89/Blokus_Game_Solver](https://github.com/cchung89/Blokus_Game_Solver).

This is a **research log, not a spec** — it records the *why* behind the bot's
tuning. The heuristic itself lives in
[src/game/ai/heuristic.ts](../../../src/game/ai/heuristic.ts); rules in
[GAME_SPEC](../../GAME_SPEC.md). Append new runs at the bottom; don't rewrite history.

> Synthesized conclusions, lessons, and the played-out/still-open map now live in
> [../FINDINGS.md](../FINDINGS.md). This file stays the append-only lab notebook
> (raw runs); FINDINGS is the curated takeaway layer.

## Method

- **Pure self-play.** The arena drives full games through the rules core (no
  React / boardgame.io), so it mirrors real turn order + auto-skip exactly.
- **Seeded.** `mulberry32(seed)` → every run is reproducible.
- **Bias control.** `runTournament` rotates which color each contestant occupies
  each game, cancelling first-move advantage. Wins credited by name; ties split
  evenly across co-winners.
- **Two readouts.** *per-seat win rate* (a name with 2 of 4 seats caps near 0.5)
  and *game-share* (`wins / games`, what fraction of games that name won).
- **Noise control.** `runTournamentSeeds` averages over N seeds and reports
  mean ± sample-std, because single-seed tables are noisy enough to mislead (we
  got bitten — see Run B).

### Strategies under test

| name | rule |
|------|------|
| `random` | uniform random legal move (cchung's baseline) |
| `greedy-size` | biggest piece, random tie-break (cchung's "simple greedy") |
| `heuristic` | shipped weighted eval: `size·10 + frontier·3 + center·1 + block·2` |
| weight variants | `heuristicStrategy(weights)` with one term changed (ablation / sweep) |
| `alphabeta-dN` | depth-N paranoid alpha-beta with beam pruning ([alphabeta.ts](../../../src/game/ai/alphabeta.ts)) |
| `mcts` | maxn UCT Monte-Carlo Tree Search ([mcts.ts](../../../src/game/ai/mcts.ts)) |

`size` = piece squares; `frontier` = new legal corner attach-points gained;
`center` = pull toward board center; `block` = our cells diagonal to an opponent.

## Trial count

≈ **6,250 games** across the nine documented runs below (4-player, basic
scoring): A–C ≈ 1,520 (heuristic tuning), D ≈ 100 (alpha-beta), E ≈ 850 (eval
sweeps), F ≈ 130 (beam-confound / pure eval), G ≈ 130 (territory feature),
H ≈ 2,450 (MCTS budget sweep), I ≈ 990 (MCTS full-rollout scaling). The CI suite ([tests/arena.test.ts](../../../tests/arena.test.ts),
[alphabeta.test.ts](../../../tests/alphabeta.test.ts)) also plays ~180 games every
`npm test` as a regression guard (heuristic + alpha-beta must beat random;
tournaments must be deterministic per seed).

## Runs

### Run A — first single-seed survey (seed 1, 100 games/table → 400 games)

| table | result |
|-------|--------|
| Baselines | heuristic **81%** · greedy-size 10/9% · random 0% |
| Heuristic vs greedy-size | heuristic **87%** game-share · greedy 13% |
| Weight ablation | full 33.8 > no-center 26.3 > no-block 24.3 > no-frontier 15.8 |
| Frontier sweep | f6 33.3 > f3 25.6 ≈ f1 25.1 > f10 16.1 |

First read suggested `frontier=6 > frontier=3` — flagged as a possible bump.

### Run B — frontier robustness check (seeds 99 & 7, 80 games → 160 games)

| seed | frontier sweep |
|------|----------------|
| 99 | f1 31.7 ≈ f3 31.5 > f6 24.2 > f10 12.7 |
| 7 | f1 35.0 > f3 23.8 > f6 21.3 ≈ f10 20.0 |

**The `frontier=6` win did NOT replicate.** Single-seed noise. Retracted the
bump. Only stable fact: `f=10` is consistently worst. → motivated seed-averaging.

### Run C — seed-averaged (6 seeds × 40 games/table → 960 games), mean ± std

| table | result |
|-------|--------|
| Baselines | heuristic **76.4% ±7.5** · greedy-size ~12% · random 0% |
| Heuristic vs greedy-size | heuristic **88%** game-share (±2.3) · greedy 12% |
| Weight ablation | full 29.9 ±5.9 ≈ no-center 29.0 ±4.5 > no-block 25.7 ±7.1 > no-frontier 15.5 ±4.3 |
| Frontier sweep | f3 29.5 ±7.0 ≈ f6 26.3 ±11.4 ≈ f1 22.9 ±7.1 > f10 21.3 ±5.0 |

### Run D — alpha-beta search vs the heuristic

Paranoid alpha-beta with beam pruning (top-`beam` moves by static heuristic per
node; I maximize my eval, the 3 opponents minimize it). Leaf eval = my
`placedSquares + 0.5·attachPoints` minus the opponents' mean.

**Depth isolation** (beam 8, seed 1, 8 games — tiny/noisy, directional only):

| depth | meaning | ab game-share | time |
|-------|---------|---------------|------|
| 1 | eval only, no lookahead | 0.25 | 6s |
| 2 | my move + 1 opp reply | 0.69 | 32s |
| 3 | + 1 more opp reply | 0.69 | 224s |

→ at this tiny sample d1 looked far weaker than d2. **Run E later showed the
0.25/0.69 split was mostly small-sample noise** — with proper sampling d1 and d2
both land ~50–55%. Treat this 8-game table as directional only.

**Proper benchmark** (depth 2, beam 8, 5 seeds × 16 games = 80, ~4s/game):

| strategy | win rate | game-share |
|----------|----------|------------|
| alphabeta-d2 | 26.4% ±3.7 | **53%** |
| heuristic | 23.6% ±3.7 | 47% |

**Depth-2 alpha-beta is ≈ parity with the tuned 1-ply heuristic** — a 53/47 edge
that sits inside the ±3.7 noise band — at **~100× the compute** (4s/game vs
near-instant). The d2=0.69 smoke was small-sample noise. Not a deployable win as
configured.

### Run E — chasing a better leaf eval (depth-1 eval-weight sweeps)

Run D pointed at the leaf eval as the ceiling, so we tuned it at **depth 1**
(pure greedy-by-eval, fast) vs the heuristic. Leaf eval =
`placed·placedWeight + attachPoints·mobilityWeight` minus opponents' mean.

Sweep 1 (4 seeds × 16 = 64 games):

| placed | mob | ab game-share |
|--------|-----|---------------|
| 1 | 0.5 | 55% |
| 1 | 0.25 | 48% |
| 1 | **0** | **29%** |
| 2 | 0.5 | 48% |
| 3 | 0.5 | 60% |
| 3 | 1 | 48% |

Refine around the peak (6 seeds × 20 = 120 games, tighter):

| placed | mob | ab game-share ±std |
|--------|-----|--------------------|
| 3 | 0.5 | 55% ±5.6 |
| 4 | 0.5 | 54% ±5.1 |
| 5 | 0.5 | 54% ±5.1 |
| 3 | 0.75 | 52% ±4.1 |

**Reads:**
- **Mobility is essential** to the eval — `mob=0` collapses to 29%. (Consistent
  with `frontier` being the load-bearing heuristic term.)
- `placed` weight **plateaus at ≥3**; the 60% at the small sample shrank to ~55%
  with more games (noise again — same lesson as Run B).
- Net: the tuned depth-1 eval reaches **~54–55% vs the heuristic — a slight edge
  inside ±5 noise**, i.e. ≈ the depth-2 result. Tuning the eval did *not* break
  out either.

**Structural ceiling found.** Every search/eval variant clusters at ~50–55% vs
the heuristic because **the AB beam is ordered by that same heuristic** — it can
only re-rank the heuristic's top-K, so it can't diverge far by construction.
That, not the eval magnitude, is why nothing pulls clear.

### Run F — breaking the beam confound

Run E argued every AB variant clustered near the heuristic because the beam was
heuristic-ordered. Run F removes that confound two ways.

- **Pure eval** — depth 1 with `beam = all moves`, so the root argmaxes the eval
  directly and heuristic ordering is irrelevant (`placed=3, mob=0.5`). 6×16 = 96
  games vs heuristic:

  | strategy | win rate | game-share |
  |----------|----------|------------|
  | heuristic | 26.7% ±6.4 | 53% |
  | pure-eval | 23.3% ±6.4 | **47%** |

- **Eval-ordered search** — depth 2, `ordering: 'eval'`. Smoke: 0.25 game-share
  and ~15s/game. Worse *and* impractical — eval-ordering misaligns with the
  paranoid objective (it ranks opponents by *their* eval, but the search wants
  them minimizing *ours*). Abandoned.

**The confound wasn't hiding a better eval.** Unconfounded, the eval is 47% —
slightly *below* the heuristic, within noise. (A small-sample smoke showed 0.61;
noise again — the recurring lesson of this log.)

### Run G — new feature: Voronoi territory control

Runs E/F said the remaining signal is in *new* features, not reweighting. First
candidate: **territory control** — a single 8-connected multi-source BFS from
every placed cell through empty space; each empty cell is claimed by the nearest
color (Chebyshev distance ≈ diagonal expansion), ties = contested/neutral. Added
to the eval as `territory · territoryWeight` (opt-in; `0` skips the BFS).

Tested as pure eval (depth-1, beam=all, `placed=3 mob=0.5`) vs heuristic:

| territoryWeight | ab game-share |
|-----------------|---------------|
| 0 (baseline) | 46% ±7.3 |
| 0.02 | 49% ±2.2 |
| 0.05 | 36% ±4.7 |
| 0.1 | 38% ±8.6 |
| 0.5 / 2 / 5 | 0.44 / 0.25 / 0.00 (8-game smoke) |

**No gain at any weight.** `0.02` is within noise of the baseline; everything
`≥0.05` monotonically *hurts* (the bot spreads thin to claim cells instead of
playing big pieces / good corners). The coarse nearest-piece partition adds noise,
not signal — the heuristic's `frontier` term already captures the useful space
signal. Feature kept in code (opt-in, default off) but **not adopted**.

### Run H — MCTS (the ceiling breaks)

Maxn UCT MCTS ([mcts.ts](../../../src/game/ai/mcts.ts)): per-color reward vectors so
each player maximizes its *own* outcome (fixes the paranoid mismatch from D/F);
heuristic-prior beam per node (plain MCTS can't try every root move at a feasible
budget); rejection-sampled rollouts (sample *one* legal move instead of
enumerating all — ~2.5× faster); reward = placed-square leader (exact winner
under basic scoring).

Sanity: MCTS beats `random` 1.00 (4 games). A first small run looked like `it=80,
d=8` won 60% over 30 games, but that was too few to call (95% CI [0.42, 0.78]).
So we ran a **2,400-game budget sweep** (70 shards across 12 cores), pooled into
proper binomial stats (game-share, Wilson 95% CI, one-sided z-test vs 50/50):

| config | games | mcts game-share | 95% CI | one-sided p |
|--------|-------|-----------------|--------|-------------|
| `it=40,  d=6`  | 400 | **39.3%** | [34.7, 44.2] | — (loses, z −4.3) |
| `it=80,  d=8`  | 1200 | **54.6%** | [51.8, 57.4] | 0.0007 |
| `it=160, d=10` | 400 | **60.7%** | [55.8, 65.4] | <1e-4 |
| `it=320, d=12` | 200 | **69.9%** | [63.2, 75.8] | <1e-4 |
| `it=80,  d=0` (full rollout) | 200 | **76.7%** | [70.3, 82.0] | <1e-4 |

**Three solid findings:**
1. **MCTS beats the heuristic, and it's significant** — `it=80/d=8` is 54.6%,
   CI clear of 50, p = 0.0007 over 1,200 games. The first strategy in D–H to
   genuinely win. (The 30-game 60% was small-sample inflation — the real edge at
   this budget is ~5 pts, not 10. Skepticism vindicated.)
2. **Strength scales monotonically with search budget** — 39 → 55 → 61 → 70% as
   iterations/depth rise. The opposite of the D–G plateau: here more compute keeps
   buying real strength. (Too little search, `it=40/d=6`, actually *loses* at 39%.)
3. **Rollout quality dominates.** `it=80/d=0` (rollouts to *terminal*) hits 76.7%
   — beating even the heaviest truncated config `it=320/d=12` at a quarter the
   iterations. The placed-leader reward is *exact* at a terminal state but a weak
   proxy at a mid-rollout cutoff, so full rollouts carry far more signal. Rollout
   depth, not raw iteration count, is the biggest lever.

Cost caveat: ~100–1000× the heuristic (`generateLegalMoves` is ~34 ms mid-game and
search needs thousands), so this is a "hard bot with a move-time budget", not a
drop-in. The `it=80/d=0` result says a strong-and-cheaper config is: fewer
iterations, full rollouts.

### Run I — full-rollout iteration scaling (how strong does MCTS get?)

Run H flagged full rollouts (`d=0`) as the biggest lever and the ladder hadn't
saturated, so we swept iterations at `d=0` — 990 games, same sharded harness,
pooled binomial stats vs heuristic:

| config | games | mcts game-share | 95% CI | Δ per doubling |
|--------|-------|-----------------|--------|----------------|
| `it=40,  d=0` | 300 | 67.6% | [62.1, 72.6] | — |
| `it=80,  d=0` | 300 | 77.4% | [72.3, 81.8] | +9.8 |
| `it=160, d=0` | 240 | 85.1% | [80.1, 89.1] | +7.7 |
| `it=320, d=0` | 150 | 90.1% | [84.3, 93.9] | +5.0 |

**MCTS goes from "wins" to "dominates."** Full-rollout MCTS climbs monotonically
to **90%** game-share by `it=320`, all p < 1e-4. It's still rising but the per-
doubling gain is shrinking (+9.8 → +7.7 → +5.0), so it's decelerating toward a
ceiling in the **mid-90s**, not saturated yet.

The starkest number in the whole log: at the *same* tiny `it=40` budget,
**truncated rollouts lose (39%, Run H `d=6`) while full rollouts win big (68%)** —
a 29-point swing from rollout depth alone. Rollout *quality* (playing to a
terminal state where the placed-leader reward is exact) is the dominant factor;
iterations then stack multiplicatively on top. Practical takeaway for a shipped
bot: **always full rollouts; spend the move-time budget on iterations.**

## Synthesis

Conclusions, the cchung89 comparison, and the played-out/still-open map moved to
[../FINDINGS.md](../FINDINGS.md) (findings F1–F6). Open threads are tracked as
structured entries in [../backlog/ai-engine.md](../backlog/ai-engine.md).

## Engine note — anchor-restricted move generation

`generateLegalMoves`/`hasAnyMove` no longer scan all 400 board cells. Every legal
placement (post-first-move) must cover an empty cell diagonally adjacent to the
color's own pieces, so we only test positions anchored to that small frontier
set. Output is byte-identical to the full scan (differential test in
[tests/moves-opt.test.ts](../../../tests/moves-opt.test.ts)); the bottleneck
`generateLegalMoves` got **~16× faster** (47 → 766 calls/s on mid-game positions),
i.e. ~16× more MCTS iterations per time budget at no accuracy cost.

## Run J — AE10 difficulty-budget assessment (Leg B + versus + beam sweep)

Assess/tune the shipped medium/hard time budgets ([AE10](../backlog/ai-engine.md)).
Two legs then head-to-heads. Iteration-equivalents from **Leg B** (instrumented
`mctsSearch(timeBudgetMs)`, iterations/move by phase, node):

| budget | iters p50 | early | mid | late | move ms (p50/p95) |
|--------|-----------|-------|-----|------|-------------------|
| 500 ms (medium) | 30 | ~17 | ~44 | ~166 | 510 / 534 |
| 2000 ms (hard) | 139 | ~66 | ~207 | ~892 | 2005 / 2028 |

Budgets are **strongly phase-dependent** — early game (most branching) gets the
*fewest* iterations. Latency bars **pass** (hard p95 = 2028 ms ≤ 2.5 s).

Head-to-head at the median iteration-equivalents (`it30`≈medium, `it140`≈hard),
full rollouts, **shipped beam=16**, pooled Wilson CI:

| matchup | A game-share | 95% CI | n | verdict |
|---------|--------------|--------|---|---------|
| medium(it30) vs easy(heuristic) | **31.4%** | [24.7, 38.9] | 160 | **medium LOSES to easy** |
| hard(it140) vs medium(it30) | 90.5% | [83.2, 94.8] | 100 | hard ≫ medium |
| hard(it140) vs easy(heuristic) | 77.8% | [65.8, 86.4] | 60 | hard ≫ easy |

Ladder as shipped: **hard(78 %) > easy > medium(31 %)** — inverted at the low tier.

Beam sweep at the medium budget (`it30` vs heuristic), varying `beam`:

| beam | game-share | 95% CI | verdict |
|------|-----------|--------|---------|
| 16 (shipped) | 31.4% | [24.7, 38.9] | loses |
| 12 | 51.0% | [41.2, 60.8] | parity |
| 8 | 63.7% | [53.7, 72.6] | beats |
| 6 | 66.3% | [56.4, 75.0] | beats |
| 4 | 70.3% | [60.5, 78.5] | beats |

**Read:** the failure is the **beam:iterations ratio**, not the budget. 30 iters
over 16 children ≈ 2 rollouts each (the robust-child pick is noise, worse than the
heuristic's own #1); over ~6 children ≈ 5 rollouts each → meaningful re-ranking.
Rule of thumb `beam ≈ iters/6` (Leg A's winning it40 used beam 8). Because time
budgets deliver *few* iterations — fewest early game — a fixed wide beam is wrong;
beam must scale with the budget. Caveat: `it30/it140` are median proxies for the
phase-varying real budgets, so real medium openings (~17 iters) are even thinner —
argues for narrowing beam and/or confirming with real time budgets.

**Decision:** shipped budgets **fail** the ladder bar (medium < easy); latency
bars pass. Fix = scale/narrow the beam by tier (medium → ~6, hard → keep ~16),
realizing [AE5](../backlog/ai-engine.md); no budget/latency change needed. → F8.

### Run J-confirm — beam fix under real time budgets (AE5)

Applied the F8 fix (medium `beam=6`, hard `beam=16` in
[difficulty.ts](../../../src/client/ai/difficulty.ts)) and re-ran the ladder with
the **exact shipped configs** (real `timeBudgetMs`, phase-varying iterations — not
the it30/it140 proxies):

| matchup | A game-share | 95% CI | n | verdict |
|---------|--------------|--------|---|---------|
| medium(500ms,beam6) vs easy | **67.2%** | [58.7, 74.7] | 128 | PASS (was 31% at beam16) |
| hard(2000ms,beam16) vs medium(500ms,beam6) | 63.0% | [50.8, 73.8] | 64 | PASS (lower CI grazes 50) |

**Read:** the beam fix restores a monotonic, significant ladder under real budgets:
**easy < medium (+17 pts) < hard (+13 pts)**. Medium flipped from *losing* to easy
(31 %) to a clear win (67 %) with no budget/latency change. c2 at n=64 is solid but
thin — worth more games if we want a tight hard↔medium margin.
**Decision:** adopt. AE5 → won; AE10 fully resolved.

### Run K — extreme tier confirmation (no time budget)

The `extreme` tier (MCTS iterations mode, `it500` / `beam 20` / full rollouts, no
`timeBudgetMs`) vs `hard` (2000 ms), exact shipped configs, sharded:

| matchup | game-share | 95% CI | n | verdict |
|---------|-----------|--------|---|---------|
| extreme(it500) vs hard(2000ms) | **78.6%** | [66.7, 87.1] | 60 | PASS (+28.6 pts) |

**Read:** extreme clears the top of the ladder decisively — the iterations→strength
curve (F6/Run I, 90 % at it320) keeps paying past the time-budget tiers. Full
shipped ladder now measured + monotonic: easy < medium (67 % vs easy) < hard (63 %
vs medium) < extreme (79 % vs hard), every step CI-clear of 50. Cost: ~6–7 min per
extreme-heavy game (≈ 12 s/move early); acceptable only because "no time budget" is
the point of the tier. **Decision:** adopt; ladder complete.

### Run L — RAVE / AMAF value sharing vs plain UCT (AE3)

Added RAVE/AMAF value sharing to [mcts.ts](../../../src/game/ai/mcts.ts) (config
`rave`/`raveK`; per-node AMAF stats; selection blend β=√(k/(3N+k)), k=1000; plain-UCT
path byte-identical when off). Benchmarked RAVE vs plain UCT at **matched iterations**
(both `iterations:150`, `rolloutDepth:12`, `beam:16`) — the `--rave` arena table. 2
RAVE seats vs 2 plain-UCT seats, so parity ⇒ 50% game-share (null).
Pre-registered bar (M2): RAVE game-share > 50%, Wilson 95% CI clear.

| matchup | RAVE game-share | 95% CI | n | one-sided p | verdict |
|---------|-----------------|--------|---|-------------|---------|
| rave(it150) vs plain-uct(it150) | 56.0% | [49.1, 62.7] | 200 | 0.045 | INCONCLUSIVE (CI grazes 50) |

Seed-averaged over 8 seeds × 25 games (base seed 1). Wall clock 132 min (~40s/game).

**Read:** RAVE is **directionally positive** (+6 pts game-share, one-sided p=0.045)
but the pre-registered two-sided-CI bar is **not met** — the 95% Wilson lower bound
(49.1%) grazes below 50%. Right sign, magnitude consistent with a real-but-modest
AMAF warm-up effect at this budget, but n=200 is underpowered for a 56% effect (need
~400+ for the CI to clear). No post-hoc bar lowering (M2).

**Decision:** do **not** claim a win on this batch. Pool a second independent
seed-batch (different base seed) to ~n=400 and re-test the pre-registered bar before
closing AE3.

### Run M — RAVE pooled to n=400 (AE3 close)

Second independent seed-batch (8 seeds × 25 games, base seed 1000) to pool with Run L
and re-test the pre-registered bar at higher power. Same matched-iteration config.

| batch | RAVE game-share | n |
|-------|-----------------|---|
| Run L (seed 1) | 56.0% (112/200) | 200 |
| Run M (seed 1000) | 52.0% (104/200) | 200 |
| **pooled** | **54.0% (216/400)** | **400** |

Pooled (stats.py --pool): game-share 54.0%, Wilson 95% CI **[49.1, 58.8]**, one-sided
z +1.60, p(>50%)=0.055. Wall clock 134 min (batch 2).

**Read:** the second batch regressed toward the null (52%), so batch 1's 56% was
partly noise. Pooled to n=400 the two-sided 95% CI **still does not clear 50%**
(lower bound 49.1). RAVE's matched-iteration edge is small (~4 pts pooled) and not
significant — and at matched *wall-clock* it would fare worse still, since RAVE pays
AMAF tracking + sibling-backprop overhead per iteration for no net iteration
efficiency here. AMAF warm-up doesn't buy meaningful strength in Blokus at this budget:
plausibly the heuristic beam already supplies the early-search prior RAVE would add,
and Blokus placements rarely recur across lines (weak AMAF signal — a move's value is
highly position-dependent), undercutting the AMAF assumption.

**Decision:** **no-win.** Pre-registered bar (CI clear of 50%) not met at n=400,
replicated across two seed batches. Do not ship RAVE. Code kept behind `rave:false`
(default, zero-cost) for future revisit at other budgets. AE3 → no-win. → F9.

### Run N — MCTS profile: where does a 150-iter move spend its time? (AE2/AE9 diagnostic)

Not a tournament (no win/loss/CI) — a CPU profile to decide the AE2-vs-AE9-vs-AE4
fork off real numbers instead of guessing (M3). `node:inspector` CPU profile of one
150-iter plain-UCT search (beam 16, rolloutDepth 12) on a representative mid-opening
position (8 plies in, **541 legal moves** — near-peak branching), 20× repeat for
sample count. Script: [scripts/profile-mcts.ts](../../../scripts/profile-mcts.ts).
~390 ms/search.

Phase self-time: rollout **46%**, move-gen **19.5%**, tree+backprop **0.7%**, other
33.7% (almost all low-level board primitives). Top leaves:

| fn | self-time | role |
|----|-----------|------|
| `isLegalPlacement` | 31.4% | legality test (adjacency/corner/overlap) |
| `generateLegalMoves` | 17.9% | full move enumeration |
| `inBounds` | 11.1% | per-cell board-bounds guard |
| `sampleLegalMove` | 11.0% | rollout rejection sampler (→ isLegalPlacement) |
| `get` / `idx` | 7.1% / 6.0% | per-cell board reads |
| `isSameColor` / `newFrontier` | 1.0% / 2.6% | adjacency/corner scan guts |

**Read:** attributing the primitives to their callers, **~75% of MCTS time is
legality-testing + move generation, both dominated by cell-by-cell board scans**
(`isLegalPlacement` alone is 31%). Rollout's 46% is itself mostly `sampleLegalMove`
calling `isLegalPlacement` up to 24×/move. `tree/backprop` is 0.7% — which is exactly
why AE3's RAVE (a tree-stats tweak) couldn't move strength: it optimized a rounding
error. The bottleneck is **shared** by rollout and gen — the per-cell legality
primitive — so the lever that speeds both at once is a **bitboard** board
representation (AE9): occupied/adjacency/corner masks turn `isLegalPlacement` into a
few AND/ORs instead of `inBounds`+`get`+`isSameColor` loops.

**Decision:** promote **AE9 (bitboards)** to the next active candidate; it attacks the
~75% hot path and accelerates rollout *and* gen together. AE4 (learned eval) is the
wrong tool here — rollout cost is legality *sampling*, not *evaluation* — and stays
blocked on logging. → F10.

### Run O — learned value net as MCTS leaf eval (AE4)
Can a tiny learned value net replace full rollouts at matched wall-clock? (AE4;
pre-registered bar: net-leaf MCTS game-share CI clears 52% vs full-rollout MCTS
at matched 500 ms/move over ≥600 games.)

**Stage A — data.** 10,000 self-play games (heuristic + ε=0.1 exploration, 4
seats, seeds 1000–10999) via `scripts/selfplay-dump.ts` → 697k positions
(`.data/selfplay/heur-e10-10k.jsonl`, replay-verified). 20.5 min.

**Stage B — offline gate (pre-registered kill-gate).** 609-param color-symmetric
MLP (8 features/color + opp means + fill → softmax over colors), pure-TS train +
inference (`scripts/train-valuenet.ts`, 5 epochs, 3.5 min). Held-out winner
prediction, plies 20–50 (n=31,000 positions / 1,000 games):

| predictor | accuracy | 95% CI |
|-----------|----------|--------|
| value net | 42.85% | [42.3, 43.4] |
| shipped evalState (placed + 0.5·attach) | 39.12% | [38.6, 39.7] |

Discordant pairs: net right in 4,242 of 7,328 = 57.9% [56.8, 59.0], z = +13.5.
Positions within a game correlate, so the position-level n overstates power, but
the margin survives any reasonable deflation. **Gate passed** → integration.

**Stage C — arena at matched wall-clock.** `leafValue` injection in `mcts.ts`
(net win-prob vector backs up instead of a rollout). Net side gets 15–100× the
iterations at 500 ms (rootN 340–1,593 vs 15–46 by phase) → beam 16 per F8;
rollout side = shipped medium (500 ms, beam 6). Config
`scripts/experiments/ae4.json`, 8 shards × 3 seeds × 25 games (seeds 2000–2072),
600 games, 47 min wall on 16 cores.

| config | games | game-share | 95% CI | p(>50%) |
|--------|-------|-----------|--------|---------|
| net-mcts (500 ms, beam 16) | 600 | **27.6%** | [24.2, 31.3] | 1 (z = −11.0) |
| rollout-mcts (500 ms, beam 6) | 600 | 72.4% | — | — |

All 8 shards agree (net 23–33%); an 8-game pilot's 44% was noise.

**Read:** the bar (CI clears 52%) is missed by ~25 points — a clean, well-powered
negative. Beating the *static heuristic* as a predictor (Stage B) is far short of
matching a *full rollout* as a leaf estimate: 15–100× more iterations do not
compensate for the weaker per-leaf signal. Reconfirms F6 (rollout quality is the
strength lever) from the opposite direction, and F10's prediction that AE4
attacks the wrong cost. A stronger net (board planes, more params, MCTS-quality
labels) might close the gap but is a different cost class than this experiment.

**Decision:** no-win at this scale — keep full rollouts. `leafValue` stays as a
zero-cost injection point (default off). Revisit only with a step-change in net
capacity/data (board-plane input, policy head, MCTS self-play labels), ideally
after AE9 bitboards raise the rollout baseline it must beat. → AE4 closed.

### Run P — bitboard move generation (AE9)
Do bitboard legality checks speed the legality-bound MCTS hot path (F10) without
changing what it computes, and does the extra throughput convert to strength?
(AE9; pre-registered bar, three gates: (1) byte-identical legal-move output vs the
`isLegalPlacement` scan; (2) ≥2× iters/s; (3) game-share CI clears 52% vs the
current engine at matched wall-clock, ≥600 games.)

**Implementation.** New `src/game/bitboard.ts`: the 20×20 board as one 20-bit word
per row (`Uint32Array(20)`), a global occupancy board plus, per color, that color's
own cells and lazily-derived orthogonal (rule-5 forbidden) and diagonal (rule-4
attach) dilations. `bbLegal` replaces the per-cell `orthoNeighbors`/`diagNeighbors`
scan (which allocated ~40 short-lived objects per pentomino test — F10/AE2 note)
with masked lookups; dilations are computed once per color per position-batch and
reused across all candidates. Threaded into the hot path: `generateLegalMoves` /
`hasAnyMove` build a board once and amortize; the MCTS rollouts build once and
maintain incrementally via `bbApply`. `isLegalPlacement` is unchanged and remains
the bgio/UI path and the differential-test reference.

**Gate 1 — byte-identical (hard gate).** `tests/bitboard.test.ts`: for every
piece × orientation × position across 48 reachable positions (>100k candidates,
seeds 1–8 × plies 0–15), `bbLegal` verdict === `isLegalPlacement` verdict; the
incrementally-maintained board also matches a from-scratch rebuild after every ply
(the rollout path). Passes. Independently, the deterministic MCTS/moves/sim tests
(121 unit + 16 e2e) all still pass — byte-identical search trajectories.

**Gate 2 — throughput.** `scripts/bench-mcts.ts`, mid-opening position (8 plies in,
541 legal moves), 60 × 150-iter searches, best-of-3, same engine config
(rolloutDepth 12, beam 16):

| engine | iters/s | ms/search |
|--------|---------|-----------|
| baseline (`isLegalPlacement` scan) | 402 | 373 |
| bitboard | **997** | 150 |

**2.48×** — clears the ≥2× bar.

**Gate 3 — game-share at matched wall-clock.** Since output is byte-identical at a
fixed iteration count (gate 1), per-iteration strength is identical old-vs-new — the
change only makes iterations cheaper. So "new vs old at matched wall-clock T"
reduces exactly to a head-to-head at the iteration counts each fits in T: the
bitboard engine gets 2.5× the iterations of the baseline. `scripts/experiments/ae9.json`,
bitboard-2.5x = MCTS(80 iters) vs baseline-1x = MCTS(32 iters), rolloutDepth 12,
beam 16, 4 seeds × 160 games = 640 games (seeds 1–4). (Lighter absolute iters than
the ~500 ms live budget keep the run tractable; per F8's concave strength-vs-iters
curve the 2.5× gap is if anything *wider* at low iters, so this is a fair-to-
conservative proxy.)

| config | games | game-share | 95% CI | p(>50%) |
|--------|-------|-----------|--------|---------|
| bitboard-2.5x (80 iters) | 640 | **71.4%** | [67.8, 74.8] | 1.2e-27 (z = +10.8) |
| baseline-1x (32 iters) | 640 | 28.6% | — | — |

All 4 seeds agree (±0.6). CI clears 52% by ~16 points.

**Read:** all three gates pass. Bitboards cut the F10 legality bottleneck ~2.5×
with provably identical output, and at matched wall-clock that throughput buys a
decisive strength edge — reconfirming F6/F8 (more search = more strength) from the
throughput side. This raises the standing rollout baseline every future speed/quality
experiment is measured against.

**Decision:** won — bitboard legality shipped into the rules-core hot path (kept
byte-identical; `isLegalPlacement` retained for bgio/UI). Raises node rates for the
live time-budget tiers for free. → AE9 closed; next speed lever is AE18 (harness
throughput). Config `scripts/experiments/ae9.json`, bench `scripts/bench-mcts.ts`.

### Run Q — research-harness throughput (AE18, sub-items 1+2)
Can the research tooling produce more games/positions per wall-clock hour with
byte-identical outputs? (AE18; scope narrowed 2026-07-07: sub-item 1 arena-driver +
sub-item 2 dump sharding; sub-item 3 trainer feature-cache deferred, F11 made the
value-net workflow dormant. Bar: ≥3× dump throughput + a measured arena-driver
speedup, both byte-identical.)

**Sub-item 1 — arena-driver lazy stuck detection.** `playGame` (`arena.ts`) called
`recomputeStuck` (= `hasAnyMove` ×4, the expensive full-scan case) after *every*
move; replaced with the rollout's lazy pass approach — a color is discovered stuck
only when its strategy returns null. Byte-identical because faithful strategies
return null iff no legal move and draw no rng on that path, legality is monotone,
and the old eager marking only ever *skipped* a zero-rng turn. Guarded by a golden
test (`tests/arena.test.ts`) pinning exact wins/ties for seeds 1/42/99 captured from
the eager driver — the tournament reuses one rng across its games, so any stray draw
would cascade. Throughput (fast strategies, 300 games, best-of-3, `scripts/bench-driver.ts`):

| driver | games/s |
|--------|---------|
| eager `recomputeStuck`/move | 15.5 |
| lazy stuck (this run) | **17.4** |

**1.12×** — modest, as the AE18 cost note predicted: AE9 (Run P) already made
`hasAnyMove` ~2.5× cheaper, so the eliminated calls mostly short-circuit now. Still
free and byte-identical on every future arena/dump run.

**Sub-item 2 — self-play dump sharding.** `selfplay-dump.ts` uses per-game
independent seeds (`mulberry32(baseSeed+g)`), so `--jobs=N` shards contiguous game
ranges across N child processes and concatenates the shard files in game order —
byte-identical to the single-process JSONL (verified `diff -q` on 48- and 200-game
dumps). Wall time (200 games, seeds 5000–5199, 16-core host):

| mode | wall | throughput |
|------|------|-----------|
| `--jobs=1` | 17.0 s | 11.8 games/s |
| `--jobs=8` | 3.7 s | **54 games/s** |

**4.6×** — clears the ≥3× bar. (Would scale further with more jobs; 8 chosen for
the readout.)

**Read:** both live sub-items pass byte-identically. The dump-sharding win (4.6×) is
the one that matters — it cuts the data-gen cost of every future self-play experiment
(Run O's 20-min dump → ~4 min); the arena-driver win is small post-AE9 but free. No
strength claim — this is pure tooling throughput.

**Decision:** won (live subset) — lazy-stuck driver + `--jobs=N` dump sharding
shipped, both byte-identical (golden test + diff). Sub-item 3 (trainer feature-cache,
<10 s) deferred with the dormant value-net path. → AE18 closed. Bench
`scripts/bench-driver.ts`.

### Run R — External baseline: our tiers vs Pentobi over GTP (AE19)

**Question (AE19):** where do our bots sit on Pentobi's calibrated 1–9 ladder — the
de-facto external reference — so strength becomes absolute, not self-relative?

**Infra.** New GTP bridge in `src/game/ai/pentobi/` (`gtp.ts` async subprocess
wrapper, `coords.ts` mapping, `arena.ts` async 2v2 driver, `run.ts` runner,
`npm run arena:pentobi`). Pentobi 23.1's Ubuntu package is GUI-only, so `pentobi-gtp`
is built from source — no Boost, static cmake, `cmake -DPENTOBI_BUILD_GUI=OFF
-DPENTOBI_BUILD_GTP=ON` (~6 s) → `~/.local/share/pentobi-gtp/`. Coord map verified
against Pentobi's forced corner openers (blue→a20, yellow→t20, red→t1, green→a1 =
our CORNERS): `x = col-'a'`, `y = 20-row`. **Our GameState is authoritative** — every
move (ours *and* Pentobi's) is applied to `G`, the winner is `finalScores(G)`, and
because each Pentobi move must resolve to one of our legal moves, every bridged game
is replay-verified against our rules core for free (0 desync/mismatch across all
runs; `tests/pentobiCoords.test.ts` locks the mapping). 4p Classic, 2v2 (2 our seats
+ 2 Pentobi), seat-rotated, seed-averaged; game-share null = 50%. Configs
`scripts/experiments/ae19-*.json` + `ae19-sweep.sh` / `ae19-extreme-power.sh`.

**Result** — game-share of *our* team, Wilson 95% CI, `n` games:

| our bot            | vs L1                    | vs L2                   | vs L3                  | vs L4                |
|--------------------|--------------------------|-------------------------|------------------------|----------------------|
| heuristic (easy)   | 21.2% [16.5,26.9] n=240  | 10.5% [7.2,15.0] n=240  | 3.7% [1.9,6.9] n=240   | 0.1% [0,1.8] n=240   |
| MCTS 150-iter      | 43.1% [36.4,50.0] n=200  | 31.9% [25.8,38.7] n=200 | 19.4% [14.5,25.5] n=200| —                    |
| extreme (500-iter) | **61.8% [54.9,68.2] n=200** | 45.3% [35.9,55.1] n=100 | —                  | —                    |

**Read.** Pentobi is strong: our shipped **easy tier is CI-clear below L1** (21%),
decaying monotonically to ~0% by L4 — the clean monotone ladder cross-checks the
coord mapping. Mid MCTS (150 iters) is a hair below L1 (43%, CI upper just touches
50). Our **extreme tier beats Pentobi L1 CI-clear** (61.8%, n=200) and is ~even with
L2 (45.3%, inconclusive at n=100) — so it sits **between L1 and L2**. The jump from
150→500 iters (43%→62% vs L1) re-confirms F6 (MCTS scales with compute). Highest
level we beat CI-clear = **L1**. First *absolute* strength number for OpenBlokus;
every prior figure was self-relative.

**Decision:** won — bridge shipped (measurement infra, AE6 precedent) + ladder
placed: easy < L1, extreme ≈ L1–L2 (beats L1 CI-clear, even-ish vs L2). Standing
external readout for future AE entries. extreme-vs-L2 left directional (n=100); a
firm L2 call is a cheap follow-up if a candidate claims to reach it. → AE19 closed.

### Run S — Score-margin reward shaping: rank-normalized reward vs winner-take-all (AE15)
Does blending Pentobi's rank-normalized placement term into the winner-take-all
reward make a losing bot fight for 2nd-vs-4th without costing wins? (backlog AE15)
Head-to-head, 2 shaped seats vs 2 plain seats, matched MCTS budget (iters 48,
rolloutDepth 12, beam 16), differing only in `rankRewardWeight`. Reward becomes
`(1−w)·winner + w·rankNorm`, rankNorm = ties-averaged `(beaten+(tied−1)/2)/(n−1)`
over placed squares. Configs `scripts/experiments/ae15.json` (w=0.5),
`ae15-w025.json` (w=0.25). n=600 each (25×24 seeds, baseSeed 5); game-share pooled
with a 48-game directional probe (baseSeed 1, disjoint seeds) → n=648. Placement
lower = better; placed = 89 − remaining, higher = better. Placement diff CI uses the
exact within-game anti-pairing (shaped-seat mean + plain-seat mean = 5 ⇒ std_d =
2·seed-std, df=23); placed diff CI assumes seed independence (conservative).

| w    | placement shaped−plain (95% CI) | placed shaped−plain (95% CI) | shaped game-share (Wilson, n=648) |
|------|---------------------------------|------------------------------|-----------------------------------|
| 0.25 | **−0.24 [−0.35, −0.13]**        | **+1.30 [+0.64, +1.96]**     | **53.2% [49.4, 57.1]**            |
| 0.50 | −0.16 [−0.27, −0.05]            | +1.20 [+0.60, +1.80]         | 49.2% [45.4, 53.1]                |

Directional single-seed n=8 probe first showed shaped *losing* game-share 31/69 —
pure M1 noise; it inverted by n=48 and held through n=600.

**Read.** Both weights improve final placement and placed squares CI-clear — the
winner-take-all reward genuinely left a gradient on the table between 2nd and 4th.
The split is on the win guard: **w=0.25 keeps game-share CI above the 48% floor**
(lower bound 49.4%, even leans >50%, one-sided p=0.049), while **w=0.5 over-trades**
— placement still improves but game-share CI sinks to 45.4%, under the floor. That's
the M4 fit-check firing exactly as AE15 pre-registered it: heavy score-greed conflicts
with win-seeking. Light shaping sits in the sweet spot — a losing bot fills ~1.3 more
squares and ranks ~0.24 higher without paying in wins.

**Decision:** won at **w=0.25** — clears AE15's bar (placement/score improve CI-clear,
game-share CI ≥ 48%). w=0.5 rejected (guard fail). `rankRewardWeight` default stays 0
(byte-identical, AE18 golden intact); 0.25 is the recommended shipping value. Feeds
the advisor a non-degenerate value signal in lost positions (AD2/AD3). Product ship
decision (P13): this is a *lost-position* behavior lever, not a ceiling lever, so it's
a retune-in-place for existing tiers, never a new rung — hand to /ship.

### Run T — Smarter rollout policy: score-biased vs size-greedy playouts (AE11)
Does biasing rollout moves toward frontier-creating / corner-denying moves (the
full heuristic score, greedy or softmax-sampled) make rollout outcomes more
predictive, at matched wall-clock? (backlog AE11; bar pre-registered: game-share
Wilson CI clears 52% vs the current rollout policy, ≥600 games.)

**Setup.** New `rolloutPolicy` values `score` (argmax full heuristic over the
sampled candidates) and `softmax` (Boltzmann, `exp(score/T)`), plus a
`rolloutSamples` knob, in [mcts.ts](../../../src/game/ai/mcts.ts); `scoreCells`
split out of `scorePlacement` so rollouts score sampled cells without re-resolving.
Defaults unchanged ⇒ byte-identical (AE18 golden test intact). Head-to-head 2v2,
shipped engine context (`rolloutDepth 0`, `beam 16`, `rankRewardWeight 0.25`),
n=600 each (25 games × 24 seeds, baseSeed 1..24), configs
`scripts/experiments/ae11-{score,softmax,samples12}.json`, sharded via
`ae11-sweep.sh`. Wall 237 min (52 CPU-hours, 14-way).

**Matched wall-clock via measured throughput, not a timer.** Timed-mode arenas
can't be sharded (contention changes strength, not just wall-time), so the clock
match is converted to an iteration match using benched iters/s
(`scripts/bench-rollout.ts`, fixed mid-opening position, branching 541,
`rolloutDepth 0`, best-of-3):

| policy | iters/s | vs baseline | matched-clock iters |
|--------|---------|-------------|---------------------|
| heuristic-6 (baseline) | 47 | 1.00× | 48 |
| heuristic-12 | 57 | **1.23×** | 59 |
| score-6 | 46 | 0.99× | 47 |
| softmax-6 T=8 | 46 | 0.99× | 47 |
| softmax-6 T=3 | 46 | 0.98× | 47 |

Smarter rollouts are *not* slower: a playout that plays bigger pieces reaches
terminal in fewer plies, and at `rolloutDepth 0` that shortening pays for the extra
scoring. AE11's stated cost risk (per-move cost eating the gain) did not fire.

**Results.** Game-share of the candidate vs `size-6`; placement lower = better,
placed = 89 − remaining, higher = better. Stats via `stats.py`.

| arm (candidate vs size-6) | game-share (Wilson, n=600) | one-sided p | placement cand/base | placed cand/base |
|---------------------------|----------------------------|-------------|---------------------|------------------|
| `score-6` @48 it          | 48.8% [44.9, 52.8]         | 0.72        | 2.506 / 2.494       | 71.93 / 71.90    |
| `softmax-6` T=8 @48 it    | 49.3% [45.3, 53.3]         | 0.63        | 2.458 / 2.542       | 72.24 / 71.49    |
| **`size-12` @59 it**      | **54.4% [50.4, 58.3]**     | **0.016**   | **2.410 / 2.590**   | **73.05 / 71.61**|

**Read.** The AE11 hypothesis is not supported: scoring the rollout candidates by
the full heuristic — greedy or temperature-sampled — buys nothing (both CIs straddle
50%, both point estimates ≤ 50%). The arm that moved was the *control*: keeping the
size-greedy rule and doubling the candidate pool (6→12), which at matched wall-clock
also buys 59 iters vs 48. It clears 50% (p=0.016) but its CI lower bound is 50.4% —
**below the pre-registered 52% bar**. Placement and placed squares move with
game-share in the same arm (both CI-consistent directions), and softmax's placement
edge (2.458) without a win edge mirrors the AE15 w=0.5 pattern: score-greed without
win-conversion.

Attribution caveat: `size-12`'s win is the *joint* effect of a bigger candidate pool
and the extra iterations its speedup buys — that pairing is what "matched wall-clock"
means here, and the two are not separable within this design.

**Decision:** no-win on the pre-registered bar — the rollout-*policy* hypothesis
(score-bias) is rejected at n=600; the rollout-*width* lever (`rolloutSamples`)
clears 50% but not the 52% bar and is left open as a follow-up (sweep 12/24, power
to n≥2400 if the point estimate holds). Code kept: `rolloutSamples` /
`score` / `softmax` are config-only, defaults byte-identical.

### Run U — Rollout width: how many candidates should a playout move sample? (AE26)
Sweep `rolloutSamples` ∈ {12, 24, 48} vs the shipped 6, each at its own
matched-wall-clock iteration count, plus a same-samples iteration-only control to
split width from the iterations that width's shorter playouts buy. (backlog AE26,
spun out of Run T; bar pre-registered: some width > 6 has game-share Wilson CI
clearing **52%** vs 6 at matched wall-clock, ≥600 games/arm.)

**Setup.** Head-to-head 2v2, shipped engine context (`rolloutDepth 0`, `beam 16`,
`rankRewardWeight 0.25`, `rolloutPolicy heuristic`), n=600 each (25 games × 24
seeds, baseSeed 1..24), configs `scripts/experiments/ae26-{samples12,samples24,
samples48,control-iters}.json`, sharded via `ae26-sweep.sh` (resumable: per-batch
`.result`, skips completed batches — the run survived a host reboot mid-sweep and
resumed). Wall 324 min (74 CPU-hours, 14-way).

**Matched wall-clock via measured throughput** (`scripts/bench-rollout.ts`, extended
to widths {6,12,24,48}; fixed mid-opening position, branching 541, `rolloutDepth 0`,
best-of-3):

| samples | iters/s | vs baseline | matched-clock iters |
|---------|---------|-------------|---------------------|
| heuristic-6 (baseline) | 46 | 1.00× | 48 |
| heuristic-12 | 54 | 1.19× | 57 |
| heuristic-24 | 62 | **1.35×** | 65 |
| heuristic-48 | 62 | **1.35×** | 65 |

The "bigger piece ⇒ shorter playout ⇒ more iters" speedup is real but **saturates**:
48 samples is no faster than 24 (both 1.35×, 65 iters). Beyond ~24 candidates the
extra rejection-sampling cost per move cancels the shorter-playout gain.

**Results.** Game-share of the candidate vs its 6-sample opponent; placement lower =
better, placed = 89 − remaining, higher = better. Stats via `stats.py`.

| arm (candidate vs 6-sample opp) | game-share (Wilson, n=600) | one-sided p | place cand/base | placed cand/base |
|---------------------------------|----------------------------|-------------|-----------------|------------------|
| `s12` @57 it vs `s6` @48 it     | 55.7% [51.7, 59.6]         | 0.0026      | 2.368 / 2.632   | 73.25 / 71.51    |
| **`s24` @65 it vs `s6` @48 it** | **62.6% [58.6, 66.3]**     | **3.9e-10** | **2.297 / 2.703** | **73.92 / 71.22** |
| **`s48` @65 it vs `s6` @48 it** | **64.9% [61.0, 68.7]**     | **1.2e-13** | **2.255 / 2.745** | **74.25 / 70.78** |
| control `s6` @57 it vs `s6` @48 it | 58.0% [54.0, 61.9]      | 4.2e-05     | 2.332 / 2.668   | 73.40 / 71.20    |

**Read.** Two width arms clear the pre-registered 52% bar at matched wall-clock
(`s24` LB 58.6%, `s48` LB 61.0%); `s12`'s LB 51.7% misses it (as Run T's 12-arm
did). Strength is **monotone increasing in width** over [6,48] at matched clock —
no interior optimum in range; the curve is still climbing at 48. Placement and
placed-squares track game-share in every arm.

The control decomposes *why*. The 48→57 iteration bump alone (same 6 samples) buys
**+8.0 pts** (58.0%). Two same-iteration contrasts isolate width:
- **6→12 at 57 it:** `s12` 55.7% − iter-only control 58.0% = **−2.3 pts.** Width at
  12 is net-negative once iterations are held fixed; the 12-arm's entire
  matched-clock win (and Run T's 54.4%) is the extra iterations, not the width.
- **24→48 at 65 it** (same baseline, same iters): 64.9% − 62.6% = **+2.3 pts.** A
  small but genuine width effect at the high end, where iters/s has saturated so it
  can only be width.

So the matched-wall-clock win of wider sampling is *mostly the iterations its
shorter playouts buy* (dominant up to the ~24-sample speed plateau), plus a small
real width bump beyond the plateau (24→48). `fallbackMove` rate at large widths
(the entry's late-game rejection-exhaustion watch) was not instrumented in
`--result` — unmeasured caveat carried to close.

**Decision:** won on the pre-registered bar — `rolloutSamples` 24 and 48 both clear
52% game-share vs 6 at matched wall-clock, n=600, CIs well clear (no power-up to
n=2400 needed). Mechanism is iteration-dominated with a small high-end width term;
under the shipped **time-budget** tiers, widening captures the iteration gain for
free (shorter playouts ⇒ more sims at fixed time), and the `s48`-vs-`s24` contrast
at fixed iters is the time-budget-relevant proxy (48 ≳ 24 by ~2 pts). Deploy lever:
raise `rolloutSamples` toward 24 (speed-plateau, near-optimal) or 48 (best measured,
higher late-game rejection cost). Config-only knob, defaults unchanged.

### Run V — Rollout width at fixed iterations: does the extreme tier get the width win? (AE28)
Run U measured width at matched *wall-clock*, where the win was mostly the extra
iterations shorter playouts buy — a bonus the shipped `extreme` tier (fixed 500 iters,
*no* time budget) cannot collect. This isolates the **pure-width** term: `s48` vs `s6`,
both pinned at 500 iters, so iteration count is identical and only rollout quality
differs. (backlog AE28; bar pre-registered: `s48` game-share Wilson CI clears **52%**
vs `s6` at fixed 500 iters, ≥600 games.)

**Setup.** Head-to-head 2v2, extreme's config (`iterations 500`, `beam 20`,
`rolloutDepth 0`, `rankRewardWeight 0.25`, `rolloutPolicy heuristic`), n=600 (25 games
× 24 seeds, baseSeed 1..24), config `scripts/experiments/ae28-extreme-width.json`,
sharded via `ae28-sweep.sh` (resumable, in-repo). No iteration/clock matching — fixed
iters *is* the test. Wall 732 min (150 CPU-hours, 14-way; ~500 iters/move is ~3× Run
U's per-game cost).

**Results.** Game-share of `s48` vs `s6`; placement lower = better, placed = 89 −
remaining, higher = better. Stats via `stats.py`.

| arm (both @ 500 it / beam 20) | game-share (Wilson, n=600) | one-sided p | place s48/s6 | placed s48/s6 |
|-------------------------------|----------------------------|-------------|--------------|---------------|
| **`s48` vs `s6`, fixed iters** | **61.3% [57.3, 65.1]**    | **1.5e-08** | 2.358 / 2.642 | 77.05 / 76.04 |

**Read.** Width wins **on pure quality**, decisively: +11.3 pts with no iteration
bonus (both arms ran 500), CI lower bound 57.3% well past the 52% bar. This is
*larger* than the whole matched-clock effect at Run U's low budgets — and it directly
contradicts Run U's decomposition, which found the pure-width term small and
non-monotone (−2.3 pts at 6→12, +2.3 pts at 24→48) at ~55–65 iters. The reconciliation
is the iteration budget: **the value of a wider (higher-quality) rollout scales with
how many iterations there are to average it into.** At a starved ~55-iter budget the
leaf estimates are dominated by variance/quantity, so rollout quality barely registers
and width's only lever is the iterations its speedup buys (Run U). At a deep 500-iter
budget the tree is well-developed and each rollout's lower-variance, bigger-piece
signal sharpens the leaf values that now carry the search — reasserting rollout
*quality* as the lever (F6's original regime). Placement and placed-squares track
game-share.

**Decision:** won — `rolloutSamples` 48 clears 52% vs 6 at fixed 500 iters, n=600, CI
well clear (no power-up needed). The extreme tier gets a clean **strength** win from
widening (independent of, and on top of, the ~1.35× move-speed gain). Deploy: raise
`extreme`'s `rolloutSamples` from 6 toward 48. Time-budgeted tiers (medium/hard) were
already covered by Run U. Config-only knob; the `fallbackMove`-exhaustion path is
sample-with-replacement (`mcts.ts` — no crash, only wasted cycles in sparse endgames).

### Run W — Population-play harness: does pool Elo add signal over head-to-head? (AE21)
Builds the round-robin + Bradley-Terry Elo harness AE21 specifies and validates it on
a **fast, low-diversity** subset of the frozen pool. Not the discriminating run — the
pre-registered bar (pool ranking reorders/separates a pair head-to-head calls equal, or
correlates better with the AE19 Pentobi ladder) is tested by the *diverse* pool (MCTS
tiers + champion), which is compute-heavy and deferred. This run answers the cheaper
prior question: is the harness correct, and what does a **transitive** pool show?

**Setup.** New pure core `runRoundRobin` + `bradleyTerryElo` (`src/game/ai/arena.ts`):
every unordered pair plays a mirrored 2v2 match (reusing `runTournamentSeeds`, so seat
rotation / tie-splitting / scoring are identical to every other table), filling a
pairwise game-share matrix; a prior-regularized MM Bradley-Terry fit → one Elo/member,
centered 1500. Pool versioned in `scripts/experiments/pool.json` (champion = extreme-MCTS
top entry; MCTS members pinned to fixed iterations, not time budgets, for cross-machine
reproducibility). CLI `--pool=… --members=…`. Members here: `random, greedy-size,
heuristic (incumbent), alphabeta-d2 (depth 2, beam 8)`. Classic 20×20 4p, n=300/pair
(75 games × 4 seeds, baseSeed 1..4), 6 pairs. Wall 12.5 min (single-process; alphabeta
~0.65 s/game dominates). Stats via `stats.py`.

**Results.** Pairwise game-share (row vs column), Elo-ordered; n=300/pair.

| row \ col        | alphabeta | heuristic | greedy | random | **Pool Elo** |
|------------------|-----------|-----------|--------|--------|--------------|
| **alphabeta-d2** | —         | 49.6%     | 91.5%  | 100.0% | **1841**     |
| **heuristic** ⚑  | 50.4%     | —         | 87.3%  | 99.2%  | **1828**     |
| **greedy-size**  | 8.5%      | 12.7%     | —      | 97.7%  | **1470**     |
| **random**       | 0.0%      | 0.8%      | 2.3%   | —      | **861**      |

Key Wilson CIs (n=300): alphabeta vs heuristic **49.6% [44.0, 55.2]** (straddles 50,
z=−0.13) — a genuine tie; greedy vs heuristic 12.7% [9.4, 16.9]; random vs heuristic
0.8% [0.3, 2.7]; greedy vs random 97.7% [95.3, 98.9].

**Read.** The harness is correct: deterministic across repeats (unit-tested), matrix
mirrors sum to 1, Elo is transitive and sensibly spaced. But on **this** pool the pool
ranking **adds no signal** — it reproduces the head-to-head ordering exactly. The one
pair head-to-head calls equal (alphabeta ≈ heuristic, CI straddles 50) is *also* an Elo
near-tie (13 Elo, within noise); every other pair is separated identically by both
methods. This is structural, not bad luck: **a transitive pool forces pool-Elo to agree
with head-to-head by construction** (Bradley-Terry has a consistent global order to
recover, so the marginal-vs-incumbent order and the fitted order coincide). Population
play only *can* add signal when the pool is **non-transitive / off-distribution** —
where a member is strong against its training opponent but folds to a different style
(the 4p kingmaker caveat). None of random/greedy/heuristic/alphabeta plays that role;
the MCTS tiers and champion (tuned via self-play against the heuristic) are exactly the
members that might, which is why the discriminating run needs them.

**Decision:** not a close. Harness **delivered and validated** (Run W); AE21 stays
**active**. The pre-registered bar is untested — its discriminating run is a round-robin
over the diverse pool (`champion, mcts-150, mcts-30, alphabeta-d2, heuristic, greedy-size,
random`), which is MCTS-heavy: a 7-member round-robin is 21 pairs, the ~10 MCTS pairs at
seconds/move → tens of CPU-hours; schedule deliberately (shard like AE28's sweep). Its
readouts to compare: pool Elo vs the marginal-vs-incumbent (heuristic column) ordering,
and pool Elo rank vs the AE19 Pentobi-level placement of the same MCTS members. No
shipped default changes; the harness + versioned pool + champion designation are what
product **P13** consumes (ladder = tiers as bands vs the champion), independent of the
signal test.

### Run W2 — Diverse-pool round-robin: does pool Elo beat head-to-head on the full pool? (AE21)
The discriminating run F19/Run W deferred: the full 7-member pool including the
latency-unbounded champion, sharded so the champion (~131 s/game) is feasible. Tests
AE21's pre-registered bar — pool ranking reorders/separates a pair head-to-head-vs-the-
incumbent calls equal, *or* correlates with the AE19 Pentobi ladder better than
head-to-head does.

**Setup.** New sharding infra (`scripts/experiments/ae21-sweep.sh` parallel-seed batches
of the `--pool` round-robin; `ae21-champion.sh` runs the champion as isolated 2-member
pair-sweeps so its cells never seed-collide with the cheap sweep; `ae21-pool.ts` sums
shards → refits the same `bradleyTerryElo` → Wilson CIs). Two sweeps pooled (cells carry
independent n): **Sweep A** champion-free 6-member pool at **n=200/pair** (50 seed-batches
× 4 games, baseSeed 1..50; wall 3 h 55 m, ~51 CPU-h, 16 cores); **Sweep B** champion vs
each of the 6, **n=40/pair** directional (40 seed-batches × 1 game; wall ~2 h 37 m — the
champion anchor, not a hypothesis under test). Classic 20×20 4p, mirrored 2v2 per pair.
Stats via `ae21-pool.ts`'s Wilson intervals.

**Results.** Pool Elo (Bradley-Terry, centered 1500) and each bot's game-share vs the
incumbent (heuristic):

| bot            | pool Elo | vs incumbent          | n (vs inc) |
|----------------|----------|-----------------------|------------|
| champion ♛     | **2056** | 93.3% [81.2, 97.8]    | 40         |
| mcts-150       | **1796** | 82.8% [77.0, 87.4]    | 200        |
| mcts-30        | **1683** | 66.1% [59.3, 72.3]    | 200        |
| alphabeta-d2   | **1587** | 55.5% [48.6, 62.2]    | 200        |
| heuristic ⚑    | **1549** | —                     | —          |
| greedy-size    | **1215** | 13.8% [9.7, 19.2]     | 200        |
| random         |  **615** |  0.0% [0.0, 1.9]      | 200        |

Champion vs the field: mcts-150 84.2% [70.0, 92.4], mcts-30 91.3% [78.5, 96.7],
alphabeta 96.7% [85.9, 99.3], heuristic 93.3%, greedy/random 100% — all n=40.

**Read.** The pool is **strictly transitive** — every higher-Elo bot beats every
lower-Elo bot head-to-head (no upset in any of the 21 cells), and the champion dominates
the whole field (CI lower bounds ≥ 70%). Consequently the pool-Elo order is **identical**
to the ranking-by-share-vs-incumbent order — pool Elo **adds no signal**. The tightest
candidate for a "tie the pool breaks", mcts-30 (66.1%) vs alphabeta (55.5%) vs the
incumbent, is already *marginally distinguishable* through the incumbent alone
(two-proportion z ≈ 2.2, p ≈ 0.03), so it is not a tie the pool is needed to break — and
pool Elo ranks them in the same order anyway. The AE19 arm likewise fails to *separate*
the methods: pool Elo ranks the three AE19-placed bots champion > mcts-150 > heuristic,
matching Pentobi's order, but head-to-head-vs-incumbent gives the same order, so the pool
does not correlate *better*. This is the F19 mechanism confirmed at full strength: on a
transitive pool the Bradley-Terry fit has one consistent global order to recover, which
the marginal-vs-incumbent view already exposes. Population play would only add signal with
a **non-transitive** member (strong vs its training opponent, weak vs another style); none
of our current strategy families — random, greedy, heuristic, alphabeta, the MCTS tiers,
or the champion — plays that role. (Earlier caveat retracted: a partial-data n=112 pool
made mcts-30 ≈ alphabeta vs the incumbent look like a tie the pool broke; at n=200 the gap
is real and the apparent win was sampling noise — M1, again.)

**Decision:** **no-win** on the pre-registered bar — pool Elo neither reorders/separates a
head-to-head tie nor correlates better with AE19; the pool is a transitive ladder, so
head-to-head-vs-incumbent is a sufficient ranker for our current bots. Informative
negative, confirms/extends [F19](../FINDINGS.md). The **harness + sharding infra ship
regardless**, and the run's real product is the **champion-anchored Elo ladder** itself:
it gives product **P13** its ceiling anchor (champion 2056) and per-tier ratings, and is a
front-end surface in its own right (bot strength in the difficulty picker / a future arena
mode). AE21 closes no-win with that as its `Deploys as:`. No shipped default changes, so no
replication or staleness debt. A deliberately non-transitive pool (e.g. two heuristics
tuned to beat different opponents) remains the only way this bar could still be met — not
queued; speculative.

---

### Run X — Duo external anchor: our tiers on Pentobi's Duo ladder (AE29)
The M5 anchor that opens the Duo track. [F14](../FINDINGS.md) placed our tiers on
Pentobi's ladder in 4p Classic only; Duo shipped to players with every bot constant
inherited from Classic and its strength entirely unmeasured. Question: where does each
shipped tier sit on Pentobi's **Duo** ladder, and how much does the Classic-tuned
configuration lose in transfer?

**Setup.** Extended the AE19 GTP bridge from Classic-only to variant-parameterized
(this entry's own work): `pentobi/coords.ts` takes a **required** `size` argument
(Classic 20 / Duo 14) instead of a hardcoded 20-based map, `moveToPlacement` reads
`boardSizeOf(G)`; `pentobi/arena.ts` drives seats/colors/mode from the variant via
`playColorsOf` + `VARIANTS` (its P55 "Classic by design" lint exemption removed —
the file is genuinely variant-aware now); `pentobi/run.ts` gained `--variant=duo`
and a config `"variant"` field. Duo GTP conventions were **probed from the binary,
not assumed**: 14×14, columns a–n, rows from the bottom, start points e10=(4,4) and
j5=(9,9) — identical to our `DUO_START_CELLS` — and our color names `black`/`white`
are accepted GTP color tokens directly, so no remap was needed. Configs
`scripts/experiments/ae29-{heuristic,extreme-L1}.json` (`"variant":"duo"`), levels
swept with `--level`. 1v1, seats rotated per game, seed-averaged 2 seeds × 100 games
= **n=200 per pairing**; game-share vs a 50% null, Wilson CIs from `stats.py`.
Replay verification (every Pentobi move must resolve to one of our legal moves) ran
on all 1400 bridged games and **threw zero times** — the mapping correctness gate.

**Results.** Game-share of *our* tier vs each Pentobi Duo level, n=200 each:

| our tier              | vs L1                  | vs L2                  | vs L3                  | vs L4        |
|-----------------------|------------------------|------------------------|------------------------|--------------|
| easy (heuristic)      | 9.2% [6.0, 14.1]       | 0.8% [0.2, 3.2]        | 0.0% [0.0, 1.9]        | 0.0%         |
| extreme (500 iters)   | **52.8% [45.8, 59.6]** | 35.5% [29.2, 42.3]     | 14.8% [10.5, 20.3]     | not run      |

Extreme = the shipped config: 500 iterations, beam 20, `rolloutSamples` 48,
`rankRewardWeight` 0.25. Side-by-side with the Classic ladder (F14, 4p 2v2):
easy 21.2% → **9.2%** vs L1; extreme 61.8% (CI-clear win) → **52.8%** (inconclusive)
vs L1, and ~45.3% (directional even) → **35.5%** (CI-clear loss) vs L2.

**Read.** Against the pre-registered criterion — the highest level each tier beats
CI-clear — the answer for **both measured tiers is "none."** Easy is crushed by L1
(CI upper bound 14.1%, nowhere near 50%) and is effectively zero from L2 up. Extreme
is **statistically even with Duo L1** (CI [45.8, 59.6] spans 50%, one-sided p=0.22 —
inconclusive, not a win) and loses CI-clear to L2 and L3. So the entire shipped
ladder tops out at *level-1-equivalent* on Duo.

The transfer readout the entry asked for: our tiers land roughly **one Pentobi level
lower on Duo than on Classic**. Extreme moves from "beats L1 CI-clear, even with L2"
(Classic) to "even with L1, loses L2 CI-clear" (Duo); easy's share vs L1 more than
halves. **Caveat, stated rather than glossed:** the Classic figures are 4p 2v2 *team*
shares and these are 1v1 — both null at 50%, but they are different game structures,
so "one level lower" is a comparison of **ladder placement**, not of a strictly
matched statistic. The direction is consistent across two independent tiers and large
in the extreme tier's case; the precise size of the loss is not established by this
run.

Mechanism is not isolated here, but the difficulty-tier doc already names three
Classic-scoped constants that cannot transfer as written (M6): `rankRewardWeight`
is provably inert at two colors (the rank term collapses onto the winner term at
n=2), `beam ≈ iters/6` encodes a branching factor that moves with board size and
opponent count, and the reward ranks by *placed squares* — the winner under basic
scoring, not under Duo's advanced-only scoring. Any of these could carry the loss;
this run does not attribute it.

**Coverage gap (not a silent omission).** Only the two *fixed-compute* tiers were
placed. The shipped `medium`/`hard` tiers are **time-budget** (500 ms / 2000 ms per
move), so their strength is machine-dependent and not reproducible from a log — the
same reason AE19 recorded fixed-iteration configs on Classic. Placing them needs a
wall-clock-controlled batch (or fixed-iteration proxies, which would be a different
thing than the shipped tier); left to a follow-up.

**Decision:** **won** as a measurement — the Duo ladder now has an external readout
(`npm run arena:pentobi -- --variant=duo`), replay-verified, and AE30/AE31 have an
outside-world number to move rather than a self-relative one. The substantive finding
is that Duo strength is *worse than Classic strength*, which is what M5 exists to
catch before a track starts tuning against itself. No shipped default changed, so no
replication or staleness debt is incurred by this run. Timing note for sizing later
Duo work: extreme ≈ 20 s/game at 500 iters (n=200 ≈ 67 min/pairing, single-threaded);
the heuristic ladder is seconds.

---

### Run Y — Duo bot re-tune: do the Classic-tuned beam and heuristic weights transfer to 14×14? (AE30)

**Date:** 2026-07-27 · **Config:** `scripts/experiments/ae30-phase1.ts`,
`ae30-{medium-b16,medium-b42,medium-b24,hard-b48,hard-b158}.json`,
`ae30-ladder-*.json`, `ae30-w-*.json`, driver `ae30-sweep.sh`.
All arena runs are Duo 1v1, fixed-iteration (shardable; see the substitution note below).

**Phase 1 — measurement (seeds 42/43/44, heuristic self-play).**

| | Classic (4p, 20×20) | Duo (2p, 14×14) |
|---|---|---|
| game length | 74 plies | 31 plies |
| branching, peak | 781 @ ply 12 | **950 @ ply 4** |
| medium — iters/move @ 500 ms | 39 | **247** |
| hard — iters/move @ 2000 ms | 155 | **955** |
| extreme — ms/move @ 500 iters | 5973 | 1549 |

`iters/beam` drift Duo vs Classic: medium **6.4×**, hard **6.2×** (Phase-2 gate was >2×).

**Phase 2 — beam sweep.** Screen n=200/matchup (directional, M1); confirmation n=600
on independent seeds (base-seed offset 100, no overlap with the screen).

| stage | matchup | n | game-share | Wilson 95% CI |
|---|---|---|---|---|
| screen | medium b16 vs b6 | 200 | 64.2% | [57.4, 70.6] |
| screen | medium **b42** vs b6 (*F8's iters/6*) | 200 | 41.0% | [34.4, 47.9] |
| screen | hard b48 vs b16 | 200 | 48.8% | [41.9, 55.6] |
| screen | hard **b158** vs b16 (*F8's iters/6*) | 200 | 18.0% | [13.3, 23.9] |
| bracket | medium b24 vs b6 | 200 | 54.2% | [47.3, 61.0] |
| **confirm** | medium **b16 vs b6** | 600 | **58.6%** | **[54.6, 62.5]** |
| pooled | medium b16 vs b6 | 800 | 60.0% | [56.6, 63.3] |

**Phase 2b — ladder monotonicity (criterion (a)), n=600 each, seeds offset 500.**

| step | matchup | game-share | Wilson 95% CI | verdict |
|---|---|---|---|---|
| 1 | medium-b16 vs easy | 95.8% | [93.8, 97.1] | clear |
| 2 | hard vs medium-b16 | 76.1% | [72.5, 79.3] | clear |
| 3 | **extreme vs hard** | **49.8%** | **[45.8, 53.8]** | **not clear — flat** |

**Phase 3 — weight ablation (heuristic vs heuristic, 50 games × 12 seeds).**

| arm | n | game-share vs full | Wilson 95% CI |
|---|---|---|---|
| **no-block** (`block: 0`) | 600 | **75.7%** | [72.1, 78.9] |
| no-block, replication (seeds 500+) | 600 | 74.9% | [71.3, 78.2] |
| no-block, pooled | 1200 | **75.3%** | [72.8, 77.6] |
| no-center (`center: 0`) | 600 | 53.0% | [49.0, 57.0] |
| frontier-10 | 600 | 53.2% | [49.2, 57.2] |

**Substitution note (stated, not glossed).** The ladder steps run each tier at the
*fixed iteration count Phase 1 measured for its Duo time budget* (medium 250, hard 950;
extreme is fixed-iteration already), not at the shipped `timeBudgetMs`. Time-budgeted
seats are machine-dependent and cannot be sharded or reproduced from a log — the same
constraint Run X recorded. This makes the ladder reproducible at the cost of pinning
throughput to this machine; a wall-clock-controlled ladder would be a different run.

**Read.** Three of the entry's own premises did not survive contact.

1. **Branching does not collapse on Duo — it peaks higher** (950 vs Classic's 781).
   The hypothesis attributed the `iters/beam` drift to collapsing branching; the drift
   is real (6.4×/6.2×) but comes entirely from the *other* input: 31-ply games mean
   rollouts terminate far sooner, so the same millisecond budget buys ~6× the iterations.
   Conclusion survived, stated mechanism did not.
2. **F8's `beam ≈ iters/6` does not extrapolate.** It prescribes beam 42 (medium) and
   158 (hard) at Duo's measured iteration counts; both *lose*, 158 catastrophically
   (18.0%). Yet medium's shipped beam 6 genuinely is too small — 16 beats it CI-clear
   at n=600, and the bracket completes a unimodal curve 6 → **16** → 24 → 42. The
   optimum sits near 16 at *both* 250 and 950 iterations, so beam tracks something
   other than iteration count on this board. F8's rule is Classic-local, not a law.
3. **`block` is not more valuable in Duo — it is actively harmful.** The entry reasoned
   that corner-denial against one decisive opponent should matter *more* than against
   three diffuse ones. Measured, deleting the term wins 75.3% pooled over n=1200. This
   is the largest single effect in the run, and it is the opposite of the prediction.
   `center` and `frontier` are inconclusive at n=600 — F2's Classic reading ("`center`
   ≈ noise") transfers unchanged.

Criterion (a) **fails at the top step**: extreme and hard are statistically
indistinguishable on Duo (49.8%, CI spans 50). Phase 1 gives the mechanism — hard
completes **955** iterations per move inside its 2000 ms budget while extreme is pinned
to a fixed **500**, so on a 14×14 board the tier above searches *less*. This is not
caused by the beam change (it reproduces with hard at its inherited beam 16); it is
extreme's fixed iteration count being a Classic-scoped constant.

**Deployment constraint found while measuring.** `mcts.ts` reads the module constant
`WEIGHTS` directly for beam ordering (:193) and the rollout policy (:422). A per-variant
weight vector is therefore **not** a config change — it needs weights threaded through
`MctsConfig`. Phase 3's win is measured at the heuristic level (the `easy` tier and the
move-ordering/rollout signal); carrying it into medium/hard/extreme requires that code
change first, and a re-measurement after it.

**Decision.** Split, and deliberately not closed as a single verdict — criterion (b) is
met twice over while pre-registered criterion (a) fired its fail condition:
- **adopt** medium beam 6 → 16 on Duo (58.6% at n=600, replicated across two independent
  seed batches, lower bound 54.6% > the 52% bar);
- **adopt** `block: 0` on Duo at the heuristic level (75.3% pooled, n=1200, replicated);
- **hold** `center` and `frontier` at their Classic values (inconclusive);
- **hold** hard's beam 16 (48 is a coin-flip, 158 loses) — it transfers unchanged;
- the extreme/hard flat step is a **new** defect with a named mechanism, not a result
  this entry can absorb; it needs its own entry and its own pre-registered bar.

---

### Run W3 — Regenerating the Classic pool ladder: does it still reproduce? (AE21 / product P62)
Not a hypothesis test — a **verification + evidence-recovery run**, appended out of letter
order because it continues the W thread rather than opening a new question. AE21 stays
closed `no-win`; nothing here revisits its pre-registered bar.

Two reasons it was run. (1) The shards behind [Run W2](#run-w2--diverse-pool-round-robin-does-pool-elo-beat-head-to-head-on-the-full-pool-ae21)
were written to an uncommitted scratch dir and had been deleted, so W2's published ladder
could not be recomputed by anyone. (2) Product P62 needed the ladder as a committed,
machine-readable artifact, which meant it needed evidence to be fit *from*.

**Setup.** Identical to W2 by construction — same `pool.json` members and options, same
scripts (since renamed `pool-sweep.sh` / `pool-champion.sh` / `pool-report.ts`), same
baseSeeds. **Sweep A** champion-free 6-member pool, 50 seed-batches × 4 games = n=200/pair
(wall 4 h 01 m, 52.7 CPU-h measured via `time`, 16 cores). **Sweep B** champion vs each of
the 6, 40 seed-batches × 1 game = n=40/pair (wall ~2 h 35 m, clock-derived — this stage was
not wrapped in `time`, so its CPU total is unmeasured). Classic 20×20 4p, mirrored 2v2.
290 `.result` shards, now committed at `scripts/experiments/pool-shards/`.

**Results.** The re-fit is **identical to W2**, not merely consistent with it:

| bot          | W2 pool Elo | W3 pool Elo | W2 vs incumbent    | W3 vs incumbent    |
|--------------|-------------|-------------|--------------------|--------------------|
| champion ♛   | 2056        | **2056**    | 93.3% [81.2, 97.8] | 93.3% [81.2, 97.8] |
| mcts-150     | 1796        | **1796**    | 82.8% [77.0, 87.4] | 82.8% [77.0, 87.4] |
| mcts-30      | 1683        | **1683**    | 66.1% [59.3, 72.3] | 66.1% [59.3, 72.3] |
| alphabeta-d2 | 1587        | **1587**    | 55.5% [48.6, 62.2] | 55.5% [48.6, 62.2] |
| heuristic ⚑  | 1549        | **1549**    | —                  | —                  |
| greedy-size  | 1215        | **1215**    | 13.8% [9.7, 19.2]  | 13.8% [9.7, 19.2]  |
| random       | 615         | **615**     | 0.0% [0.0, 1.9]    | 0.0% [0.0, 1.9]    |

Every rating matches to the point and every vs-incumbent cell to the decimal. All 42
ordered cells are now recorded in the artifact; W2's record had preserved 11.

**Probe (separate, deliberately throwaway).** To exercise P62's incremental
recalibration path end-to-end, an 8th member (a `greedy-size` clone, n=2/pair) was added
and the ladder re-fit, then reverted. It reused all 290 existing shards and wrote 14 new
ones (7 pairs × 2 batches, 3 m 39 s) — confirming the cache makes an addition cheap. It
also moved **every** established rating: champion 2056→2060, mcts-150 1796→1805, mcts-30
1683→1692, i.e. +4 to +20 Elo with no bot changed.

**Read.** The engine has not drifted under W2's numbers: an exact reproduction across a
full independent re-run rules out any change to Classic play, move generation, or the
MCTS tiers in the interval. The determinism is by design (seeded mulberry32, fixed-
iteration members) but had never been demonstrated at this scale. The probe's rating shift
is the mean-centering property of the Bradley-Terry fit, not instability.

**Decision.** No status change — AE21 remains closed `no-win`, and no strategy claim is
added or retracted. [F19](../FINDINGS.md) gains a reproduction note; the ladder is now the
committed artifact `src/game/ai/ladder/classic.json`, held against both `pool.json` and
these shards by `tests/ladder-artifact.test.ts`. Two method lessons distilled to FINDINGS:
[M7](../FINDINGS.md) (a pool rating is population-relative — the probe's numbers) and
[M8](../FINDINGS.md) (keep a heavy run's evidence, or its result is unfalsifiable — this
run's whole reason for existing).
