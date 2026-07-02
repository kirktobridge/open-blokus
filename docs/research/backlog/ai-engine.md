# Backlog — AI & engine

Planned/deferred AI and engine experiments, each structured per
[../FRAMEWORK.md](../FRAMEWORK.md). Findings from things already run live in
[../FINDINGS.md](../FINDINGS.md); raw runs in [../log/ai-strategy.md](../log/ai-strategy.md).
This is the "not yet / open threads" list — keeping current work scoped.

Ordered roughly by expected payoff. Status vocabulary: `proposed` / `deferred` /
`no-win` / `played-out` (see FRAMEWORK).

---

### AE1 — Ship MCTS as the "hard" offline bot
- **Status:** proposed (highest priority — the concrete payoff of the whole Run D–I arc)
- **Objective:** turn the winning MCTS config into the deployed Hard difficulty.
- **Hypothesis:** a per-move *time-budget* MCTS with **full rollouts** gives a
  clearly-stronger-than-heuristic bot at an acceptable move latency (F6).
- **Method:** wire the time-budget MCTS into [src/client/ai/difficulty.ts](../../../src/client/ai/difficulty.ts)
  (Easy = heuristic, Medium/Hard = MCTS budgets); verify move latency on real
  positions; regression-play vs heuristic to confirm the shipped config still wins.
- **Success criteria:** Hard beats heuristic (game-share CI clear of 50) within the
  chosen move-time cap; latency acceptable in-app.
- **Cost / risk:** integration work; MCTS is ~100–1000× the heuristic so latency is
  the real constraint (drives AE2).
- **Log:** — (Phase 1 time-budget mode + heuristic fallback already committed)

### AE2 — Make MCTS faster (more iterations per time cap)
- **Status:** proposed (biggest lever on shipped strength — each budget doubling ≈ +5 pts)
- **Objective:** raise iterations-per-second so more search fits the AE1 time cap.
- **Hypothesis:** an incremental / cached `generateLegalMoves` removes the ~34 ms
  mid-game bottleneck; strength rises with the extra iterations bought.
- **Method:** cache/incrementalise legal-move generation (beyond the anchor
  restriction, F7); benchmark iterations/s and game-share at a fixed time budget.
- **Success criteria:** measurable iters/s gain with byte-identical move output
  (differential test), translating to higher game-share at fixed wall-clock.
- **Cost / risk:** moderate rules-core work; correctness guarded by differential test.

### AE3 — RAVE / AMAF value sharing
- **Status:** proposed
- **Objective:** warm up UCT estimates from rollout move statistics (All-Moves-As-First).
- **Hypothesis:** RAVE (Option B approximation) helps early in the search, buying
  strength at equal iteration budget — standard MCTS acceleration.
- **Method:** add AMAF stats to the tree; benchmark vs plain UCT at equal budgets.
- **Success criteria:** game-share gain vs plain UCT at matched iterations, CI clear.
- **Cost / risk:** moderate; pure algorithmic change, benchmarkable in the arena.

### AE4 — Learned eval / policy net
- **Status:** proposed (biggest potential win, biggest effort)
- **Objective:** replace expensive full rollouts (the F6 strength driver) with a
  cheap strong estimate, and/or prior the tree to replace the heuristic beam.
- **Hypothesis:** a small value/policy net gives near-full-rollout strength at a
  fraction of the cost, breaking the latency ceiling that caps AE1.
- **Method:** train on self-play game logs (depends on game-logging, see
  [advisor.md](advisor.md)); use net as (a) tree prior and (b) rollout replacement;
  benchmark vs full-rollout MCTS at matched wall-clock.
- **Success criteria:** matches/beats full-rollout MCTS strength at lower latency.
- **Cost / risk:** large — training pipeline + data. Blocked on logging infra.

### AE5 — Difficulty → beam scaling
- **Status:** proposed
- **Objective:** decide whether difficulty tiers should scale MCTS `beam`
  (per-node action pruning) in addition to time budget.
- **Hypothesis:** a wider beam at Hard explores more candidate moves per node and
  may matter more than raw time on positions with many strong options.
- **Method:** benchmark `beam ∈ {10, 16, 24, all}` at a fixed budget vs heuristic;
  measure beam×budget interactions.
- **Success criteria:** a beam setting that beats time-only at matched wall-clock.
- **Cost / risk:** pure benchmark. Keep time-only until measured.

### AE6 — Push the budget ladder to saturation
- **Status:** proposed (pure benchmarking; low priority)
- **Objective:** find where MCTS-vs-heuristic strength plateaus.
- **Hypothesis:** Run I stopped at `it=320/d=0` (90.1%), still climbing +5 pts/
  doubling — the ceiling is mid-90s.
- **Method:** run `it=640/d=0` and beyond, same sharded harness + pooled binomial stats.
- **Success criteria:** N/A (measurement) — identify the plateau.
- **Cost / risk:** slow; no code change.

### AE7 — MCTS mode coverage (2p / 3p)
- **Status:** deferred (blocked on 2p/3p AI actually landing)
- **Objective:** validate MCTS reward + backup for non-4p modes.
- **Hypothesis:** 2p (one human steers two colors) and 3p (shared color) have
  different reward structures — placed-leader reward and per-color backup need
  revisiting.
- **Method:** extend arena to 2p/3p; rerun the budget sweep per mode.
- **Success criteria:** MCTS beats heuristic in each mode, CI clear.
- **Cost / risk:** moderate; also unblocks AE8's tree-reuse revisit.

### AE8 — Tree reuse across turns (revisit in 2p)
- **Status:** deferred (implemented; **no-win in 4p, measured** — kept, correct, zero-cost on miss)
- **Objective:** determine whether persisting + re-rooting the search tree between
  moves pays off outside 4p.
- **Hypothesis:** reuse hit-rate is ~0–5% in 4p (your next turn is 4 plies deep in a
  beam-16 tree, so the played line is almost never still present), but should pay in
  2p (only 2 plies to your next turn) or at much larger budgets.
- **Method:** `mctsSearch` + `reRoot` already exist and are unit-tested; measure
  reuse hit-rate and game-share in 2p once AE7 lands.
- **Success criteria:** non-trivial reuse hit-rate + strength gain in 2p.
- **Cost / risk:** none new (mechanism exists). **Don't invest more for 4p.**

### AE9 — Bitboard move generation
- **Status:** deferred (only if the anchor optimization isn't enough for the time budget)
- **Objective:** faster legality checks via bitwise ops.
- **Hypothesis:** representing occupancy + per-color corner/edge masks as bit words
  computes legality far faster than the current scan, same results.
- **Method:** rewrite the rules-core legality path on bitboards; differential-test
  vs the current implementation; benchmark.
- **Success criteria:** large iters/s gain, byte-identical output.
- **Cost / risk:** large rewrite of the rules core. Only pursue if AE2 falls short.
