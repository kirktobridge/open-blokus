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

`size` = piece squares; `frontier` = new legal corner attach-points gained;
`center` = pull toward board center; `block` = our cells diagonal to an opponent.

## Trial count

≈ **1,520 games** across the three documented runs below (4-player, basic
scoring). The CI suite ([tests/arena.test.ts](../tests/arena.test.ts)) also
plays ~160 games every `npm test` as a regression guard (heuristic must beat
random; tournaments must be deterministic per seed).

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

**Still open (where real gains likely are):**
- **Search-based strategies** — alpha-beta depth-2/3, MCTS. A different algorithm
  class, not a reweighting; the next genuinely discriminating opponent.
- **New features** — opponent-mobility reduction (not just corner denial),
  reachable-territory / region control, piece *flexibility* value (hoard X5/Z5
  for tight late-game spots) beyond raw square count.
- **Phase-dependent weights** — `center` is near-noise when averaged whole-game
  but plausibly matters only in the opening; split early/mid/late.
- **Mode coverage** — all runs are 4p. 2p (you steer two colors) and 3p (shared
  color) have different blocking dynamics, untested.
