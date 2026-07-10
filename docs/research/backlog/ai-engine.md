# Backlog — AI & engine

Planned/deferred AI and engine experiments, each structured per
[../FRAMEWORK.md](../FRAMEWORK.md). Findings from things already run live in
[../FINDINGS.md](../FINDINGS.md); raw runs in [../log/ai-strategy.md](../log/ai-strategy.md).
This is the "not yet / open threads" list — keeping current work scoped.

Ordered roughly by expected payoff. Status vocabulary: `proposed` / `deferred` /
`won` / `no-win` / `played-out` (see FRAMEWORK).

---

## Next up

The dependency-ready head, highest-payoff first — the authoritative "what to run next."
Refreshed by /research at close (Phase 4) and intake (Phase P); product P22. The schema
test (product P21) fails CI if any ID here is missing or terminal.

1. **AE26** — rollout width (`rolloutSamples`): AE11's control arm hit 54.4% and the
   knob already exists — cheapest live lead on the board (F16).
2. **AE24** — trained softmax move priors: the main share of the ~17× per-simulation
   quality gap vs Pentobi (F14). F16 sharpens it — priors must beat *width*, not the
   old 6-sample baseline.
3. **AE17** — root-parallel workers: cheapest compute multiplier once per-sim
   quality is fixed; no deployment changes needed.
4. **AE21** — population-play Elo: the anchor-pool readout that unlocks product P13.

---

### AE1 — Ship MCTS as the offline bot — SHIPPED
- **Status:** won / shipped — four-tier ladder in
  [difficulty.ts](../../../src/client/ai/difficulty.ts), measured monotonic
  (Runs J / J-confirm / K), every step CI-clear of 50.
- **Log:** Runs D–K → [F6, F8](../FINDINGS.md). Product follow-ups (long-move UX,
  bot-fill) → [product backlog](../../product/BACKLOG.md); open research levers →
  AE2 / AE9.

### AE2 — Make MCTS faster (more iterations per time cap)
- **Status:** proposed (partly banked — the anchor optimization already shipped a
  **~16× move-gen speedup**, F7/Run J engine note; this entry is now the *further*
  gains beyond that. Still valuable: each budget doubling ≈ +5 pts, and F8 showed
  medium is iteration-starved early game.)
- **Note:** Run N / F10 profile confirms the gen/legality path is the bottleneck
  (~75 % of MCTS time). This entry (cache/incrementalise) and **AE9 (bitboards)**
  target the same hot path; AE9 is the sharper tool — but the sub-items below are
  days-not-weeks, assumption-free, and partially subsumed by AE9 (do them first
  only if AE9 isn't imminent).
- **Objective:** raise iterations-per-second so more search fits the AE1 time cap.
- **Hypothesis:** allocation churn and redundant geometry work — not just the scan
  itself — are a large share of the F10 hot path; removing them buys iterations
  with zero behavior change.
- **Method:** concrete sub-items (post-Run-O code audit, 2026-07-06), each
  differential-tested + profiled via `scripts/profile-mcts.ts`:
  1. **Allocation-free neighbor iteration** — `orthoNeighbors`/`diagNeighbors`
     ([board.ts](../../../src/game/board.ts)) allocate 4 `{x,y}` objects + an array
     per call; one pentomino legality test ⇒ ~40 short-lived objects, and
     `isLegalPlacement` is 31 % of self-time (F10). Replace with precomputed flat
     index offsets (`i±1`, `i±20`, edge-guarded by `x`). Largely subsumed by AE9.
  2. **`resolveCells` memoization** — [pieces.ts](../../../src/game/pieces.ts)
     re-runs reflect→rotate→normalize per call despite `getOrientations`' cache;
     `scorePlacement` re-resolves geometry for every candidate the generator just
     produced. Reduce to cached-orientation + translate, or carry cells with
     `Placement` inside search. Not subsumed by AE9.
  3. **Rollout scratch state** — each MCTS iteration clones twice (expansion +
     `rollout`); the rollout clone can be one reusable mutable scratch. Smaller win.
- **Success criteria:** measurable iters/s gain with byte-identical move output
  (differential test), translating to higher game-share at fixed wall-clock.
- **Cost / risk:** small per item (an afternoon each); correctness guarded by
  differential test. Risk: #1 wasted if AE9 lands immediately after.

### AE3 — RAVE / AMAF value sharing
- **Status:** no-win — 54.0 % game-share vs plain UCT at matched iters,
  CI [49.1, 58.8], n=400; bar (CI clear) not met. Kept behind `rave:false`
  (default, zero-cost); revisit only at other budgets.
- **Log:** [Runs L+M](../log/ai-strategy.md) → [F9](../FINDINGS.md)

### AE4 — Learned eval / policy net
- **Status:** no-win — 27.6% game-share [24.2, 31.3] vs full-rollout MCTS at
  matched 500 ms/move, n=600; bar (CI clears 52%) missed decisively. The 609-param
  net passed its offline kill-gate (out-predicts the static eval) but a cheap leaf
  estimate is no substitute for rollout signal even at 15–100× the iterations
  (F6 reconfirmed). Infra kept at zero cost: `leafValue` hook in `mcts.ts`
  (default off), `scripts/selfplay-dump.ts` + `scripts/train-valuenet.ts`.
  Revisit only with step-change capacity (board planes / policy head /
  MCTS-quality labels), ideally after AE9 — formalized as **AE22**.
- **Objective:** replace expensive full rollouts (the F6 strength driver) with a
  cheap strong estimate, and/or prior the tree to replace the heuristic beam.
- **Hypothesis:** a small value net evaluated at the leaf gives near-full-rollout
  strength at a fraction of the cost, breaking the latency ceiling that caps AE1.
  (F10 caveat: rollouts are ~46% of search time, so the win is more iterations per
  budget, not a >2× search speedup.)
- **Method:** staged, with an early kill-gate.
  **A — data:** arena self-play dump (`scripts/selfplay-dump.ts`, JSONL of move
  lists + final scores; positions regenerated by replay through the rules core).
  Mixed heuristic-family seats for outcome diversity; seeded.
  **B — net (offline gate):** train a small value net (per-color outcome from
  hand-crafted features; pure-TS inference, weights as JSON — bots are client-side).
  *Gate:* on held-out games, mid-game winner-prediction must beat the shipped
  heuristic score used as a predictor; if not, stop (`no-win`) before integration.
  **C — arena:** plug net in as MCTS leaf eval (replacing rollouts); benchmark vs
  full-rollout MCTS at matched per-move wall-clock via
  `scripts/experiments/ae4.json`.
- **Success criteria (pre-registered 2026-07-06):** adopt if net-leaf MCTS
  game-share vs full-rollout MCTS at matched per-move wall-clock clears 52%
  (Wilson 95% CI lower bound > 52%) over ≥600 pooled games.
- **Cost / risk:** large — training pipeline + data; net inference cost may eat
  the rollout savings; F6 warns weak leaf estimates lose badly.
- **Log:** [Run O](../log/ai-strategy.md) → [F11](../FINDINGS.md)

### AE5 — Difficulty → beam scaling — SHIPPED
- **Status:** won / shipped — per-tier beam (medium 6, hard 16) in
  [difficulty.ts](../../../src/client/ai/difficulty.ts); ladder monotonic under real
  time budgets (Run J-confirm). Lesson: **beam must scale *down* with the small,
  phase-varying iteration budget** (`beam ≈ iters/6`, F8) or the low tier breaks.
- **Log:** Runs J / J-confirm → [F8](../FINDINGS.md)

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
- **Status:** won (Run P / F12) — bitboard legality is byte-identical to the scan,
  **2.48× iters/s** (997 vs 402), and at matched wall-clock (2.5× iter head-to-head)
  wins **71.4 % [67.8, 74.8]** game-share over 640 games. All three pre-registered
  gates pass. Shipped into `generateLegalMoves`/`hasAnyMove` + the MCTS rollouts;
  `isLegalPlacement` kept as the bgio/UI path + differential reference.
- **Log:** Run P → [F12](../FINDINGS.md)
- **Objective:** faster legality checks via bitwise ops.
- **Hypothesis:** representing occupancy + per-color corner/edge masks as bit words
  computes legality far faster than the current scan, same results.
- **Method:** rewrite the rules-core legality path on bitboards; differential-test
  vs the current implementation; benchmark.
- **Success criteria (pre-registered 2026-07-07, M2):** three gates —
  (1) **hard gate:** byte-identical legal-move output vs the current scan over a
  differential test (random reachable positions + full self-play games); (2)
  **≥2× iters/s** on the MCTS profile harness (`scripts/profile-mcts.ts`) vs the
  current engine; (3) **game-share Wilson CI clears 52 %** vs the current engine
  at matched wall-clock, ≥600 pooled multi-seed games. `won` requires all three;
  faster-but-not-2× or CI 50–52 % is `no-win`.
- **Cost / risk:** large rewrite of the rules core (20×20 = 400 cells → 7×`BigInt`/
  `Uint32` words, or per-row masks). Correctness guarded by differential test vs the
  current scan. See [F10](../FINDINGS.md) for the profile that justifies it.

### AE10 — Assess & tune difficulty time-budgets
- **Status:** won — latency bars pass; found the ladder inverted (medium at
  `beam=16` lost to easy) and handed the fix to AE5 (beam scaling). Strength-vs-iters
  curve banked: `it40→68 · it80→77 · it160→85 · it320→90` game-share vs heuristic.
- **Log:** Run J → [F8](../FINDINGS.md)

### AE11 — Smarter rollout policy
- **Status:** no-win — Run T / [F16](../FINDINGS.md). Score-biasing the playout
  candidates (greedy `score` 48.8% CI [44.9,52.8]; `softmax` T=8 49.3% CI [45.3,53.3],
  n=600 each) buys nothing at matched wall-clock — the 52% bar is not met and both
  point estimates sit ≤50%. The *width* control arm (candidates 6→12, size-greedy)
  did move (54.4%, CI [50.4,58.3], p=0.016) but that's a different hypothesis than
  the one this entry pre-registered → carried to **AE26**, not retrofitted here (M2).
  Config knobs `rolloutPolicy: 'score'|'softmax'` + `rolloutSamples` /
  `rolloutTemperature` kept in [mcts.ts](../../../src/game/ai/mcts.ts); defaults
  byte-identical. Cost note refuted: smarter playouts cost ~1% throughput, not more.
- **Objective:** raise leaf-estimate quality by making rollout moves smarter at
  similar cost.
- **Hypothesis:** biasing rollout samples toward frontier-creating / corner-denying
  moves (or ε-greedy over the sampled candidates with a cheap score) makes rollout
  outcomes more predictive of true value → higher strength at matched wall-clock.
  Assumption (M4): stronger rollout play → more predictive outcomes; F6's
  full-vs-truncated swing supports it.
- **Method:** variants of `rolloutMove` in `mcts.ts` behind config; arena vs current
  policy at matched 500 ms/move, `scripts/experiments/ae11.json`, ≥600 pooled games,
  multi-seed shards. **Reference spec (F14 follow-up):** Pentobi's playouts sample
  moves ∝ softmax feature gammas with *incrementally updated* per-color move lists
  (`libpentobi_mcts/State.cpp:gen_playout_move_full`, github.com/enz/pentobi) —
  the existence proof that a policy-guided playout carries L1-beating strength at
  single-digit simulation counts (Run R).
- **Success criteria:** game-share Wilson CI clears 52% vs the current rollout policy
  at matched wall-clock over ≥600 games.
- **Cost / risk:** small — ~30-line policy swaps; risk is added per-move cost eating
  the quality gain (measure iters/s alongside).
- **Log:** [Run T](../log/ai-strategy.md) (2026-07-09)

### AE12 — Move-time management (chess-clock budgeting)
- **Status:** proposed
- **Objective:** reallocate a fixed *total* game budget across moves instead of a
  flat per-move cap.
- **Hypothesis:** value-per-ms varies hugely by phase (Run O probe: 15 iters/500 ms
  at peak branching vs ~1,600 in the opening/endgame); spending more where branching
  and uncertainty are high and less on near-forced moves buys strength at identical
  total time. Assumption (M4): some moves are near-forced — true late-game, where
  the legal set collapses.
- **Method:** budget scheduler around `mctsSearch` (e.g. proportional to legal-move
  count or root-visit entropy, with floor/ceiling); arena vs flat-budget MCTS at
  matched *total* game time; ≥600 pooled games.
- **Success criteria:** game-share CI clears 52% vs flat budget at matched total
  game time; no per-move latency above a stated UX ceiling (e.g. 2× the flat cap).
- **Cost / risk:** small-moderate; scheduler only, engine untouched. Timed mode is
  nondeterministic (accepted precedent: Run J-confirm).
- **Log:** —

### AE13 — Endgame exact solver
- **Status:** proposed
- **Objective:** replace sampled search with exact search where the game tree
  becomes tractable.
- **Hypothesis:** branching collapses late (few pieces, few attach points), so
  below some threshold full-depth search is affordable and exact beats sampled.
  Assumption (M4): a tractable boundary exists — measure it first (count plies
  where full-depth alpha-beta fits the move budget).
- **Method:** phase 1 (measurement): instrument arena games for legal-move count
  and full-depth feasibility by ply. Phase 2: hybrid strategy — MCTS until the
  threshold, exact search after; arena vs plain MCTS at matched total time,
  ≥600 pooled games. Also track mean final score (exact play should convert
  endgames better even when the winner is decided).
- **Success criteria:** game-share CI clears 52% vs plain MCTS at matched time, OR
  mean score improves significantly with win-rate CI not below parity.
- **Cost / risk:** moderate — threshold detection + a solver mode; risk is the
  tractable window being too short to matter.
- **Log:** —

### AE14 — Progressive widening (replace the fixed beam)
- **Status:** proposed
- **Objective:** eliminate the hand-tuned per-tier beam (F8's `beam ≈ iters/6`)
  with a visit-driven child-admission schedule.
- **Hypothesis:** admitting children as visits accrue (k·N^α over the
  heuristic-ordered move list) self-scales breadth to any budget, matching tuned
  beams without per-tier knobs. Assumption (M4): heuristic ordering puts good moves
  early — F8's beam success shows it does.
- **Method:** widening schedule in `untriedMoves`/`treePolicy` behind config; arena
  vs the tuned fixed-beam config at each tier budget (500 ms, 2000 ms, extreme
  iters); ≥600 pooled games per comparison.
- **Success criteria:** at every tier, game-share CI overlaps or clears 50% vs the
  tuned beam (non-inferiority — the win is removing the knob); `won` only if it
  also clears 52% somewhere.
- **Cost / risk:** small code change; extra comparisons make it compute-heavy
  (3 tiers × 600 games).
- **Log:** —

### AE15 — Score-margin reward shaping
- **Status:** won (w=0.25) — Run S / [F15](../FINDINGS.md). Light rank-normalized
  shaping `(1−w)·winner + w·rankNorm` at w=0.25 improves placement (−0.24, CI clear)
  and placed squares (+1.3, CI clear) with game-share 53.2% (CI [49.4,57.1], clears
  the 48% guard); w=0.5 over-trades (game-share CI 45.4% < floor, the M4 conflict).
  Config knob `rankRewardWeight` in [mcts.ts](../../../src/game/ai/mcts.ts) (default
  0 = byte-identical). Ship as a retune-in-place per P13 (lost-position lever, not a
  new rung) → hand to /ship; also feeds AD2/AD3 a non-degenerate lost-position value.
- **Objective:** make bots fight for placement/score when the win is out of reach.
- **Hypothesis:** the winner-take-all reward leaves a losing bot indifferent
  between 2nd and 4th; blending a placed-squares-margin term into the reward
  vector improves final scores without hurting win rate. Assumption (M4) — needs
  the fit-check: early-game score-greed may conflict with win-seeking (blocking >
  placing); mitigate by weighting the margin term up only late or when P(win) is
  low.
- **Method:** shaped `rewardVector` behind config (e.g. reward = w·win +
  (1−w)·normalized margin); arena vs plain reward at matched budget; primary
  readout mean placement + mean score, guard readout game-share; ≥600 pooled games.
  **Reference form (F14 follow-up, upgrades the M4 assumption to
  reference-proven):** Pentobi's multiplayer reward is the rank-normalized result
  `rank/(n−1)` (ties averaged) plus quality bonuses
  `0.3·sigmoid(2,(score−μ)/σ)` and a `−0.12·(result−0.5)·sigmoid(...)` game-length
  term, both normalized by running search statistics
  (`libpentobi_mcts/State.cpp:get_quality_bonus`, github.com/enz/pentobi; Pepels
  et al., *Quality-based Rewards for MCTS Simulations*, ECAI 2014). Start from
  these constants; our current reward is winner-take-all placed-leader, which
  discards the 2nd-vs-4th signal entirely.
- **Success criteria:** mean placement/score improves (CI clear) while game-share
  CI does not fall below 48%.
- **Cost / risk:** small; also feeds the advisor (AD2/AD3) a less degenerate value
  signal in lost positions.
- **Log:** Run S → [F15](../FINDINGS.md)

### AE16 — Opening book
- **Status:** proposed (deprioritized for 4p Classic, 2026-07-07 — Pentobi's own
  shipped `book_classic.blksgf` is 173 *bytes* vs Duo's 22.5 KB: even the reference
  engine found books barely worth having on the 4p Classic start. The latency half
  of the objective stands; revisit the strength half with P20 M2 / Duo.)
- **Objective:** kill worst-case early-move latency (extreme tier: tens of seconds)
  and bank strength on the fixed start position.
- **Hypothesis:** moves 1–3 recur across games (fixed corners, symmetric start), so
  precomputed strong replies (mined from deep offline MCTS + the Run O self-play
  corpus) match or beat live search at near-zero latency. Assumption (M4): position
  repetition decays fast — book depth beyond ~3 plies is likely worthless; measure
  hit-rate by ply first.
- **Method:** build book from deep offline search over observed early positions
  (canonicalized under board symmetry); hybrid book-then-MCTS strategy; arena vs
  plain MCTS at matched *total* time plus a latency readout for moves 1–3;
  ≥600 pooled games.
- **Success criteria:** moves 1–3 latency < 50 ms with game-share CI not below 48%
  vs plain MCTS at matched total time (non-inferiority; latency is the win).
- **Cost / risk:** moderate — book mining + symmetry canonicalization; strength
  regression risk if book lines are shallow-search artifacts.
- **Log:** —

### AE17 — Root-parallel MCTS via Web Workers
- **Status:** proposed
- **Objective:** multiply effective iterations at fixed wall-clock using the
  client's idle cores (bots are client-side only).
- **Hypothesis:** K independent trees with root visit-count merging ≈ K× iterations
  with small quality loss — well-attested for root parallelism in the literature.
  Assumption (M4): merged root statistics preserve move choice quality despite
  unshared subtrees; the robust-child rule (max visits) merges naturally.
- **Method:** phase 1: simulate in the arena (K sequential searches per move,
  merged roots — measures quality at matched *iterations*, no workers needed).
  Phase 2 only if phase 1 wins: real Worker plumbing + wall-clock benchmark in the
  browser. Arena vs single-tree at matched total iterations, then at matched
  wall-clock with K=4; ≥600 pooled games.
- **Success criteria:** matched wall-clock game-share CI clears 52% vs
  single-thread (phase 2); phase 1 gate: merged K-tree at K×iters beats single
  tree at 1×iters, CI clear.
- **Cost / risk:** moderate — per-seat MCTS workers already exist
  ([mctsWorker.ts](../../../src/client/ai/mctsWorker.ts) + LocalAIGame plumbing),
  so phase 2 is "K workers per seat + root merge," not greenfield; phase 1
  de-risks quality cheaply. Interacts with AE9 (both are speed levers; run after).
- **Log:** —

### AE18 — Research-harness throughput (arena driver, dump sharding, feature cache)
- **Status:** won (live subset; Run Q / F13) — `selfplay-dump --jobs=N` sharding is
  **4.6×** (byte-identical `diff`) and the arena-driver lazy-stuck rewrite is 1.12×
  (byte-identical golden test), both shipped. Sub-item (3) trainer feature-cache
  **deferred** with the dormant value-net path (F11); revive with a stronger-net
  attempt.
- **Log:** Run Q → [F13](../FINDINGS.md)
- **Scope narrowed 2026-07-07 (context shift, M2):** built sub-items (1)
  arena-driver pass-streak + (2) dump sharding; deferred (3) the trainer
  feature-cache — F11 closed the value net as a no-win, so the trainer is dormant
  infra. Sub-item (1)'s absolute win shrank now AE9 (Run P) made `hasAnyMove` ~2.5×
  cheaper, but eliminating the calls still helps every future arena run.
- **Objective:** more games/positions per wall-clock hour from the research
  tooling, with identical outputs.
- **Hypothesis:** three concrete wastes: (1) `playGame` calls `recomputeStuck`
  (= `hasAnyMove` ×4, and proving *stuck* is the expensive full-scan case) after
  **every** move — the rollout code's pass-streak trick applies to the outer
  driver too; (2) `selfplay-dump` is single-process while per-game seeds
  (`mulberry32(baseSeed + g)`) are already independent — game-range sharding across
  cores preserves per-game determinism exactly (the Run O arena shards proved the
  pattern); (3) the trainer re-replays + re-featurizes the whole corpus (~111 s)
  on every hyperparameter tweak — dump features once to a binary sidecar.
- **Method:** implement each behind the existing CLIs; verify identical outputs
  (same seeds ⇒ byte-identical JSONL / same tournament tables); `time` before/after.
- **Success criteria (pre-registered; scope-narrowed 2026-07-07):** ≥3× dump
  throughput (sub-item 2) **and** a measured arena-driver speedup (sub-item 1), both
  with outputs **byte-identical** to the current implementation (hard gate: same
  seeds ⇒ identical tournament tables / identical JSONL). Trainer re-run <10 s
  (sub-item 3) **deferred**, not part of this close.
- **Cost / risk:** small; (1) touches only the arena driver (rules core untouched,
  bgio path unaffected). Wasted only if AE9 makes everything cheap first — but
  sharding/caching still stack on top of AE9.
- **Log:** —

### AE19 — External baseline: Pentobi bridge
- **Status:** won (F14) — GTP bridge shipped and our tiers placed on Pentobi's
  ladder: easy tier CI-clear below L1; extreme beats L1 CI-clear (61.8%, n=200)
  and is ~even vs L2. Highest level beaten CI-clear = L1. Standing external
  readout: `npm run arena:pentobi`. Follow-up (cheap): power extreme-vs-L2 to
  n≥200 if a candidate claims to reach L2.
  Every strength number we have is self-relative; Pentobi (open-source,
  MCTS-based, calibrated levels 1–9) is the de facto world reference.
- **Objective:** place our best bot on an absolute ladder and make every future
  AE win measurable against the outside world.
- **Hypothesis:** none needed — this is measurement infra (AE6 precedent). The
  interesting unknown is *which* Pentobi level our `extreme` tier matches.
- **Method:** adapter between the arena and `pentobi-gtp` (GTP text protocol:
  coordinate/piece-name mapping, color seating, resign/pass semantics); run our
  tiers vs Pentobi levels in 4p Classic, ≥200 games per level pairing, seed-
  averaged as usual. Config in `scripts/experiments/ae19-*.json`.
- **Success criteria:** measurement — game-share (±CI) vs ≥3 Pentobi levels,
  identifying the highest level we beat CI-clear; becomes the standing external
  readout cited by later entries.
- **Cost / risk:** moderate — local GPL binary + protocol adapter (subprocess,
  Node-side); risk is GTP dialect/rules-mapping bugs corrupting results
  (mitigate: replay-verify a sample of bridged games through our rules core).
- **Log:** Run R (`docs/research/log/ai-strategy.md`).

### AE20 — Gumbel root search (policy improvement at starved budgets)
- **Status:** proposed
- **Objective:** stronger move selection exactly where our budgets are tiny —
  medium tier completes ~15–46 iterations/move (Run O probe).
- **Hypothesis:** Gumbel-top-k action sampling + sequential halving at the root
  (Gumbel AlphaZero/MuZero) guarantees policy improvement with a handful of
  simulations, unlike UCT which needs visits to concentrate. Assumption (M4):
  the guarantee is w.r.t. a prior policy + value estimate — we have both (beam
  ordering scores as prior, rollout returns as values), so the premise holds.
- **Method:** Gumbel root selection behind a config flag (root-only change;
  interior selection unchanged); arena vs plain UCT at matched iterations
  (~40 and ~150) and at matched 500 ms wall-clock; ≥600 pooled games per
  comparison, `scripts/experiments/ae20.json`.
- **Success criteria:** game-share Wilson CI clears 52% vs plain UCT at the
  medium (500 ms) budget; the matched-iteration runs isolate mechanism.
- **Cost / risk:** small-moderate — root-only algorithm swap, well-specified in
  the literature; risk is the guarantee mattering less with only ~6–16 beam
  actions to choose among.
- **Log:** —

### AE21 — Population-play evaluation (pool Elo readout)
- **Status:** proposed
- **Objective:** detect self-play convention brittleness — a candidate that beats
  the incumbent head-to-head can still be weak against off-distribution play
  (the kingmaker/multiplayer caveat: 4p has no single optimal strategy). Also the
  enabling infra for product P13 (ladder calibration — tiers defined as strength
  bands vs a frozen anchor pool).
- **Hypothesis:** ranking vs a diverse pool (random, greedy, heuristic variants,
  alphabeta, MCTS tiers, retired champions) differs measurably from head-to-head
  vs the incumbent alone, and is a better proxy for vs-human / vs-external
  strength (testable once AE19 exists). Assumption (M4): pool diversity
  approximates off-distribution play — supported by the population-training
  literature; verified locally if pool rank predicts Pentobi rank.
- **Method:** arena extension — round-robin over a frozen pool, Elo (or
  game-share matrix) with CIs; report pool standing alongside head-to-head in
  future AE runs. Pool composition versioned in `scripts/experiments/pool.json`.
- **Success criteria:** measurement infra — bar for *adopting as a standing
  readout*: the pool ranking reorders or separates at least one pair that
  head-to-head calls equal (i.e. it adds signal), or correlates better with the
  AE19 external ladder than head-to-head does.
- **Cost / risk:** small-moderate; pure arena tooling, no engine change.
  Compute grows with pool size — prune to ~6–8 members.
- **Log:** —

### AE22 — AlphaZero-lite pipeline (policy+value net over board planes; AE4's designated successor)
- **Status:** proposed — the F11 "step-change capacity" clause made concrete.
  Run O's no-win was a 609-param toy on ε-greedy-heuristic outcomes; this is the
  known summit path: board planes, real capacity, search-improved targets.
- **Objective:** replace the hand-crafted heuristic beam with a learned policy
  prior and rollouts with a learned value — PUCT-style — beating full-rollout
  MCTS at matched wall-clock.
- **Hypothesis:** policy priors + value nets trained iteratively on MCTS visit
  distributions (not raw outcomes) reach superhuman strength in comparable
  board games; F8's beam knob disappears into the prior. Assumption (M4): F11's
  failure was capacity/labels, not concept — the AlphaZero literature is the
  evidence; the kill-gates below test it cheaply before the big spend.
- **Method:** staged, each stage gated (Run O pattern):
  **A** — MCTS-labeled self-play: extend the AE4 dump to record root visit
  distributions + outcomes (throughput wants AE9 first).
  **B** — train a small CNN (board planes per color + to-move) off-browser
  (Python/GPU); *gates:* policy top-1 must beat the heuristic's top-1 on
  held-out MCTS choices, value must beat the Run O net's held-out gate numbers.
  **C** — PUCT integration (prior over children replaces the beam; value at
  leaves) with browser inference via ONNX Runtime Web / WebGPU; measure
  inference latency in-loop before any arena spend.
  **D** — arena: vs full-rollout MCTS at matched 500 ms/move, and vs the AE19
  Pentobi ladder.
- **Success criteria (final):** game-share Wilson CI clears 52% vs full-rollout
  MCTS at matched per-move wall-clock over ≥600 pooled games (same bar as AE4,
  deliberately — this is the rematch); secondary: climbs ≥1 Pentobi level (AE19).
- **Cost / risk:** **large** — weeks: training infra (Python/GPU), a client
  runtime dep (ONNX ~MB bundle, a product concern), and inference latency can
  eat the gains (gate C exists for exactly that). Sequencing: after AE9;
  benefits from AE19 (external readout) and AE21 (robustness readout).
- **Log:** —

### AE23 — Solve a reduced Blokus (Duo on small boards)
- **Status:** deferred (blocked on board-size generalization — product P20 M2 —
  and wants AE9 node rates; the one true *solver* item, everything else is
  player-strength)
- **Objective:** compute the exact game-theoretic value + principal variation of
  Blokus Duo on a reduced board (ladder: 6×6 → 7×7 → 8×8, full or reduced piece
  set) — a proof, and to our knowledge a novel result for any Blokus variant.
- **Hypothesis:** 2p zero-sum Duo is well-posed (unlike 4p, where kingmaking
  makes "perfect play" undefined); with bitboards, transposition tables, and
  symmetry canonicalization, small boards are within alpha-beta / proof-number
  reach. Assumption (M4): tractability is the open question — the board-size
  ladder *is* the fit-check; each rung's node count calibrates the next.
- **Method:** exact negamax/PN search + TT + D4 symmetry reduction over the
  generalized rules core; verify the solved value by having the PV beat our
  strongest bot from both seats. Publishable if a nontrivial size falls.
- **Success criteria:** proven value + reproducible PV for ≥1 nontrivial board
  size (≥7×7), independently re-derivable from the committed solver + seed-free
  determinism.
- **Cost / risk:** large and open-ended — state-space growth may wall at 7×7;
  the ladder keeps the spend incremental. Shares exact-search machinery with
  AE13 (endgame solver).
- **Log:** —

### AE24 — Trained softmax move priors (soft pruning replaces the beam)
- **Status:** proposed — the primary F14 follow-up. Pentobi Classic L1/L2 use **3/30
  simulations** (`libpentobi_mcts/Player.cpp` level counts, github.com/enz/pentobi)
  yet L2 matches our 500-iteration extreme: a ~17× per-simulation quality gap, and
  its prior knowledge is the biggest identifiable share.
- **Objective:** initialize children at expansion with a move prior + value from
  `gamma = exp(φ·x)` over a small feature vector, replacing the fixed heuristic
  beam's hard cutoff with soft pruning (every legal child kept, priors steer).
- **Hypothesis:** Pentobi's feature set — attach-point structure, adjacency to
  own/opponent colors, locality to recent opponent attach points, per-piece gamma,
  opening dist-to-center pruning, child value init `root_val·sqrt(gamma/max_gamma)`
  (`libpentobi_mcts/PriorKnowledge.h`) — transfers to our engine and closes a large
  part of that gap at matched iterations. Assumption (M4): per-expansion feature
  cost stays small enough on the AE9 bitboards (Pentobi amortizes it with
  incremental structures); measure iters/s alongside.
- **Method:** staged with a cheap gate. **A — hand-set gammas:** implement feature
  extraction on the bitboards, weights hand-tuned from Pentobi's published
  semantics; arena vs incumbent extreme at matched iterations. **B — only if A
  moves the needle:** softmax-train the ~20 weights from self-play outcomes
  (Pentobi precedent: `learn_tool/`), reusing the dormant AE4 pipeline
  (`selfplay-dump` + trainer, AE18's `--jobs` sharding). **C —** standing external
  readout: extreme+priors vs Pentobi L2 (then L3), n≥200 per level
  (`npm run arena:pentobi`).
- **Success criteria:** game-share vs incumbent extreme at matched iterations,
  Wilson 95% CI lower bound > 52%, ≥600 pooled games; external ladder readout
  reported either way. Stage-A gate: directional win (≥55% point estimate, n≥200)
  before investing in the training pipeline.
- **Cost / risk:** moderate–large. Feature cost per expansion is the main risk;
  correctness guarded by the differential-test pattern (F12). Likely subsumes AE14
  (progressive widening) and strengthens AE20 (Gumbel wants priors). AE3's RAVE
  no-win is worth a cheap revisit *after* this lands — Pentobi runs RAVE in
  combination with priors + policy playouts, not alone.
- **Log:** —

### AE25 — WASM(+SIMD) search core (the client-side JS ceiling, part 1)
- **Status:** proposed — sequence *after* the knowledge track (AE15/AE11/AE24)
  stabilizes the engine, so the port happens once.
- **Objective:** raise per-core iters/s by porting the hot loop (bitboard move-gen +
  playout) to WASM with SIMD; the TS implementation stays as the byte-identical
  differential reference (F12 pattern). Browser workers and the Node arena load the
  same module, so research and shipped bots remain one engine.
- **Hypothesis:** ≥2× iters/s over the AE9 TS bitboard path (2–4× expected — the JS
  is already bitboard-optimized, so not 10×); by F6, each budget doubling ≈ +5 pts.
- **Method:** Rust→wasm (or AssemblyScript) module exposing move-gen + rollout;
  golden differential tests vs the TS path (byte-identical move streams); iters/s
  via `scripts/profile-mcts.ts`; strength via F12's framing — identical output at
  fixed iterations means matched wall-clock is an iteration-ratio head-to-head,
  ≥600 pooled games.
- **Success criteria:** ≥2× iters/s with byte-identical output, and matched
  wall-clock game-share vs the TS engine with Wilson CI clear of 52%.
- **Cost / risk:** large — toolchain, Vite/worker build plumbing, and permanent
  dual-implementation maintenance. **Ceiling notes:** (a) shared-memory tree
  parallelism (WASM threads / SharedArrayBuffer) is deliberately out of scope
  behind a deployment constraint — it requires COOP/COEP cross-origin isolation
  headers on the app *and* assets; verify hosting supports them before any part-2
  entry. (b) Root-parallel workers (AE17) need none of that and stack with this
  entry (~10–15× combined at fixed wall-clock ≈ Pentobi-L6 compute). (c) The full
  escape to L7+ compute (70k–1.7M sims/move) is server-hosted bots — product P11
  territory, an online-only-tier product decision, not a research lever.
- **Log:** —

### AE26 — Rollout width: how many candidates should a playout move sample?
- **Status:** proposed — spun out of AE11 (Run T / [F16](../FINDINGS.md)): the
  *control* arm moved, not the hypothesis. Doubling the rejection-sample pool
  (6→12) under the unchanged size-greedy rule scored 54.4% game-share (CI
  [50.4,58.3], p=0.016, n=600) at matched wall-clock. That's a distinct claim from
  AE11's "smarter ranking", so it gets its own pre-registered bar rather than
  inheriting one written for a rejected hypothesis (M2).
- **Objective:** find the strength-optimal `rolloutSamples`, i.e. where the
  better-playout / fewer-playouts trade turns over.
- **Hypothesis:** rollout strength rises with the sampled-candidate max (bigger piece
  played) while iteration count falls only slowly — because a bigger-piece playout
  terminates in fewer plies, `rolloutSamples` 12 is *1.23× faster* than 6, not slower
  (Run T bench). So the curve is non-monotone with an interior optimum > 6, and the
  usual cost/quality tradeoff is inverted over part of the range. Assumption (M4): the
  playout's contribution to the leaf estimate is dominated by piece size, which F16's
  score-vs-size split supports.
- **Method:** sweep `rolloutSamples` ∈ {6, 12, 24, 48} head-to-head vs the shipped
  6 (2v2, `rolloutDepth 0`, `beam 16`, `rankRewardWeight 0.25`), each arm at its own
  matched-wall-clock iteration count from `scripts/bench-rollout.ts`. Configs
  `scripts/experiments/ae26-*.json`, sharded via the `ae11-sweep.sh` pattern.
  Report iters/s and mean rollout plies alongside game-share — the mechanism claim
  (shorter playouts) should be visible directly. Watch the `fallbackMove` rate: at
  large sample counts, late-game positions may exhaust rejection sampling.
- **Success criteria:** some `rolloutSamples` > 6 has game-share Wilson CI clearing
  52% vs 6 at matched wall-clock, ≥600 games per arm (n≈2400 if the point estimate
  stays near 54% — Run T's n=600 CI is too wide to clear 52% on its own).
- **Cost / risk:** small code (knob exists, config-only), compute-heavy (4 arms ×
  ≥600 games ≈ 4 h at 14-way, more if powered to n=2400). Risk: the effect is really
  the extra iterations rather than the width, which this design cannot separate —
  an `rolloutSamples 6 @ 59 it` arm is the control that isolates it, and it's cheap
  to add. Interacts with AE24 (learned priors would replace the sampler outright).
- **Log:** —
