# AI strategy experiments

Running log of CPU-strategy research: what we tried, how, and what we found.
The harness is the headless arena in [src/game/ai/arena.ts](../src/game/ai/arena.ts)
(`npm run arena [games] [seeds] [baseSeed]`, runner
[arena.cli.ts](../src/game/ai/arena.cli.ts)). Inspired by
[cchung89/Blokus_Game_Solver](https://github.com/cchung89/Blokus_Game_Solver).

This is a **research log, not a spec** — it records the *why* behind the bot's
tuning. The heuristic itself lives in
[src/game/ai/heuristic.ts](../src/game/ai/heuristic.ts); rules in
[GAME_SPEC](GAME_SPEC.md). Append new runs at the bottom; don't rewrite history.

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
| `alphabeta-dN` | depth-N paranoid alpha-beta with beam pruning ([alphabeta.ts](../src/game/ai/alphabeta.ts)) |
| `mcts` | maxn UCT Monte-Carlo Tree Search ([mcts.ts](../src/game/ai/mcts.ts)) |

`size` = piece squares; `frontier` = new legal corner attach-points gained;
`center` = pull toward board center; `block` = our cells diagonal to an opponent.

## Trial count

≈ **6,250 games** across the nine documented runs below (4-player, basic
scoring): A–C ≈ 1,520 (heuristic tuning), D ≈ 100 (alpha-beta), E ≈ 850 (eval
sweeps), F ≈ 130 (beam-confound / pure eval), G ≈ 130 (territory feature),
H ≈ 2,450 (MCTS budget sweep), I ≈ 990 (MCTS full-rollout scaling). The CI suite ([tests/arena.test.ts](../tests/arena.test.ts),
[alphabeta.test.ts](../tests/alphabeta.test.ts)) also plays ~180 games every
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

Maxn UCT MCTS ([mcts.ts](../src/game/ai/mcts.ts)): per-color reward vectors so
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

## Conclusions (noise-aware)

- **heuristic ≫ greedy-size ≫ random.** Large, stable, replicated.
- **`frontier` is the load-bearing term.** `no-frontier` → 15.5%, far outside
  any error band. Own-mobility is what raw size ignores.
- **`block` = mild win** (~4 pts, within ±std). Real-ish, small.
- **`center` ≈ noise.** `full` and `no-center` overlap completely. Earns ~nothing
  (probably because it's averaged over the whole game, not just the opening).
- **`frontier: 3` stays.** Whole sweep overlaps in error; only `f=10` clearly
  worse (overweighting position starves the size term).

### vs cchung89

They found *simple greedy beat their "advanced" (size + corner-diff) greedy*; we
find the opposite. Likely because their corner term was **blended into one
metric, possibly miscounted (ignoring the ortho-adjacency rule), possibly
overweighted** vs size, and judged only **against random** (which compresses the
gap between two strong bots). We keep terms separate, size-dominant, and measure
head-to-head with seed-averaging — and positional play wins clearly. Our own
`f=10` result is direct evidence that overweighting the positional term hurts,
which is the trap that likely bit their "advanced" bot.

## What's likely played out vs still open

**Played out (diminishing returns):** single-weight sweeps of the existing four
terms at one ply. Differences now sit inside the ±5–11 pt noise band; resolving
them needs far more games for little payoff. `center` and `block` are settled as
near-noise/mild.

**Tried, no win (Runs D–F):** depth-2 alpha-beta (D), a depth-1 weight-tuned eval
(E), and an *unconfounded* pure eval (F, beam=all) all land at 47–55% vs the
heuristic — statistically indistinguishable, at up to ~100× cost. Run F is the
clincher: removing the heuristic-ordered-beam confound did **not** surface a
better eval. So with the current features — size/placed, frontier/mobility,
block, center — **the tuned heuristic is at or near the ceiling.** Reweighting,
deeper search, and eval-ordering are all played out.

**Tried, no gain (Run G):** Voronoi territory control — neutral-to-harmful at
every weight. A coarse nearest-piece space partition doesn't beat what `frontier`
already encodes. First hand-crafted *new feature* tried; it didn't move the
ceiling either.

**Broke the ceiling, then ran away with it (Runs H–I):** maxn MCTS beats the
heuristic significantly (`it=80/d=8` 54.6%, p = 0.0007, n = 1,200) and *scales
with compute* — the opposite of the D–G plateau. With **full rollouts** it climbs
to **90%** (`it=320/d=0`, Run I), decelerating toward a mid-90s ceiling. Rollout
*quality* is the dominant lever (a 29-pt swing at fixed `it=40`), iterations
stack on top. It's slow (~100–1000× the heuristic).

**Still open:**
- **Ship MCTS as the "hard" offline bot** (ARCHITECTURE §9) with a per-move *time
  budget* and **full rollouts** (Runs H–I: `d=0` ≫ truncated; spend the budget on
  iterations). This is the concrete payoff of the whole D–I arc.
- **Make MCTS faster** so more iterations fit the time cap (each doubling still
  adds ~5 pts). Biggest win: an incremental / cached `generateLegalMoves` (the
  ~34 ms mid-game bottleneck); then RAVE/AMAF and tree reuse across moves.
- **Learned eval / policy** — a value net would replace the expensive full
  rollouts (the strength driver) with a cheap strong estimate.
- **Mode coverage** — all runs are 4p. 2p (you steer two colors) and 3p (shared
  color) have different blocking dynamics, untested.
