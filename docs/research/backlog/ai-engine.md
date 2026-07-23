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

1. **AE24** — trained softmax move priors: the main share of the ~17× per-simulation
   quality gap vs Pentobi (F14). F17 sharpens it — priors must beat *width*, and width
   is now known to be mostly the iterations shorter playouts buy (not per-move smarts),
   so a prior has to add signal a cheap size-max sampler doesn't.
2. **AE29** — Duo external anchor (newly dependency-ready, 2026-07-22, when product P54
   made the arena variant-aware). The M5 gate for a whole track: Duo is **shipped to
   players** and the bots' strength there is entirely unmeasured, while every constant
   they use was tuned on Classic (M6). Nothing self-relative about Duo — AE30, AE31 —
   is trustworthy until this lands.
3. **AE17** — root-parallel workers: cheapest compute multiplier once per-sim
   quality is fixed; no deployment changes needed.
4. **AE21** — population-play Elo: harness now built & validated (Run W/F19); remaining
   is the compute-heavy **diverse-pool** round-robin (MCTS tiers + champion) that actually
   tests the signal/AE19-correlation bar and gives P13 its champion-anchored ladder.
5. **AE27** — post-bitboard beam:iters re-validation: cheap phase-1 profiling that
   guards the shipped tiers against F12's ~2.5× throughput shift (staleness sweep of
   F8/AE10).
6. **AE15 replication** — second independent seed pool confirming F15's w=0.25
   game-share guard (≥48% lower bound), owed because w=0.25 now backs a shipped default
   (tiers + P36 base default). On agreement, upgrades F15 to `replicated` and clears
   **P36's** `replication-pending` only — P37's is a distinct debt (F18/AE28,
   `rolloutSamples` 48 vs 6, a Run V re-batch). Cheap: one re-run of Run S's config on
   fresh seeds.
7. **AE28 replication** — second independent seed pool on Run V's config (48 vs 6 at
   fixed 500 iters); clears **P37's** `replication-pending`, upgrades F18 to
   `replicated`. Compute-heavy (~150 CPU-h at n=600) — schedule deliberately.

---

### AE1 — Ship MCTS as the offline bot — SHIPPED
- **Status:** won / shipped — four-tier ladder in
  [difficulty.ts](../../../src/client/ai/difficulty.ts), measured monotonic
  (Runs J / J-confirm / K), every step CI-clear of 50.
- **Log:** Runs D–K → [F6, F8](../FINDINGS.md). Product follow-ups (long-move UX,
  bot-fill) → [product backlog](../../product/BACKLOG.md); open research levers →
  AE2 / AE9.
- **Deploys as:** shipped (see Status line).

### AE2 — Make MCTS faster (more iterations per time cap)
- **Drafted:** 2026-07-02
- **Status:** proposed (partly banked — the anchor optimization already shipped a
  **~16× move-gen speedup**, F7/Run J engine note; this entry is now the *further*
  gains beyond that. Still valuable: each budget doubling ≈ +5 pts, and F8 showed
  medium is iteration-starved early game.)
- **Note:** Run N / F10 profile confirms the gen/legality path is the bottleneck
  (~75 % of MCTS time). This entry (cache/incrementalise) and **AE9 (bitboards)**
  target the same hot path; AE9 is the sharper tool — but the sub-items below are
  days-not-weeks, assumption-free, and partially subsumed by AE9 (do them first
  only if AE9 isn't imminent).
- **Variant:** mechanism — throughput work; iters/s gains carry to any board size.
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
- **Power:** bar not yet numeric — pin via stats.py --power at the Phase-1 start gate.
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
- **Deploys as:** shipped (see Status line).

### AE6 — Push the budget ladder to saturation
- **Drafted:** 2026-07-02
- **Status:** proposed (pure benchmarking; low priority)
- **Variant:** classic — the plateau is a measured curve on the Classic branching
  factor; Duo's is its own question (AE30).
- **Objective:** find where MCTS-vs-heuristic strength plateaus.
- **Hypothesis:** Run I stopped at `it=320/d=0` (90.1%), still climbing +5 pts/
  doubling — the ceiling is mid-90s.
- **Method:** run `it=640/d=0` and beyond, same sharded harness + pooled binomial stats.
- **Success criteria:** N/A (measurement) — identify the plateau.
- **Power:** measurement — sized by target CI width, no binomial bar.
- **Cost / risk:** slow; no code change.

### AE7 — MCTS mode coverage (2p / 3p)
- **Drafted:** 2026-07-02
- **Status:** deferred (blocked on 2p/3p AI actually landing). **Not Duo.** This is
  2p/3p *Classic* — 20×20, four colour sets, one human steering two colours (or the 3p
  shared colour). Duo is a two-*colour* game on 14×14 and is a different problem
  ([AE29](#ae29--duo-external-anchor-extend-the-pentobi-bridge-to-the-duo-variant)–AE31);
  don't merge the two entries.
- **Variant:** classic — Classic 2p/3p seat conventions, explicitly **not** Duo (see
  Status).
- **Objective:** validate MCTS reward + backup for non-4p modes.
- **Hypothesis:** 2p (one human steers two colors) and 3p (shared color) have
  different reward structures — placed-leader reward and per-color backup need
  revisiting.
- **Method:** extend arena to 2p/3p; rerun the budget sweep per mode.
- **Success criteria:** MCTS beats heuristic in each mode, CI clear.
- **Power:** set at revival.
- **Cost / risk:** moderate; also unblocks AE8's tree-reuse revisit.

### AE8 — Tree reuse across turns (revisit in 2p)
- **Drafted:** 2026-07-02
- **Status:** deferred (implemented; **no-win in 4p, measured** — kept, correct, zero-cost on miss).
  **Duo makes this testable for the first time:** the entry has always said "revisit in 2p",
  and Duo (two colours, so only 2 plies to your next turn) is that testbed — its hypothesis
  predicts reuse should pay there. **Both product gates are shipped** (P20 M2b, and P54
  on 2026-07-22 — the arena takes a `variant`), so this is testable now, not on AE7.
- **Variant:** mechanism — tree reuse is a search-structure change, no constant riding
  on the board.
- **Objective:** determine whether persisting + re-rooting the search tree between
  moves pays off outside 4p.
- **Hypothesis:** reuse hit-rate is ~0–5% in 4p (your next turn is 4 plies deep in a
  beam-16 tree, so the played line is almost never still present), but should pay in
  2p (only 2 plies to your next turn) or at much larger budgets.
- **Method:** `mctsSearch` + `reRoot` already exist and are unit-tested; measure
  reuse hit-rate and game-share in 2p once AE7 lands.
- **Success criteria:** non-trivial reuse hit-rate + strength gain in 2p.
- **Power:** set at revival.
- **Cost / risk:** none new (mechanism exists). **Don't invest more for 4p.**

### AE9 — Bitboard move generation
- **Status:** won (Run P / F12) — bitboard legality is byte-identical to the scan,
  **2.48× iters/s** (997 vs 402), and at matched wall-clock (2.5× iter head-to-head)
  wins **71.4 % [67.8, 74.8]** game-share over 640 games. All three pre-registered
  gates pass. Shipped into `generateLegalMoves`/`hasAnyMove` + the MCTS rollouts;
  `isLegalPlacement` kept as the bgio/UI path + differential reference.
- **Log:** Run P → [F12](../FINDINGS.md)
- **Deploys as:** shipped (see Status line).
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
  curve banked: `it40→68 · it80→77 · it160→85 · it320→90` game-share vs heuristic
  (per-iteration, engine-invariant; but iterations realized per *time* budget are up
  ~2.5× since AE9 bitboards — see AE27).
- **Log:** Run J → [F8](../FINDINGS.md)
- **Deploys as:** shipped (see Status line).

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
- **Drafted:** 2026-07-06
- **Status:** proposed
- **Variant:** mechanism — budget allocation across a game; the schedule is
  board-agnostic.
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
- **Power:** n=600 → MDE 56.0%; hypothesized effect not quantified — required n deferred to the start gate.
- **Cost / risk:** small-moderate; scheduler only, engine untouched. Timed mode is
  nondeterministic (accepted precedent: Run J-confirm).
- **Log:** —

### AE13 — Endgame exact solver
- **Drafted:** 2026-07-06
- **Status:** proposed
- **Variant:** mechanism — an exact-search switchover; the *threshold* it finds will be
  variant-scoped.
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
- **Power:** n=600 → MDE 56.0%; hypothesized effect not quantified — required n deferred to the start gate.
- **Cost / risk:** moderate — threshold detection + a solver mode; risk is the
  tractable window being too short to matter.
- **Log:** —

### AE14 — Progressive widening (replace the fixed beam)
- **Drafted:** 2026-07-06
- **Status:** proposed
- **Variant:** mechanism — the point is to *remove* F8's variant-scoped beam constant,
  not retune it.
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
- **Power:** n=600 → MDE 56.0% for the 52% won-bar; the primary test is non-inferiority vs 50% (removing the knob), effect not quantified — required n deferred to the start gate.
- **Cost / risk:** small code change; extra comparisons make it compute-heavy
  (3 tiers × 600 games).
- **Log:** —

### AE15 — Score-margin reward shaping
- **Status:** won (w=0.25) — Run S / [F15](../FINDINGS.md). Light rank-normalized
  shaping `(1−w)·winner + w·rankNorm` at w=0.25 improves placement (−0.24, CI clear)
  and placed squares (+1.3, CI clear) with game-share 53.2% (CI [49.4,57.1], clears
  the 48% guard); w=0.5 over-trades (game-share CI 45.4% < floor, the M4 conflict).
  Config knob `rankRewardWeight` in [mcts.ts](../../../src/game/ai/mcts.ts) — default
  `0.25` since P36 (`w=0` remains byte-identical to the pre-shaping winner-take-all
  reward). Shipped as a retune-in-place per P13 (lost-position lever, not a new rung):
  the tiers (commit c7172bc) and now the base default (P36); also feeds AD2/AD3 a
  non-degenerate lost-position value.
- **Replication owed (`significant`, replication-pending):** Run S is a single pooled
  batch (n=648, game-share CI [49.4,57.1] — lower bound near 50), and w=0.25 now backs
  a shipped default. Run a second independent seed pool, w=0.25 vs w=0, same method
  (2v2, `beam 16`, `rolloutDepth 0`, ≥600 games). Success: game-share Wilson lower
  bound ≥ 48%. On agreement → upgrade F15 `significant → replicated` and clear **P36's**
  `replication-pending` (P37's is separate — it needs an F18/AE28 re-batch, Run V's
  config, not this one). Parked in `## Next up` below.
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
- **Deploys as:** product P36 (rankRewardWeight 0.25 retune-in-place).

### AE16 — Opening book
- **Drafted:** 2026-07-06
- **Status:** proposed (deprioritized for 4p Classic, 2026-07-07 — Pentobi's own
  shipped `book_classic.blksgf` is 173 *bytes* vs Duo's 22.5 KB: even the reference
  engine found books barely worth having on the 4p Classic start. The latency half
  of the objective stands; revisit the strength half with P20 M2 / Duo.)
  **The deprioritization is Classic-only and does not carry to Duo** — the same
  comparison that killed it here argues *for* it there: Pentobi ships 22.5 KB of Duo
  book against 173 bytes for Classic, so opening theory is worth roughly two orders of
  magnitude more on the Duo start. Re-rank this entry once Duo ships.
- **Variant:** classic — worst-case latency is measured against Classic's early-move
  branching; Duo searches are cheaper.
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
- **Power:** n=600 → MDE 52.0% vs the 48% non-inferiority floor; strength isn't the win (latency is), effect not quantified — required n deferred to the start gate.
- **Cost / risk:** moderate — book mining + symmetry canonicalization; strength
  regression risk if book lines are shallow-search artifacts.
- **Log:** —

### AE17 — Root-parallel MCTS via Web Workers
- **Drafted:** 2026-07-06
- **Status:** proposed
- **Variant:** mechanism — a wall-clock multiplier on the same search.
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
- **Power:** n=600 → MDE 56.0% (phase-2 wall-clock); hypothesized effect not quantified — required n deferred to the start gate.
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
- **Deploys as:** shipped (see Status line).
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
- **Deploys as:** shipped (see Status line).

### AE20 — Gumbel root search (policy improvement at starved budgets)
- **Drafted:** 2026-07-06
- **Status:** proposed
- **Variant:** classic — a strength comparison at Classic budgets and branching.
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
- **Power:** n=600 → MDE 56.0%; hypothesized effect not quantified — required n deferred to the start gate.
- **Cost / risk:** small-moderate — root-only algorithm swap, well-specified in
  the literature; risk is the guarantee mattering less with only ~6–16 beam
  actions to choose among.
- **Log:** —

### AE21 — Population-play evaluation (pool Elo readout)
- **Drafted:** 2026-07-23 — re-verified against `src/game/ai/arena.ts` at the harness build.
- **Status:** active — harness **delivered & validated** (Run W / [F19](../FINDINGS.md)):
  `runRoundRobin` + `bradleyTerryElo` in `arena.ts`, pool versioned in
  `scripts/experiments/pool.json` (champion = top entry), CLI `--pool=…`. The
  pre-registered bar is **untested**: Run W's fast 4-member pool is transitive, so pool
  Elo reproduces head-to-head *by construction* (F19). The discriminating run is a
  round-robin over the **diverse** pool (`champion, mcts-150, mcts-30, alphabeta-d2,
  heuristic, greedy-size, random`) — 21 pairs, ~10 MCTS-heavy at seconds/move (tens of
  CPU-h); shard like AE28's sweep, schedule deliberately. Readouts to compare there: pool
  Elo vs marginal-vs-incumbent order, and pool-Elo rank vs AE19 Pentobi placement.
- **Variant:** mechanism — a measurement methodology (population play), not a tuned
  value.
- **Objective:** detect self-play convention brittleness — a candidate that beats
  the incumbent head-to-head can still be weak against off-distribution play
  (the kingmaker/multiplayer caveat: 4p has no single optimal strategy). Also the
  enabling infra for product P13 (ladder calibration — tiers defined as strength
  bands vs a frozen anchor pool). The pool also **designates a versioned *champion*** —
  our best-known bot *unconstrained* by latency/UX (near-bottomless budget): the pool's
  top anchor and the strength *ceiling* P13's shippable (latency-bounded) tiers are
  measured against (each tier's "gap vs champion"). Complements AE6 (budget-to-saturation
  = where the ceiling sits) and AE19 (external Pentobi anchor = absolute placement of it).
- **Hypothesis:** ranking vs a diverse pool (random, greedy, heuristic variants,
  alphabeta, MCTS tiers, retired champions) differs measurably from head-to-head
  vs the incumbent alone, and is a better proxy for vs-human / vs-external
  strength (testable once AE19 exists). Assumption (M4): pool diversity
  approximates off-distribution play — supported by the population-training
  literature; verified locally if pool rank predicts Pentobi rank.
- **Method:** arena extension — round-robin over a frozen pool, Elo (or
  game-share matrix) with CIs; report pool standing alongside head-to-head in
  future AE runs. Pool composition versioned in `scripts/experiments/pool.json` —
  the champion config is its top entry, bumped whenever a won experiment raises the
  ceiling (so P13's "gap vs champion" per tier is always read against the current best).
- **Success criteria:** measurement infra — bar for *adopting as a standing
  readout*: the pool ranking reorders or separates at least one pair that
  head-to-head calls equal (i.e. it adds signal), or correlates better with the
  AE19 external ladder than head-to-head does.
- **Power:** measurement — sized by target CI width, no binomial bar.
- **Cost / risk:** small-moderate; pure arena tooling, no engine change.
  Compute grows with pool size — prune to ~6–8 members.
- **Log:** Run W (harness build + transitive-pool validation) → [F19](../FINDINGS.md).
  Discriminating diverse-pool run: pending.

### AE22 — AlphaZero-lite pipeline (policy+value net over board planes; AE4's designated successor)
- **Drafted:** 2026-07-06
- **Status:** proposed — the F11 "step-change capacity" clause made concrete.
  Run O's no-win was a 609-param toy on ε-greedy-heuristic outcomes; this is the
  known summit path: board planes, real capacity, search-improved targets.
- **Variant:** classic — the policy/value nets train on the Classic self-play corpus; a
  Duo net is a separate track.
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
- **Power:** n=600 → MDE 56.0%; hypothesized effect not quantified — required n deferred to the start gate.
- **Cost / risk:** **large** — weeks: training infra (Python/GPU), a client
  runtime dep (ONNX ~MB bundle, a product concern), and inference latency can
  eat the gains (gate C exists for exactly that). Sequencing: after AE9;
  benefits from AE19 (external readout) and AE21 (robustness readout).
- **Log:** —

### AE23 — Solve a reduced Blokus (Duo on small boards)
- **Drafted:** 2026-07-06
- **Status:** deferred (wants AE9 node rates; the one true *solver* item, everything
  else is player-strength). **Board-size blocker partly cleared:** P20 M2a shipped the
  rules-core generalization (board size + start cells are `GameConfig`, read via
  `boardSizeOf`/`startCellOf`), so a reduced board is now expressible. **The rest of the
  board-size blocker is now cleared too:** P20 M2b shipped the two-colour play set, and
  P54 (2026-07-22) the variant-aware search layer + Duo-capable arena. What remains is
  the original gate — AE9 node rates — not a product dependency.
- **Variant:** mechanism — exact endgame value; the tractable-depth constant it yields
  is variant-scoped.
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
- **Power:** set at revival.
- **Cost / risk:** large and open-ended — state-space growth may wall at 7×7;
  the ladder keeps the spend incremental. Shares exact-search machinery with
  AE13 (endgame solver).
- **Log:** —

### AE24 — Trained softmax move priors (soft pruning replaces the beam)
- **Drafted:** 2026-07-08
- **Status:** proposed — the primary F14 follow-up. Pentobi Classic L1/L2 use **3/30
  simulations** (`libpentobi_mcts/Player.cpp` level counts, github.com/enz/pentobi)
  yet L2 matches our 500-iteration extreme: a ~17× per-simulation quality gap, and
  its prior knowledge is the biggest identifiable share.
- **Variant:** classic — gated against Pentobi Classic L1/L2 and Classic feature
  statistics.
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
- **Power:** n=600 → MDE 56.0%; at the stage-A hypothesized ~55% a CI-clear needs n≥1066 (~2400 for ~80% power) — pooled batches planned. Stage-A itself is a directional point-estimate gate (≥55%, n≥200), not a CI test.
- **Cost / risk:** moderate–large. Feature cost per expansion is the main risk;
  correctness guarded by the differential-test pattern (F12). Likely subsumes AE14
  (progressive widening) and strengthens AE20 (Gumbel wants priors). AE3's RAVE
  no-win is worth a cheap revisit *after* this lands — Pentobi runs RAVE in
  combination with priors + policy playouts, not alone.
- **Log:** —

### AE25 — WASM(+SIMD) search core (the client-side JS ceiling, part 1)
- **Drafted:** 2026-07-08
- **Status:** proposed — sequence *after* the knowledge track (AE15/AE11/AE24)
  stabilizes the engine, so the port happens once.
- **Variant:** mechanism — a port of the hot loop; strength-neutral by construction.
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
- **Power:** n=600 → MDE 56.0%; F6's ~+5 pts/budget-doubling implies ~55% at the ≥2× target, needing n≥1066 to clear (pool a second batch) — derived from F6, confirm at the start gate.
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
- **Status:** won — `rolloutSamples` 24 and 48 both clear the 52% game-share bar vs
  the shipped 6 at matched wall-clock (62.6% / 64.9%, n=600, Run U / [F17](../FINDINGS.md)).
  Strength is monotone-increasing in width over [6,48] with no interior optimum; the
  win is mostly the iterations that shorter (bigger-piece) playouts buy — an
  iteration-only control (6@57 vs 6@48) alone scores 58%, and the pure-width term is
  −2.3 pts at 6→12 but +2.3 pts at 24→48 (past the ~24-sample speed plateau). Deploy
  lever: raise `rolloutSamples` toward 24 (speed-plateau, captures the iteration gain
  for free under the time-budget tiers) or 48 (best measured, higher late-game
  rejection cost — `fallbackMove` exhaustion unmeasured, follow-up).
- **Status (was):** spun out of AE11 (Run T / [F16](../FINDINGS.md)): the
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
- **Power:** n=600/arm → MDE 56.0%; at Run T's 54.4% a CI-clear needs n≥1665 — pool to ~2400 as the entry's success criteria already plans.
- **Cost / risk:** small code (knob exists, config-only), compute-heavy (4 arms ×
  ≥600 games ≈ 4 h at 14-way, more if powered to n=2400). Risk: the effect is really
  the extra iterations rather than the width, which this design cannot separate —
  an `rolloutSamples 6 @ 59 it` arm is the control that isolates it, and it's cheap
  to add. Interacts with AE24 (learned priors would replace the sampler outright).
- **Deploys as:** product [P37](../../product/BACKLOG.md) — extreme's `rolloutSamples`
  6→48, shipped (`replication-pending`). AE28 is the fixed-iteration follow-up that
  sized the bump; the `fallbackMove` instrumentation this entry asked for ships as
  `npm run arena -- --rollout-stats`.
- **Log:** [Run U](../log/ai-strategy.md) → [F17](../FINDINGS.md). Confound control
  fired as designed: the width lever is iteration-dominated (the risk above was real).

### AE27 — Re-validate per-tier beam:iteration ratios and the budget ladder post-bitboard
- **Drafted:** 2026-07-15
- **Status:** proposed — retroactive staleness sweep of F8/AE10 after AE9 (F12).
  The `beam ≈ iters/6` rule and the shipped per-tier beams were tuned on pre-bitboard
  iteration counts; F12's ~2.5× throughput jump silently changed how many iterations
  each *timed* tier completes, which is exactly what F8's beam rule reads.
- **Variant:** classic — a staleness re-check of the shipped Classic per-tier beams.
- **Objective:** confirm the shipped per-tier beams (medium 6, hard 16) still satisfy
  `beam ≈ iters/6` now that timed tiers complete ~2.5× the iterations F8 measured.
- **Hypothesis:** medium's iterations/move grew ~2.5× (F8-era ~30 → ~75), so its
  `beam=6` may now be *too narrow* (`iters/6 ≈ 12`, or ≈25 at the early-game floor);
  hard is likely still fine. If medium is under-beamed it leaves strength on the table
  without breaking the ladder's monotonicity.
- **Method:** phase 1 is **measurement only** — instrument iterations/move per tier at
  the shipped time budgets via `scripts/profile-mcts.ts` and compare to F8's counts.
  Phase 2 (conditional): only if the beam:iters ratio drifted >2× from F8, rerun the
  J-confirm ladder arena (config `scripts/experiments/ae27.json`) sweeping medium's
  beam, seed-averaged as usual.
- **Success criteria:** ladder steps stay CI-clear of 50% at J-confirm's n (no
  regression); if phase-1 drift >2×, a re-tuned medium beam clears its tier's bar.
- **Power:** phase 1 is instrumentation (iters/move per tier), sized by CI width on
  the ratio — no binomial bar. The conditional ladder rerun inherits J-confirm's n and
  bar (each step CI-clear of 50%), powered there; --power run at that gate if a retune
  is triggered.
- **Cost / risk:** small — phase 1 is a profiling run, no engine change; phase 2 only
  fires if the ratio actually drifted. Guards shipped tiers cheaply.
- **Log:** —

### AE28 — Rollout width at fixed iterations (does the `extreme` tier get the width win?)
- **Status:** won — at fixed 500 iters (extreme's config) `s48` beats `s6` **61.3%
  [57.3, 65.1]**, +11.3 pts pure-quality, p=1.5e-8, n=600 (Run V / [F18](../FINDINGS.md)).
  Clears the 52% bar decisively → yes, the extreme tier gets a clean strength win from
  widening. Surprise vs AE26: the pure-width term is *budget-dependent* — a wash at
  ~55 iters, large at 500 (F18). Deploy: raise `extreme`'s `rolloutSamples` from 6
  toward 48 (strength win + ~1.35× move-speed). `fallbackMove` path is
  sample-with-replacement — no crash, only wasted cycles in sparse endgames.
- **Replication owed (`significant`, replication-pending):** Run V is a single batch
  and 48 now backs the shipped `extreme` tier (P37). Run a second independent seed
  pool on Run V's config (`ae28-extreme-width.json`, 48 vs 6 at fixed 500 iters,
  ≥600 games); success = game-share Wilson lower bound clears 52%. On agreement →
  upgrade F18 to `replicated` and clear P37's `replication-pending`. Parked in
  `## Next up`.
- **Status (was):** active — spun out of AE26/[F17](../FINDINGS.md). AE26 showed wider
  sampling wins at matched *wall-clock*, but the win is mostly the extra iterations
  shorter playouts buy. The shipped `extreme` tier runs a **fixed 500 iterations with
  no time budget** ([difficulty.ts](../../../src/client/ai/difficulty.ts)), so it
  cannot collect those free iterations — only the *pure-width* term applies, which F17
  measured as small and non-monotone (−2.3 pts at 6→12, +2.3 pts at 24→48). AE26 never
  ran a clean 48-vs-6 at identical iterations, so whether width helps the best bot is
  genuinely untested.
- **Objective:** decide whether to raise `extreme`'s `rolloutSamples` from 6 for
  *strength* (a separate speed-only case exists: width 48 is 1.35× faster/move, easing
  extreme's ~12 s/move — but that's a UX call, not this bar).
- **Hypothesis:** at 500 iters the tree is well-developed, so per-rollout quality
  (bigger-piece playouts, lower reward variance — F17's mechanism) should matter more
  than it did at ~55 iters; expect a small positive pure-width effect, possibly < the
  52% detection bar at n=600.
- **Method:** head-to-head 2v2, both arms `iterations 500`, `beam 20`, `rolloutDepth 0`,
  `rankRewardWeight 0.25` (extreme's config), `rolloutSamples` 48 vs 6. Config
  `scripts/experiments/ae28-extreme-width.json`, sharded via the ae26-sweep pattern.
  No iteration-matching — fixed iters *is* the point.
- **Success criteria:** `s48` game-share Wilson CI lower bound clears **52%** vs `s6`
  at fixed 500 iters, ≥600 games (escalate toward n≈2400 if the point estimate sits in
  ~[50,54]). Pass → ship 48 to extreme on strength. Fail → no fixed-iteration strength
  gain; extreme adoption becomes a speed-only UX decision.
- **Cost / risk:** compute-heavy — 500 iters/move is ~3× the AE26 per-game cost;
  n=600 ran 732 min / 150 CPU-h at 14-way. Risk (underpowered for a small effect) did
  not fire — the effect was large (+11 pts), CI cleared at n=600.
- **Deploys as:** product [P37](../../product/BACKLOG.md) — extreme's `rolloutSamples`
  6→48, shipped (`replication-pending`; the Run V re-batch is still owed, ~150 CPU-h).
  Verified in [difficulty.ts](../../../src/client/ai/difficulty.ts): the `extreme` tier
  ships `rolloutSamples: 48`.
- **Log:** [Run V](../log/ai-strategy.md) → [F18](../FINDINGS.md). Follow-up: instrument
  `fallbackMove` rate at width 48 (ships as `npm run arena -- --rollout-stats`).

### AE29 — Duo external anchor: extend the Pentobi bridge to the `duo` variant
- **Drafted:** 2026-07-21
- **Status:** proposed — **dependency-ready** as of 2026-07-22: both product gates
  (P20 M2b, P54) shipped, so the arena plays Duo (`npm run arena -- --duo`, or a
  `--config` JSON carrying `"variant": "duo"` — the reproducible path a run should use;
  `--result` shard pooling works with it). Extending the Pentobi bridge itself is *this
  entry's* work, not a blocker: `pentobi/arena.ts` is still Classic-only by construction.
  **The M5 anchor for the Duo
  track** — a new variant is a new track, so this lands before any self-relative Duo
  number is trusted. [F14](../FINDINGS.md) placed our tiers on Pentobi's ladder in **4p
  Classic only**; our Duo strength is entirely unmeasured, while every constant a Duo
  bot would inherit was tuned on Classic ([M6](../FINDINGS.md)).
- **Variant:** duo — the Duo external anchor; this is the entry that opens the Duo track
  (M5).
- **Objective:** place each shipped tier on Pentobi's **Duo** ladder, so every later Duo
  experiment has an outside-world readout from run one instead of after ~20 runs (M5).
- **Hypothesis:** none needed — measurement infrastructure (the AE19 precedent). The one
  interesting unknown: whether Classic-inherited configs land *lower* on the Duo ladder
  than they do on the Classic ladder, which would quantify the transfer loss directly
  and size AE30/AE31.
- **Method:** `pentobi-gtp` already supports the variant (`-g duo`) — the gap is on our
  side. Our bridge hardcodes `'classic'`
  ([pentobi/gtp.ts:39](../../../src/game/ai/pentobi/gtp.ts)) and a 20-based coordinate
  map (`20 − row`, [pentobi/coords.ts:25,33,46](../../../src/game/ai/pentobi/coords.ts));
  parameterize both by board size, add a 2-seat Duo game loop, and replay-verify every
  bridged game through our own rules core (the AE19 guard). Then each shipped tier vs
  Pentobi Duo levels 1–4, ≥200 games per pairing, seed-averaged, configs in
  `scripts/experiments/ae29-*.json`. Report the Classic ladder placement alongside as
  the transfer readout.
- **Success criteria:** measurement — game-share (± Wilson 95% CI) vs ≥3 Pentobi Duo
  levels, identifying the highest level each tier beats CI-clear. Becomes the standing
  Duo readout (`npm run arena:pentobi -- --variant=duo`) that AE30/AE31 cite.
- **Power:** measurement — sized by target CI width, not a binomial bar; n=200/pairing
  gives ≈ ±7 pts (the AE19 precedent).
- **Cost / risk:** small–moderate. The bridge, GTP protocol and replay verifier all
  exist; this is parameterization plus a 2-seat loop. Risk: Duo coordinate/piece mapping
  bugs silently corrupting results — mitigated by the same replay verification that
  caught exactly that for Classic.
- **Log:** —

### AE30 — Re-tune the Duo bot: beam:iterations and the heuristic weights
- **Drafted:** 2026-07-21
- **Status:** proposed (blocked on **AE29** only — the anchor lands first, per M5. The
  product gate cleared: P54 shipped 2026-07-22 and the arena plays Duo.)
- **Variant:** duo — the question *is* whether the Classic-tuned constants transfer to
  14×14.
- **Objective:** decide whether the Classic-tuned constants still hold on 14×14 with one
  opponent: the per-tier `beam` (medium 6, hard 16, extreme 20,
  [difficulty.ts](../../../src/client/ai/difficulty.ts)) and the heuristic weights
  `{size:10, frontier:3, center:1, block:2}`
  ([heuristic.ts:15-20](../../../src/game/ai/heuristic.ts)) — or whether Duo needs its own set.
- **Hypothesis:** both drift, in *known directions*.
  **(1) Beam.** [F8](../FINDINGS.md)'s lever is the beam:iterations ratio
  (`beam ≈ iters/6`), and both inputs move in Duo: branching collapses (Classic peaked at
  541 legal moves, F10) *and* the ms-budgeted tiers therefore complete more iterations
  per move. Both push `iters/beam` up, so medium/hard are likely **under**-beamed —
  the mirror image of F8's original break, and equally invisible to the suite.
  **(2) Weights.** Two terms change *meaning*, not just magnitude. `center` is scored
  against `CENTER = (BOARD_SIZE−1)/2` ([heuristic.ts:22](../../../src/game/ai/heuristic.ts))
  and in Classic means "expand away from your corner" — but Duo *starts* interior at
  (4,4)/(9,9) with the centre as the contested zone, so the term's role inverts. `block`
  (`opponentCornersDenied`) counts denial against three diffuse opponents in Classic and
  against the single decisive one in Duo. [F2](../FINDINGS.md)'s "`center` ≈ noise,
  `block` mild" is a four-colour measurement.
  Assumption (M4): F2/F3's *mechanism* — own mobility is load-bearing — is
  domain-general and expected to survive; only the weights move.
- **Method:** AE27's shape. **Phase 1 (measurement):** instrument branching factor by ply
  and iterations/move per tier on Duo via `scripts/profile-mcts.ts`; compare the
  resulting beam:iters against F8's counts. **Phase 2 (conditional — fires only if the
  ratio drifted >2×):** rerun the J-confirm ladder arena on Duo sweeping medium/hard
  beam. **Phase 3:** weight ablation on Duo (the Run C design: full / no-center /
  no-block / f=10), seed-averaged, ≥600 pooled games per arm,
  `scripts/experiments/ae30-*.json`. Report the AE29 Duo-ladder readout for the winning
  config either way.
- **Success criteria:** (a) every Duo ladder step (easy < medium < hard < extreme) is
  CI-clear of 50% — a non-monotonic ladder is a **fail** regardless of absolute strength;
  (b) adopt a retuned beam or weight vector only if it clears **52%** game-share (Wilson
  lower bound) vs the Classic-inherited config over ≥600 pooled Duo games.
- **Power:** n=600 → MDE 56.0%. F8's beam effects were large (31%→70% across the sweep),
  so n=600 is comfortably sized if the drift is real — and a null at that n is itself the
  useful answer (the constants transfer). Confirm with `stats.py --power` at the start gate.
- **Cost / risk:** moderate compute (three phases; phase 2 only fires on measured drift),
  no engine change beyond config. Risk: retuning per variant doubles the tier surface — if
  phase 1 shows no drift, close early and record the transfer as a finding rather than
  shipping a second constant set.
- **Log:** —

### AE31 — Duo reward model: the placed-square leader is not the Duo winner
- **Drafted:** 2026-07-21
- **Status:** proposed (wants AE29's readout; no product gate left — P54 shipped
  2026-07-22 and the arena plays Duo, with placement now ranked by score in the scoring
  variant's own direction and placed-squares recovered separately, so advanced-scoring
  Duo readouts are trustworthy.)
- **Variant:** duo — Duo's advanced-only scoring is what makes the reward proxy wrong
  (M6).
- **Objective:** decide what an MCTS simulation in Duo should be rewarded for, given that
  two of the shipped reward's premises are false there.
- **Hypothesis:** two independent defects — one provable on paper, one measurable.
  **(1) `rankRewardWeight` is inert at two colours.** `rewardVector`
  ([mcts.ts:206-229](../../../src/game/ai/mcts.ts)) computes `(1−w)·winner + w·rankNorm`
  with `rankNorm = (beaten + (tied−1)/2)/(n−1)`. At n=2 the two terms are *algebraically
  identical* (win 1/1, tie 0.5/0.5, loss 0/0), so [F15](../FINDINGS.md)'s shipped w=0.25
  has literally no effect and the "fight for 2nd vs 4th" gradient it buys does not exist.
  **(2) The reward optimizes the wrong objective.** It ranks by *placed squares* — exactly
  the winner under **basic** scoring, but Duo is **advanced-only**
  ([GAME_SPEC_DUO.md](../../GAME_SPEC_DUO.md): +15 all-pieces, +5 monomino-last). A bot
  maximizing placed squares can lose a Duo game it could have won by keeping the monomino
  for last. Expect an advanced-score-aware terminal reward to beat the inherited one, with
  the gap concentrated in close endgames.
  Assumption (M4): the bonuses swing enough games to be detectable — measure that first.
  **Not evidence, just a reason the gate is worth running:** an incidental 12–20 game Duo
  probe while verifying product P54 showed the heuristic placing *more* squares than
  greedy-size (68.3 vs 66.7) while winning *fewer* games (~47% vs ~53%) — the exact shape
  hypothesis (2) predicts. At that n the spread was ±32–35%, i.e. indistinguishable from
  noise, and it was not seed-averaged (M1). It is recorded here as a pre-registration hint
  only; it is **not** a result, has no log run, and must not be cited as support.
- **Method:** **Gate (cheap, runs first):** over ≥200 Duo self-play games, count the games
  where the placed-square leader and the advanced-scoring winner *differ*. If <≈3%, close
  `no-win` on the spot — the reward cannot be worth more than the disagreement rate.
  **Arm:** terminal reward computed from `finalScores` under advanced scoring
  (winner-take-all on the true result) vs the incumbent placed-leader reward, head-to-head
  at matched iterations, ≥600 pooled Duo games, `scripts/experiments/ae31.json`. Report
  AE29 Duo-ladder placement for the winner. Also record whether `rankRewardWeight` should
  be dropped from the Duo tier configs as dead config (a hygiene outcome, not a bar).
- **Success criteria:** score-aware reward clears **52%** game-share (Wilson lower bound)
  vs the placed-leader reward at matched iterations over ≥600 Duo games. Gate: ≥3%
  winner-disagreement rate before any arena spend.
- **Power:** n=600 → MDE 56.0%, but the achievable effect is **bounded above by the gate's
  disagreement rate** — at 5% disagreement the ceiling sits near ~52.5%, needing n≈2400
  pooled. Set the required n from the *measured* gate rate at the start gate, not in advance.
- **Cost / risk:** small code (a terminal-reward swap behind config; `finalScores` already
  exists), moderate compute. Risk: the gate closes it cheaply — which is the design.
  Interacts with AE30: retune the beam on the reward you intend to ship, or run them in
  that order.
- **Log:** —
