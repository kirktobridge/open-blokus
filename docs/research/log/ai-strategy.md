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
