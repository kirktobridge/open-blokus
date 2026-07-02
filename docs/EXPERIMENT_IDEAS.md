# Experiment ideas (deferred)

A backlog of AI/engine ideas worth trying but intentionally *not* done yet, so the
current work stays scoped. Findings from things we *have* run live in
[AI_EXPERIMENTS.md](AI_EXPERIMENTS.md); this file is the "not yet" list.

## Difficulty → beam scaling

Right now difficulty tiers map to **time budget only** (Easy = heuristic, Medium
≈ 500 ms MCTS, Hard ≈ 2000 ms MCTS). MCTS also has a `beam` (per-node action
pruning to the heuristic's top-K). **Test whether tiers should also scale `beam`**
— e.g. a wider beam at Hard explores more candidate moves per node, which may
matter more than raw time on positions with many strong options. Benchmark
`beam ∈ {10, 16, 24, all}` at a fixed budget vs the heuristic, and beam×budget
interactions. Keep time-only until measured.

## Tree reuse across turns — implemented, but ~0 benefit in 4p (measured)

Persist the search tree between moves and re-root at the actually-played line
(`mctsSearch` + `reRoot`, worker holds a tree per color). The mechanism is correct
(unit-tested), but **measured reuse hit rate in 4p is ~0–5%** at 100–600
iterations: your next turn is 4 plies deep (your move + three opponents) in a
beam-16-wide tree, so the exact played line is almost never still in the tree, and
when it is it carries ~0 extra visits. Kept because it's correct, zero-cost on a
miss (falls back to a fresh tree), and **should pay off in 2-player mode** (only 2
plies to your next turn) or at much larger budgets. Revisit if/when 2p AI lands or
budgets grow. Don't invest more in it for 4p.

## RAVE / AMAF

All-Moves-As-First value sharing to warm up UCT estimates from rollout move
statistics. Standard MCTS acceleration; an approximation (Option B) that usually
helps early in the search. Measure vs plain UCT at equal budgets.

## Bitboard move generation

Beyond the anchor-restricted `generateLegalMoves` (Phase 2): represent occupancy
and per-color corner/edge masks as bit words and compute legality with bitwise
ops. Same results, potentially far faster — but a larger rewrite of the rules
core. Only if the anchor optimization still isn't enough for the time budget.

## Learned eval / policy

A small value/policy net to (a) prior the tree (replace/augment the heuristic
beam) and (b) replace expensive full rollouts — which Runs H–I show are the
strength driver — with a cheap strong estimate. Biggest potential win, biggest
effort.

## Push the budget ladder to saturation

Run I stopped at `it=320/d=0` (90.1%), still climbing (+5 pts/doubling). Run
`it=640/d=0` (and beyond) to find where MCTS strength vs the heuristic plateaus.
Pure benchmarking; slow.

## Mode coverage for MCTS

All AI runs are 4-player. 2p (one human steers two colors) and 3p (shared color)
have different reward structures — the placed-leader reward and per-color backup
need revisiting for those modes.
