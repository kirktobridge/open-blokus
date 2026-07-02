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

## Tree reuse across turns (implemented as Phase 4 — measure the gain)

Persist the search tree between moves and re-root at the actually-played line
instead of rebuilding. Pure optimization → more effective iterations per budget.
Once built, **measure the strength gain** at a fixed time budget (iterations/move
should rise; game-share vs heuristic should tick up).

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
