# Backlog — AI & engine

Planned/deferred AI and engine experiments, each structured per
[../FRAMEWORK.md](../FRAMEWORK.md). Findings from things already run live in
[../FINDINGS.md](../FINDINGS.md); raw runs in [../log/ai-strategy.md](../log/ai-strategy.md).
This is the "not yet / open threads" list — keeping current work scoped.

Ordered roughly by expected payoff. Status vocabulary: `proposed` / `deferred` /
`won` / `no-win` / `played-out` (see FRAMEWORK).

---

### AE1 — Ship MCTS as the offline bot — SHIPPED
- **Status:** won / shipped. The research bar (MCTS beats the heuristic, CI clear of
  50) was met by Runs H–I ([FINDINGS](../FINDINGS.md) F6); delivered as a Web-Worker
  bot with a **four-tier difficulty ladder** ([difficulty.ts](../../../src/client/ai/difficulty.ts)):
  easy = heuristic, medium/hard = time-budget MCTS (500 / 2000 ms), **extreme =
  MCTS with no time budget** (fixed it500). Beam is scaled per tier (F8/AE5) after
  the assessment found a fixed wide beam broke the low tier.
- **Ladder is fully measured + monotonic** (Runs J / J-confirm / K): easy < medium
  (67 % vs easy) < hard (63 % vs medium) < extreme (79 % vs hard), every step CI-clear
  of 50.
- **Kept here as the record** linking the D–K research arc to its deployment. Further
  *product* work on the bot (the long-move UX for extreme; networked bot-fill) lives
  in the [product backlog](../../product/BACKLOG.md) (Epic: AI opponent); the open
  *research* levers are AE2 (faster) and AE3 (RAVE).

### AE2 — Make MCTS faster (more iterations per time cap)
- **Status:** proposed (partly banked — the anchor optimization already shipped a
  **~16× move-gen speedup**, F7/Run J engine note; this entry is now the *further*
  gains beyond that. Still valuable: each budget doubling ≈ +5 pts, and F8 showed
  medium is iteration-starved early game.)
- **Objective:** raise iterations-per-second so more search fits the AE1 time cap.
- **Hypothesis:** an incremental / cached `generateLegalMoves` removes the ~34 ms
  mid-game bottleneck; strength rises with the extra iterations bought.
- **Method:** cache/incrementalise legal-move generation (beyond the anchor
  restriction, F7); benchmark iterations/s and game-share at a fixed time budget.
- **Success criteria:** measurable iters/s gain with byte-identical move output
  (differential test), translating to higher game-share at fixed wall-clock.
- **Cost / risk:** moderate rules-core work; correctness guarded by differential test.

### AE3 — RAVE / AMAF value sharing
- **Status:** no-win (Runs L+M / F9) — implemented + measured; **54.0 % game-share
  vs plain UCT at matched iters, CI [49.1, 58.8], n=400**, bar (CI clear) not met.
  Kept behind `rave:false` (default, zero-cost) for a possible revisit at other budgets.
- **Log:** [Run L + Run M](../log/ai-strategy.md) → [F9](../FINDINGS.md)
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
- **Status:** **won / shipped** (Run J-confirm). Per-tier beam set in
  [difficulty.ts](../../../src/client/ai/difficulty.ts) (medium 6, hard 16); under
  **real time budgets** the ladder is monotonic and significant — medium 67 % vs
  easy (was 31 % at beam 16), hard 63 % vs medium. The finding flipped from "does a
  wider beam help Hard?" to "**beam must scale *down* with the small, phase-varying
  iteration budget or the low tier is broken.**"
- **Objective:** ship a per-tier (or budget-derived) beam so the difficulty ladder
  is monotonic. Rule of thumb from F8: `beam ≈ iters/6`.
- **Hypothesis:** narrow beam at medium (~6), wider at hard (~16) restores
  `easy < medium < hard`; may further tune hard (Leg A hints it160/beam12 = 85 %
  > it140/beam16 = 78 %).
- **Method:** set beam per tier in [difficulty.ts](../../../src/client/ai/difficulty.ts);
  re-confirm each ladder step head-to-head under **real time budgets** (not just
  fixed-iteration proxies), Wilson CI.
- **Success criteria:** each step beats the one below by ≥ 8 pts game-share, CI
  clear of 50, at the shipped budgets/latency.
- **Cost / risk:** tiny code change + a confirmation run.

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

### AE10 — Assess & tune difficulty time-budgets
- **Status:** resolved (Run J / F8) — **latency bars pass**, but the **ladder is
  inverted**: shipped medium (500 ms, `beam=16`) *loses* to easy (heuristic). The
  budgets are fine; the fix is **beam-scaling → hands off to AE5**. Re-confirm
  under real time budgets when applying the fix.
- **Objective:** choose the medium/hard time budgets (`BUDGET_MS` in
  [difficulty.ts](../../../src/client/ai/difficulty.ts)) that give a monotonic,
  well-separated difficulty ladder within a latency cap — decides what ships.
- **Hypothesis:** strength **saturates** (F6/Run I: +5 pts per iteration doubling,
  mid-90s ceiling), so the current `500 / 2000 ms` likely both land in the strong
  80–90 % band; the **medium↔hard head-to-head gap will be small** and the ladder
  is better spaced by handicapping the *low* end than by spending more at the top.
- **Method:** two legs, then a head-to-head.
  (A) *Strength vs iterations* — from the arena (Runs H/I + fill gaps via
  `runTournamentSeeds`, Wilson CI): full-rollout game-share vs heuristic is
  `it40→68 · it80→77 · it160→85 · it320→90`.
  (B) *Iterations vs time on the device* — instrument `mctsSearch(timeBudgetMs)` to
  log iterations/move **by game phase** (early/mid/late differ); node harness first,
  confirm in the browser Worker (structured-clone + scheduling overhead).
  Compose A×B → strength-vs-time; then run **heuristic vs medium-iters vs
  hard-iters** seed-averaged, both readouts + Wilson CI.
- **Success criteria (pre-registered):** (1) each ladder step beats the one below by
  **≥ 8 pts game-share head-to-head, CI clear of 50**; (2) **hard 95th-pctile move
  latency ≤ 2.5 s** on reference hardware. If medium↔hard is inside noise → re-space
  by handicapping medium (fewer iters, or a `beam` / `rolloutDepth` handicap — ties
  into AE5) and re-test.
- **Cost / risk:** mostly pure benchmark + light instrumentation; may add a
  difficulty handicap knob if re-spacing is needed.
- **Log:** —
