# Product backlog

Curated pool of **product / feature** ideas we want to build — the shippable,
user-facing side of the project. Sibling to [../research/](../research/): research owns
*questions* (measurable, arena/data-answered); this owns *features* (user value + UX
milestones). When a feature can't state a success bar without writing "N/A", it belongs
here, not in research.

A backlog is a **prioritized pool, not a committed plan** — its dependency-ready head is
the [Next up](#next-up) block below (the authoritative "what's next to build"); the
shipped build history lives in [../BUILD_ORDER.md](../BUILD_ORDER.md). Source pipeline
mirrors research:
[../dev_notes/OPEN_IDEAS.md](../dev_notes/OPEN_IDEAS.md) is the raw, unmaintained
developer dump; this file is the curated version. Rules → [../GAME_SPEC.md](../GAME_SPEC.md);
structure → [../ARCHITECTURE.md](../ARCHITECTURE.md).

Status vocab: `proposed` / `in-progress` (being built this session/branch) / `partial`
(some milestones shipped) / `shipped` / `deferred`. Product features don't carry a
hypothesis or a game-share bar — that's what distinguishes them from a research entry.

---

## Next up

The dependency-ready head of the backlog, highest-payoff first — the authoritative answer
to "what to build next." Refreshed by /ship on status flips + intake (see P22); the
schema test (P21) fails CI if any ID here is missing or terminal.

1. **P58** — variant-scoped onboarding & feel. Fully dependency-ready now that P20 M2c
   closed the Duo build-out; it's the Duo *content* gap that only a human can see (P59 is
   the rendering one), and its Classic-by-design sites now have a written precedent to
   follow — P55's lint exemptions.
2. **P59** — achromatic tray & thumbnail finish. A live legibility defect in a shipped
   variant, not a gap: one Duo seat's inventory is near-illegible on all three themes, seen
   during M2c's eyes-on pass. Small (tokenize four constants) and dependency-free, and it
   reuses the vocabulary M2c just landed while that is still fresh.
3. **P13** — ladder calibration policy (tiers as measured strength bands). Dependency-free
   but the lowest-urgency of the ready set; P13's bands are now also worth re-asking per
   variant, since the arena can play Duo.
4. **P55** — last, and not a build task: its three mechanical guards landed, and all that
   remains is *proposing* the CLAUDE.md Invariant line to the user. Listed so the one
   human-owned scrap doesn't drop off the map.

---

## Epic: Advisor & game analysis

The player-facing intelligence surface. Each feature **depends on a research question**
being answered first (the evaluator/win-prob/blunder signal must be *trustworthy*
before it's *shown*) — those questions live in
[../research/backlog/advisor.md](../research/backlog/advisor.md) (AD2–AD4). Build
order runs foundation → offline surfaces → live surfaces.

### P1 — Game-logging foundation (infra) — SHIPPED
- **Status:** shipped — offline vs-AI games are captured as replayable records
  (v2 of the self-play format: game header + move list) and written as JSONL to
  `.data/games/vs-ai.jsonl`; browse/verify with `scripts/games.ts`. Online capture
  deferred. Unblocks P2, P3, and research AD2–AD4 + AE4.
- **Value:** move-by-move data is the substrate for every analysis/advisor feature and
  for self-play datasets (learned eval, research AE4).
- **Scope:** minimal schema — **game header (mode, seeds, players, tiers) + the move
  list**; every position, score trajectory, and eval is *derivable by replay* through
  the pure rules core, so none of it is logged. Extend the AE4 self-play dump format
  (which already regenerates positions by replay) rather than inventing a second one.
  Keep app-logging (debug/telemetry) out of scope — separate concern.
- **Depends on:** nothing (it's the root).
- **Notes:** build-a-thing, not an experiment, so it lives here rather than research.
  Rescoped 2026-07-06 from "long-lived schema decision" to this minimal form — moves
  are already cheat-resistant canonical tuples, replay is exact.

### P2 — Post-game recap (play-by-play, blunders, key moments)
- **Drafted:** 2026-07-02
- **Status:** partial — **R0 + R0.1 + R0.2 shipped**: post-game review is now an in-table
  mode of the offline vs-AI table — frame-driven rendering, so the full-size board, the
  four player cards + hand tray, and the score/mobility timelines all track the scrubbed
  ply; the transport replaces the action bar. This succeeds the R0/R0.1 scrubber *modal*
  (`ReplayScrubber`, now removed) with `recap/ReviewTable` + the `useReplay` transport
  hook over an extracted `board/BoardFrame`. No AI. R1+ still blocked on research AD4
  signal, AD2 evaluator.
- **Value:** turn-level annotations after a game — "good plays," blunders, swings, with
  plain-English messages ("Turn 6: you closed your own corridor"). Special interest:
  games where humans beat the AI. A local LLM could later narrate the structured signal.
- **Scope / milestones:** **R0 — replay scrubber + score-over-time timeline, no AI**
  ("when did I fall behind?" — genuine advice with zero evaluator risk; scrubber
  shared with P15 M2). R1 — event thresholds → message templates → recap UI.
  R2 — **"retry from this turn"**: jump into the game at a flagged turn and play it
  out vs bots (replay to turn N via the pure rules core, hand control to the human) —
  closes the learn-loop. Shares assets with P3.
  **R0.1 (shipped) — scrubber playback + vertical ranking:** (a) auto-play — a
  play/pause button steps plies on a timer, with a small inline speed button that cycles
  1× → 2× → 5× → 1×, showing the active speed as its label; (b) the bottom player list,
  already reordered by score-rank at the scrubbed turn, laid out as a vertical ranked
  hierarchy (1st on top, descending) so standings read top-to-bottom. Playback removes
  manual stepping; vertical ranks parse faster than a reordered row. No evaluator — stays
  clear of AD4/AD2. Depends on: nothing (R0 shipped).
  **R0.2 (shipped) — review-in-table:** the scrubber stops being a modal and becomes a
  *mode of the game table itself*. When an offline game ends, P16's ceremony plays as it
  does today and, on dismiss, the table underneath is already in review mode: (a) the
  action bar is replaced in place by the scrubber's transport — step/play-pause/speed;
  (b) the live board *is* the replay board, no second scaled-down copy; (c) the right
  rail unmounts the standings + P34 M2 room meter, leaving the score + mobility timelines
  stacked on top with the hand tray below them as reference; (d) the four player cards and
  the hand tray re-render from the scrubbed ply, not the final position — inventories,
  scores and the last-placed highlight all track the scrub. **Offline vs-AI only** — the
  `GameRecord` is only ever built by the local AI table, so review mode never arms online.
  Why: the recap reads as the game you just played rather than a separate screen, and
  "when did I fall behind?" is answered on the board you were staring at, at the scale you
  were staring at it. R0's modal proved the content; this is the shell. The real work is
  decoupling the table to render from either the live client or a `buildRecap` frame at
  ply N — the layout swap is cheap by comparison, and that decoupling is the same
  substrate P15 M2's standalone shell would need. Depends on: nothing (R0/R0.1 shipped;
  P34 M1's chart reused as-is).
- **Depends on:** P1 (logs) for all milestones; R0 needs nothing else. R1+: research
  [AD4](../research/backlog/advisor.md) computes/validates the signal (MCTS
  best-move gap + eval-swing); research AD2 for the score. AD4 also feeds P14 M2
  (daily-puzzle move grading) — shared payoff. **R2 note (2026-07-13):** the
  replay-fork itself isn't blocked on AD4 if the player picks the turn manually —
  AD4 only automates the flagging. The standalone branching mode is P33.
  **R0.2 note (2026-07-17):** R0.2 **removed** the `ReplayScrubber` modal, so P15 M2's
  planned reuse of it is gone. P15 M2 now builds its history-replay shell on R0.2's
  decoupled substrate instead — `recap/ReviewTable` + `useReplay` render from a
  `GameRecord` with no live client, which is exactly what a standalone shell needs.

### P3 — Mid-game advisor overlay
- **Drafted:** 2026-07-02
- **Status:** partial — **R1 shipped**; R2+ deferred until the evaluator is trustworthy.
- **Value:** live in-game guidance without overwhelming the player.
- **Scope / milestones:** R1 "show legal placements" — **shipped**: opt-in "Legal moves"
  toggle in the game view highlighting every square the selected piece can legally land
  on, tinted in the active player's color (`legalTargetCells` over `generateLegalMoves`,
  rendered via the shared `src/client/advisor/LegalMoveHints`). → R2 "suggest 2–3
  candidate moves with plain-English reasons" → R3 "heatmaps / strategic priorities."
- **Depends on:** R1: nothing. R2+: P1; research AD2 (evaluator) + AD3 (win-prob).
  High UI complexity in R2+.

### P4 — Pre-game tutorial (interactive) — SHIPPED
- **Status:** shipped — four-step interactive tutorial reachable from the home screen
  ("New to Blokus?"): start-from-corner → own-edge-touch rejected → many corner options
  → cramped-vs-open expansion. Every hint's legality/quality is derived from the rules
  core (so the lesson can't drift), and the shared legal-placement highlight lives in
  `src/client/advisor/` (`LegalMoveHints` + `legalMoves`) for P3 R1 to reuse.
- **Value:** teach the four core ideas faster than text — corner-touch rule, no
  own-edge-touch, first move from your corner, preserving expansion lanes.
- **Scope:** scripted 4-step interactive sequence: place a legal piece → see an illegal
  edge-touch rejected → see multiple corner options → compare "bad but legal" vs "better
  for growth."
- **Depends on:** nothing. Mostly UI. Step 3 reuses P3 R1's legal-placement
  highlight component — build once, share.

### P34 — Mobility surfaces (review chart + opt-in advisor meter) — SHIPPED
- **Status:** shipped — M1 (review chart) `1e3efcc`; M2 (live opt-in meter) `41962e1`.
  Both surfaces read the same `attachPoints` frontier, so the live meter and the recap
  chart cannot disagree — the "build it once, both consume it" bet below held.
- **Value:** mobility (open corners / legal moves) is what actually diverges
  mid-game — score tracks closely until late. Surfacing it teaches the game's core
  heuristic; explicitly a *coaching* feature, so it lives in advisor/review surfaces
  and never in the default game view.
- **Scope / milestones:** **M1 — review chart:** mobility-over-time per color in the
  replay scrubber, alongside the P2 R0 score timeline ("when did my room
  collapse?"); computed by replay through the rules core. **M2 — live opt-in
  meter:** a per-player "room" indicator behind an advisor toggle, sibling to the
  Legal-moves toggle (P3 R1); off by default.
- **Depends on:** M1: P2 R0 (shipped). M2: nothing hard. Ground-truth signal — no
  AD2/AD3 evaluator dependency. Shares the frontier computation with P32's
  detectors — build it once, both consume it.
- **Naming:** the user-facing "Room" wording (M1's chart, M2's toggle) is renamed by
  **P38** — chart → "Open Corners", toggle → "Corner Counter". P38 owns that edit.

### P39 — Dead-piece shading (red overlay on unplaceable inventory pieces)
- **Status:** shipped — full scope: independent **Self** and **Opponents** toggles under
  P38's Advisor Features (both opt-in, off by default), tinting each inventory piece with
  zero legal placements this turn. Ground truth from the rules-core legal-move enumeration
  (shared with P3 R1 / P34), so the read can't drift; shading is per-turn ("unplayable",
  not permanently "dead"). Covered by `e2e/unplayable-pieces.spec.ts` + `tests/advisor.test.ts`.
- **Value:** a piece with no legal placement left is *already lost* — the player is
  still counting it as an option and planning around it. Shading it answers "what can
  I still actually play?" at a glance, and the Opponents half turns the same read
  outward ("their big pieces are dead — I'm ahead on room"), which is the mobility
  intuition P34 teaches, made concrete per piece.
- **Scope:** an advisor overlay tinting each inventory piece red when it has zero legal
  placements for its color on the current board. Two independent toggles under P38's
  Advisor Features section — **Self** (own inventory) and **Opponents** (all other
  inventories); both off by default. Ground truth from the rules core, so the read
  can't drift. No hidden information: inventories and board are public, so the
  Opponents read is derivable by any player at the table. **Open question:** whether an
  already-eliminated color shades fully (every piece dead by definition) or is excluded
  as noise.
- **Depends on:** P38 (the settings home for the toggles). Shares the legal-move
  enumeration with P3 R1 and P34's frontier work — one computation, several consumers;
  the naive per-render sweep across pieces × colors × orientations is the cost to watch.

---

## Epic: AI opponent (offline)

The single-player-vs-computer surface. The *strength* questions live in
[../research/backlog/ai-engine.md](../research/backlog/ai-engine.md) (AE1–AE10);
this epic owns the user-facing feature + its UX.

### P9 — Offline vs-AI with difficulty tiers — SHIPPED
- **Status:** shipped — four-tier ladder, measured monotonic (research AE1, Runs J–K;
  per-tier beam F8/AE5). Difficulty is **per bot seat** — each opponent's tier is chosen
  independently in setup (mix easy/hard/etc.). Details:
  [difficulty.ts](../../src/client/ai/difficulty.ts) + ARCHITECTURE §9.
- **Value:** single-player practice at a real, verified difficulty ramp; mix opponent
  strengths for asymmetric practice.
- **Remaining:** none — long-move UX for `extreme` shipped as P10.

### P10 — Long-move feedback for the strongest tier
- **Status:** shipped — the "AI thinking…" indicator now shows a spinner + live
  elapsed-seconds counter, with a "· deep search" note once a move runs past 8 s
  (`AiThinkingIndicator` renders off `useBotRunner`'s per-move `since` timestamp).
  Client-only; no engine/worker change.
- **Value:** `extreme` has *no time budget*, so early-game moves take ~12 s; the plain
  "AI thinking…" text shows no progress and can read as "stuck / broken." The strongest
  tier shouldn't feel frozen.
- **Scope:** progress/elapsed feedback during a long search (spinner, "thinking… Ns",
  or a soft-cap/label warning it's slow). Optionally surface iterations done. Could
  reuse a worker→UI progress message.
- **Depends on:** nothing (the worker already reports back per move).

### P11 — Networked bot-fill (bots in online matches)
- **Status:** deferred. AI is offline-only today; filling empty seats in lobby/online
  matches with bots is a separate feature (server- or client-driven, plus turn-order
  and disconnect handling). Noted deferred in ARCHITECTURE §9.
- **Value:** start/again online games without waiting for a full human lobby.
  Also the escape hatch from the client-side compute ceiling (research F14/AE25):
  a server-hosted engine could power an *online-only* tier beyond what the
  browser can reach (Pentobi L7+ compute).
- **Depends on:** server integration decisions; reuses the shipped bot strategies.

### P13 — Ladder calibration policy (tiers as strength contracts)
- **Drafted:** 2026-07-06
- **Status:** proposed.
- **Value:** as bot research lands wins, the difficulty ladder stays meaningful
  instead of drifting or bloating: each tier keeps the strength players learned it
  to mean, and a new named rung (`nightmare`, `immortal`, ...) appears only when
  the ceiling genuinely moves. Serves the original motivation (stable practice
  rungs) better than freezing configs — a tier is pinned to a *measured band*,
  re-verified after engine changes, not to an implementation.
- **Scope:**
  - Define each tier as a **strength band + latency budget** measured against a
    frozen anchor pool (heuristic bot + snapshots of shipped tier configs);
    `MCTS_TIERS` in [difficulty.ts](../../src/client/ai/difficulty.ts) becomes an
    implementation detail, retunable at will. Shippable tiers are latency-bounded
    bands; the ladder tops out toward the unbounded-budget **champion** — the strength
    ceiling with no latency constraint, tracked as research AE21's versioned top
    anchor and the reference each tier's strength gap is measured against.
  - **Decision rule per AE win:** efficiency wins (same strength, cheaper —
    AE2/AE9/AE17-type) retune existing tiers in place (snappier moves, same band);
    **ceiling wins** mint a new top tier only if they beat the current top by a
    measured margin (≥60 % game-share, per that AE entry's bar) *and* meet a
    latency budget — otherwise fold into `extreme`'s config.
  - **Budget-regime axis (F17/F18):** a knob's optimal value is *tier-dependent*
    because tiers differ in budget model — a win measured at matched-wall-clock
    applies to the time-budgeted tiers (medium/hard), one measured at fixed
    iterations applies to `extreme`. Evaluate each deploy against *that tier's*
    budget, not globally. Worked example: `rolloutSamples` ≈ 24 for medium/hard
    (width buys free iterations, F17) vs 48 for `extreme` (width buys strength, F18).
  - Recalibration workflow: after any engine change touching shipped tiers, re-run
    the ladder monotonicity arena check (Runs J–K precedent) plus anchor-pool
    matches; cap the ladder at ~5–6 named rungs (keeps the per-seat picker and
    P18 personas sane).
  - Code side as before: extend `Difficulty` union + `DIFFICULTIES` order +
    per-tier bot-strategy map once tiers diverge past MCTS-config; setup UI tier list.
- **Depends on:** research AE21 (population-play Elo — the anchor-pool measurement
  that makes recalibration cheap and trustworthy); a won AE experiment beating the
  current top tier for any actual new rung.

### P36 — Retune MCTS tiers with rankRewardWeight 0.25 (deploy F15)
- **Status:** shipped — `replication-pending` — `DEFAULTS.rankRewardWeight` flipped
  0 → 0.25 in [mcts.ts](../../src/game/ai/mcts.ts) so bare/advisor MCTS callers get
  F15's rank-normalized reward shaping (tiers already overrode it), plus a guard test
  locking the shipped default and its 2nd-vs-4th gradient. Backed by AE15/[F15](../research/FINDINGS.md)
  (`significant`); no second seed batch was run — the shipped-defaults replication is
  still owed, tracked in AE15 (research `## Next up`). The scope's ladder-monotonicity
  re-run was **dropped as void**: P36 changed no tier config (the tiers already carried
  an explicit 0.25 since c7172bc), so the ladder is byte-identical before/after.
- **Value:** deploys research win AE15/F15 (rank-normalized reward shaping at
  w=0.25) to the base `DEFAULTS` — the tiers already carried it explicitly (c7172bc);
  this closes the gap for bare/advisor MCTS callers. Buys better
  lost-position play (bots fight for placement/score when the win is gone, +1.3
  placed squares / −0.24 placement, both CI-clear at no win-rate cost) and hands the
  advisor (AD2/AD3) a **non-degenerate value signal** in lost positions instead of a
  flat winner-take-all reward.
- **Scope:**
  - Flip the `rankRewardWeight` default 0 → 0.25 in
    [mcts.ts](../../src/game/ai/mcts.ts) — a retune-in-place per P13's decision rule
    (same tiers, better play), not a new rung.
  - **Replication:** the shipped-defaults rule requires a second independent pooled
    seed batch confirming F15's game-share guard before landing — or an explicit
    `replication-pending` label at landing. Run/pool the batch via /research (this is
    a default change to a shipped tier).
  - Re-run the ladder monotonicity check (P13 recalibration workflow) after the flip.
- **Depends on:** research AE15 / F15 (won). No new engine work — config default flip
  plus the replication batch.

### P37 — Deploy extreme rollout width (`rolloutSamples` 48)
- **Status:** shipped — `replication-pending` — extreme's `rolloutSamples` flipped
  6 → 48 in [difficulty.ts](../../src/client/ai/difficulty.ts), plus opt-in
  rollout-sampling instrumentation in the MCTS core (surfaced via `arena --rollout-stats`).
  Backed by AE28/[F18](../research/FINDINGS.md), a single well-powered run (n=600, CI
  clear); no second seed batch was run — the shipped-defaults replication is still owed.
- **Value:** deploys research win AE28/[F18](../research/FINDINGS.md), which sits won
  but unshipped. At `extreme`'s fixed 500-iter budget, `rolloutSamples` 48 beats the
  shipped 6 by **+11.3 pts game-share** (Wilson CI [57.3, 65.1], pure rollout quality —
  no wall-clock confound) *and* cuts move time ~1.35× (bigger-piece playouts terminate
  sooner). The strongest tier gets stronger **and** snappier at zero code cost. Per
  P13's decision rule this is a "fold into `extreme`'s config" retune (a within-tier
  strength gain, not a new rung).
- **Scope:**
  - Raise `rolloutSamples` 6 → 48 for the `extreme` tier only in
    [difficulty.ts](../../src/client/ai/difficulty.ts) (config-only). medium/hard are
    unaffected — their width optimum is ~24 as free iterations (F17, per P13's
    budget-regime axis); retuning them is a separate follow-up, left as-is here.
  - Instrument the `fallbackMove` / sample-with-replacement waste rate at width 48 in
    sparse endgames (currently unmeasured; a guard only — no correctness risk, just
    wasted cycles when a position has < 48 legal moves).
  - Re-run the ladder monotonicity check (P13 recalibration workflow) after the flip.
  - **Replication:** F18 is one well-powered run (n=600, CI clear); per the
    shipped-defaults rule, either a second pooled seed batch via /research or an
    explicit `replication-pending` label at landing.
- **Depends on:** research AE28 / F18 (won). No new engine work — config default flip
  plus the instrumentation.

### P18 — Bot personas
- **Status:** deferred — until the difficulty ladder matures (2026-07-13): best-bot
  research (AE pool) is still moving and P13 hasn't landed, so personas pinned to
  today's tiers would need re-authoring when the ladder shifts.
- **Value:** turns "difficulty dropdown" into rivals — name, face, think-time quips,
  and a *real* play style (heuristic weight variants: aggressive blocker vs greedy
  expander), not just cosmetics.
- **Scope:** persona definitions mapped onto existing tiers + weight variants; setup
  UI picks rivals instead of tiers (tier still visible); **head-to-head rivalry
  records** — per-persona W/L persisted in the P15 store, surfaced at setup + win
  screen ("Greta leads you 4–2"). Future framing once tiers are strength contracts:
  a **campaign/completion roster** — a fixed set of rivals to beat in order.
- **Depends on:** P13 (tiers as strength contracts) + a settled top tier. Optional
  later research follow-up if we want to *verify* styles are distinct (would then
  get an AE entry).

### P54 — Variant-aware AI harness (let the arena play Duo) — SHIPPED
- **Status:** shipped (2026-07-22) — all three surviving (rescoped) items landed: the
  arena takes a variant and drives the playing set from it (`--duo` or a `--config`
  carrying `"variant": "duo"`), the Duo AI guard test exists, and the threshold re-check
  did move the bar — so a Duo threshold set and [../EVENTS.md](../EVENTS.md)'s **Duo
  deltas** section landed with it. Classic is unchanged: AE18's byte-identity golden
  passes untouched.
- **Rescoped 2026-07-22 — most of this entry was already built.** As drafted, P54
  claimed the whole layer above the rules core still hardcoded 20×20 and four colors,
  so the bots played "a corrupted game" and the event/advisor/share surfaces silently
  produced nothing on a Duo board. Checked against `src/` before claiming: **not true
  any more.** P20 M2b's required-`size` sweep and P56's variant-identity pass together
  fixed the live callers — `heuristic.ts`, `mcts.ts`, `alphabeta.ts` and `simstate.ts`
  all read `boardSizeOf`/`startCellOf`/`playColorsOf`, and `drama.ts`, `recap.ts`,
  `share.ts`, `advisor/incursions.ts` and `advisor/legalMoves.ts` are variant-aware
  too (`drama.ts`'s literal 20-stride cell key is now a variant-agnostic 32-stride).
  The *why* those two entries absorbed it: both had to touch the same call sites, so
  splitting the work would have edited them twice. What survives is the part neither
  entry needed — the research harness.
- **Value:** the **arena cannot set up a Duo game at all**, so no Duo experiment can
  be run, measured, or replicated. That is the one thing still blocking AE29–AE31, and
  it is a harness gap rather than a correctness bug: the bots are already right, they
  just can't be benchmarked on the variant.
- **Scope:**
  - **Harness.** [../../src/game/ai/arena.ts](../../src/game/ai/arena.ts) is Classic-only
    *by construction*, not by oversight: it imports `COLOR_ORDER` as the playing set
    (`advanceActiveColor`, `playGame`'s live-color counter and active-color read,
    `runTournament`'s seat rotation, winner filter and placement loop, `seatPosOf`),
    `playGame` defaults `mode = 4` with no `variant` argument, and `runTournament`
    throws unless handed exactly four contestants. A comment in `advanceActiveColor`
    explicitly defers this to P54. Take a variant and drive the playing set from it.
    Sweep [../../src/game/ai/arena.cli.ts](../../src/game/ai/arena.cli.ts)'s seat
    construction too, so `npm run arena` can actually run the match.
  - **Guard:** there is no Duo AI test anywhere in `src/game/ai/`. Add a
    differential/invariant test running the heuristic and a short MCTS search on a Duo
    state — no out-of-range board reads, legal first moves on the interior start cells,
    terminal detection over two colors and not four. The failure mode is invisible
    otherwise, which is exactly how the original entry's premise went stale unnoticed.
  - **Thresholds:** re-check `EVENT_THRESHOLDS` legibility on a 14×14 board (they were
    calibrated against Classic frontier magnitudes) and update
    [../EVENTS.md](../EVENTS.md)'s frontier note if they move.
  - **Explicitly not here:** *tuning* for Duo (weights, beams, reward). Those are
    measurable and belong to research (AE29–AE31). This entry only makes the harness
    capable.
  - ~~**Closing step — make `size` required.**~~ Landed with P20 M2b — `size` is a
    required argument of `idx`/`xy`/`inBounds` in
    [../../src/game/board.ts](../../src/game/board.ts), so the silent-corruption path is
    a typecheck error now.
- **Depends on:** [P20](#p20--variety-blokus-duo--blitz--shipped) M2b (`config.playColors`,
  `black`/`white` in the `Color` union). **Unblocked** research AE29–AE31
  ([ai-engine.md](../research/backlog/ai-engine.md)) — the arena can now play a Duo game;
  closing those loops is /research's, not this entry's.
- **Correction (2026-07-22):** this entry previously claimed `arena.ts` and `arena.cli.ts`
  were *the last two* `COLOR_ORDER`-as-playing-set callers, so
  [P55](#p55--mechanical-classicduo-separation-make-variant-drift-impossible-not-discouraged)'s
  lint scope could simply be widened after P54. **That was wrong** — several more remain,
  all legitimately Classic-scoped rather than bugs. Consequence, which is the durable part:
  **P55 wants an exemption list, not a clean sweep** — a refinement of its scope, not a
  blocker on it. The list itself is deliberately *not* recorded here; P55 re-derives it at
  build time, when it will be accurate. (Lesson, now in CLAUDE.md's *Claim discipline*:
  an exhaustive inventory in prose rots on contact — write the consequence, or a test.)

---

## Epic: Game feel & UI

Look, feel, and interaction. Curated from [../dev_notes/OPEN_IDEAS.md](../dev_notes/OPEN_IDEAS.md)
§UI. Theming principle: playful skeuomorphism, translucent-plastic Blokus pieces, the
four classic colors as accents, shapes as the star.

### P5 — Skeuomorphic piece & board finish — SHIPPED
- **Status:** shipped (2026-07-16) — the whole surface now carries one molded finish:
  the board is injection-molded plastic (MatLayer: lattice + per-cell wells + alignment
  studs), placed cells are per-cell translucent tiles over it (PlacedLayer; supersedes
  the earlier joined-piece gel), and the tray/thumbnails are molded to match. All lit
  from one direction, retuned per built-in theme via tokens.
- **Value:** the tactile "real Blokus set" identity.
- **Scope:** hyperrealistic board plastic; per-palette piece finishes; grain/bevel/shadow.
- **Notes:** no literal surface *grain* — deliberate. Molded plastic reads through lit
  and shadowed flanks, not noise texture, so the scope's "grain" is met by the mold
  rather than a grain layer. Depth that a flat top-down view can't give stays out of
  scope here and lives in the deferred real-3D entry.

### P6 — Board layout & navigation — SHIPPED
- **Status:** shipped — "study table" three-column layout (players · framed board +
  action dock · hand + standings), centered; board auto-orients the player's corner
  bottom-right with an animated rotate-view button; full keyboard/mouse placement model
  + read-only controls reference.
- **Value:** comfortable placement + orientation control.
- **Scope:** WASD/cursor hover, scroll/arrows rotate, space/click place, Enter submit;
  rotate-view button; board positioning.

### P12 — Theming & Settings panel — SHIPPED
- **Status:** shipped — one Settings surface (gear icon) consolidates: theme scheme
  (Linen / Lamplight / Walnut), the piece-color palette editor, an inventory-display
  toggle (piece silhouettes vs 21-dot), and live overrides for **every** font/color
  design token (grouped, collapsible; per-token reset + reset-all).
- **Value:** deep visual customization with no code; instant retint.
- **Notes:** unified into **one appearance model** (2026-07): every value — fonts,
  surfaces, board, *and the four piece colors* — is a CSS custom property on `<html>`
  (no React re-render), a theme is a complete assignment of that vocabulary, and tuning
  any token **forks** the active built-in into a named user theme — which is what
  "custom palettes" now are. So built-ins stay pristine and an override can't leak
  across themes; the old four-store split (theme / token overrides / palettes) made
  precedence an accident of the CSS cascade. Inventory display is a *preference*, not
  appearance, and stays in its own store. Why → [../ARCHITECTURE.md](../ARCHITECTURE.md)
  §6. Top-bar triggers are emoji-free monochrome SVG icons.

### P38 — Gameplay settings tab (advisor toggles move into Settings)
- **Status:** shipped — advisor toggles now live in a **Gameplay** tab in the Settings
  panel as plain switches; the under-board emoji buttons are gone (rotate-board stays).
  Corner vocabulary unified: "Legal moves" → Move Options, "Room" → Corner Counter /
  Open Corners.
- **Value:** the board's surroundings are for play, not configuration. Two advisor
  toggles (P3 R1, P34 M2) accreted as ad-hoc emoji buttons under the board, and every
  further advisor feature would add another. P12 already established one Settings
  surface as the home for preferences — gameplay preferences belong there too, so the
  board view stays clean and the pattern scales as the advisor grows (P39, P3 R2+).
- **Scope:** a **Gameplay** tab in the Settings panel with an **Advisor Features**
  section; the two existing toggles move there as plain switches (the idiom P12's
  inventory-display toggle already set), losing the emoji labels and the under-board
  buttons. Renamed for what they do: "Legal moves" → **Move Options**, "Room" →
  **Corner Counter**, and P34 M1's replay-scrubber chart "Room" → **Open Corners**, so
  the corner vocabulary is one word everywhere (P34 points here for that rename). These
  are *preferences*, not appearance — same split P12 drew, so they keep their own store;
  off by default, unchanged.
- **Depends on:** P12 (the panel + toggle idiom), P3 R1 and P34 M1/M2 (the toggles +
  chart being moved). Pure UI relocation, no rules-core work; the e2e tests that drive
  the toggles move with them.

### P7 — Sound design — SHIPPED
- **Status:** shipped — a **procedural** cue palette (Web Audio synthesis, zero assets)
  covering the four [EVENTS.md](../EVENTS.md) ids 1:1, plus pickup, placement (pitch
  scales with piece size) and the blitz final-seconds tick P24 reserved. Mute/volume
  prefs follow the `useSyncExternalStore` pattern.
- **Value:** nostalgic 90s/2000s-internet feel; MIDI/Flash-era piece-placement sounds. Should be deeply satisfying.
- **Why it stayed cheap:** cues ride the beat stream `useGameEvents` already produces, so
  a cue and its banner are one moment and P32's anti-spam is inherited, not re-derived —
  the design work really was picking sounds, not deciding when they fire. Synthesis over
  samples keeps the palette tunable in code (and the bundle asset-free).
- **Deviation:** the e2e spec asserts on the rendered **waveform** (via
  `OfflineAudioContext`), not on oscillator counts — a count proves a cue fired, never
  that it was *audible*. Not academic: it caught the limiter's default 30 dB knee
  compressing below every cue in the palette, quietly ducking the whole game.
- **Depended on:** P32 (event vocabulary — the cues' trigger source). Synergy with P16
  (juice) noted there: same event hooks.

### P47 — Auto-mute when watching a fully-bot game — SHIPPED
- **Status:** shipped — the prefs store now publishes an *effective* snapshot (stored
  pref narrowed by a non-persisted contextual mute); `LocalAIGame` declares
  `humanCount === 0` and the settings panel says "Muted — watch game", so the quiet is
  legible and an explicit un-mute overrules the context for that game only.
- **Value:** an all-AI watch game (0 human seats) fires placement/pickup cues with no
  one acting, so the audio is a soundtrack the spectator never asked for. Defaulting a
  watch game to silence respects that no human triggered any of it.
- **Scope:** when `humanCount === 0`, suppress game sound by default as a **contextual
  override** — do *not* mutate the saved mute/volume pref. A real game restores the
  user's sound automatically; the user can still manually un-mute the watch game. The
  watch signal already exists (`LocalAIGame`); sound rides `useGameSound` in the board
  view, so this is a gate on that path, not new plumbing.
- **Depends on:** nothing (P7 shipped).

### P8 — 3D presentation
- **Status:** deferred — investigated 2026-07-02; 2D gel chosen for the resting board (P5).
- **Value:** depth/tactility a fixed top-down 2D view can't give, and the pieces' real
  translucent-plastic quality (light *through* the material) which only reads at an angle.
- **Why deferred:** resting Blokus is a single flat coplanar layer — pieces never overlap
  or stack, so straight overhead, real-3D's translucency win (light through *overlapping*
  pieces) plus bevel/parallax are wasted; live three.js `transmission` mockups wash toward
  white dead-overhead. 3D pays off only where an **angle** is reintroduced — the features
  below. So resting pieces stay 2D (P5 gel); 3D is scoped to angled surfaces.
- **Scope / candidate features:**
  - rotate-the-board **3D** view (perspective tilt — distinct from the 2D 90° rotate in P6)
  - 3D "table" / play-area presentation
  - tilted / piled piece-inventory tray (pieces as a pile on a table)
  - drag "swing": a lifted piece tilts + casts a shadow as it nears the board, snaps flat
    on drop — needs a press-drag substrate first (P23 M2 was dropped, so P23 shipped only
    click-based sticky carry; this feature must build its own drag/pointer layer)
- **Depends on:** nothing hard; it's an investment tied to whether these angled surfaces
  get built.
- **Likely shape:** keep the DOM cell grid for interaction/preview/a11y; add a
  react-three-fiber canvas overlay (WebGL sibling of PlacedLayer) for visuals only. Piece
  color = `material.color`, so custom palettes keep working. Cost: `three` (~150kb gz) +
  swapping some DOM-color test assertions for screenshot compares.
- **Caveat:** literal "board grid showing *through* a piece" needs the placed cell to stop
  being an opaque solid color (currently pinned by the palette e2e). Revisit that contract
  for true see-through.

### P16 — In-game drama (placement weight, endgame beats, win reveal)
- **Status:** shipped
- **Value:** the most-repeated action (~84 placements/match) and the two biggest
  moments (going out, winning) currently have zero ceremony.
- **Scope:** placement settle animation + invalid-move shake; "X is out of moves"
  beat; live score count-up; game-over reveal — score bars race, winner's pieces
  glow, final board presented as a shareable mosaic (replaces the static
  [GameOverModal](../../src/client/controls/GameOverModal.tsx) table).
- **Depends on:** nothing. Strong synergy with P7 (sound) — same event hooks.

### P17 — Front door: quick play, invite links, home screen redesign — SHIPPED
- **Status:** shipped — one-click **Quick Play** (last-used vs-AI setup persisted;
  full setup behind a Customize disclosure), **invite links** (`?join=<matchID>`
  deep-link auto-joins on load then strips the param; copy-invite buttons on matches
  + in-game; dismissible join-error strip), and a **study-table home redesign** on
  the game screen's own token vocabulary (shared `PANEL`/`PRIMARY_BTN`/… primitives
  in theme.ts, `table-bg` + docked top bar, and a read-only **hero board** reusing
  PlacedLayer so it inherits the gel finish / palette / theme for free).
- **Value:** first impression is now the board itself + one click to play, not
  dropdowns and a match-ID box.
- **Deviation:** GameOverModal did **not** adopt the shared `PANEL` — it keeps its
  heavier modal shadow (overlay dialog, e2e-covered); the "one source" consolidation
  is left for a later pass.

### P23 — Carried-piece placement (pointer holds the piece until you drop it) — SHIPPED
- **Status:** shipped — M1 sticky carry landed (staged-state click semantics included).
  M2 (true drag) dropped; sticky carry resolves the mis-click/blitz-forfeit problem.
- **Value:** today a selected piece is dropped by a stray click — `selectPiece` toggles
  off when you re-click the thumb you already hold. Harmless in untimed play; in blitz
  (P20 M1) the clock keeps running while you're holding nothing, so a mis-click silently
  costs you the move and the timeout plays a random one. A carried piece makes selection
  *sticky*: it goes away only when you mean it to.
- **Scope / milestones:**
  - M1 sticky carry — once selected, the piece follows the cursor and survives any click
    that isn't a deliberate release; deselect narrows to `Esc` or dropping it back on the
    tray; re-clicking the held thumb no longer toggles off; rotate/flip (scroll, WASD,
    arrows) keep working mid-carry.
  - M2 true drag — **dropped** (not deferred): sticky carry (M1) already fixed the
    mis-click/blitz-forfeit problem, so press-drag-release + touch/pointer-event support
    isn't worth its cost. Revisit only if touch demand resurfaces.
  - **Staged-state click semantics.** With a piece staged, a click **outside** the staged
    footprint unstages it (back to positioning; hover resumes following the cursor) rather
    than silently re-staging at the clicked cell, which is today's behavior and reads as an
    accidental relocation. A click **inside** the footprint is the deliberate "pick it back
    up" gesture and also unstages. Placement remains submit-only; no click ever places.
    Costs one extra click to *move* a staged piece (click to unstage, click to re-stage) —
    accepted: relocating is rarer than cancelling (M2 drag, which would have made it moot,
    is dropped, so this is the permanent trade).
    *Why here:* the board click handler stages unconditionally and hover is frozen while
    staged, so a stray click relocates your placement and can fire P16's shake — P23 owns
    that handler, so fixing it separately would rewrite it twice under two contracts.
- **Interaction contract:** **drop == stage, not submit** (decided at intake) — the
  explicit submit step stays, because the staged-but-unsubmitted state is what P16's
  illegal-placement shake and P3's advisor overlay both hang off. P6's keyboard-only
  path must stay complete and a11y-equivalent (it's covered by e2e). Cheat-resistant
  `(pieceId, rotation, reflected, x, y)` dispatch unchanged — this is pointer semantics
  only, no rules-core or move-shape change.
- **Depends on:** nothing hard. **P8 note (was "shares assets"):** with M2 dropped, M1
  shipped only *click-based* sticky carry — no press-drag substrate. P8's deferred drag
  "swing" (lifted piece tilts + shadow, snaps flat on drop) therefore has nothing to hang
  off here; if built it must add its own drag/pointer substrate first.

### P26 — Emoji-grid share (Wordle-style board in "Copy result")
- **Status:** shipped — `emojiBoard` (a pure `G → string` renderer in the rules core, so
  the core-only puzzle can reach it too) sits under **both** share surfaces: the game-over
  summary and P14's daily share. Went with the **full 20×20** — verified faithful against
  the rendered board — on the reasoning that downscaling blurs the one thing worth sharing,
  which corners each color owned.
- **Value:** the game-over "Copy result" currently copies two lines of text (headline +
  scores). A Wordle-style emoji grid of the final board — 🟦🟨🟥🟩 for placed cells, ⬜
  for empty — is instantly recognizable, screenshots itself, and turns a finished game
  into a share. Cheap: the board and the palette→square mapping already exist.
- **Scope:** a pure `G → string` renderer (flat `G.board`, 20×20, color→emoji, null→⬜)
  behind the existing Copy result button in `GameOverModal`; keep the headline + final
  scores as caption lines above the grid. One share string, no new UI surface. Decide:
  full 20×20 (400 glyphs — faithful but large in some clients) vs a downscaled block
  grid; default to full, revisit if it wraps badly where people actually paste.
- **Depends on:** nothing (board + palette exist; `resultSummary` in `drama.ts` is the
  seam). **P14 reuses this** — its Value already promises a "shareable emoji-grid result
  (Wordle-style)"; build the renderer here, P14's daily share calls the same function
  instead of re-scoping it.

### P27 — Landscape lobby layout (use the width on desktop)
- **Status:** shipped — above a 1200px breakpoint the three action cards lay out in a row
  and the cap relaxes 920→1280px; the open-matches list takes a wide slot below beside a
  secondary progression + decorative-hero column. Below the breakpoint the original
  single-column stack renders unchanged. Each home block is built once and arranged by the
  layout (no duplicated JSX, no behavior change); new reactive `useWideLayout` hook mirrors
  `useReducedMotion`. `src/client/lobby/HomeScreen.tsx`, `src/client/hooks/useWideLayout.ts`.
- **Value:** the home screen (P17) caps at 920px and stacks Play-vs-computer, Play-online,
  and Progression in one narrow column beside the hero board, so a desktop/landscape
  viewport shows a tall centered strip with wide dead margins on both sides. The content
  exists to fill a row; the layout doesn't let it.
- **Scope:** a responsive breakpoint — above it, lay the three cards out horizontally (row
  or 2-up grid) and raise/relax the 920px cap so they use the width; below it, the current
  single-column stack is preserved unchanged (portrait/mobile must not regress). Decide
  where MatchList and the hero board sit in the wide layout (hero is decorative — it
  shouldn't claim prime horizontal space over the actionable cards). CSS/layout only, no
  new components, no behavior change to any card.
- **Depends on:** nothing. Revises P17's shipped home layout (surface: `HomeScreen.tsx`);
  reuses the existing `PANEL` primitives, so cards restyle for free.

### P28 — Lobby visual hierarchy pass (rank the front door)
- **Status:** shipped — hierarchy + grouping pass over `HomeScreen.tsx`: one primary
  (Quick Play) with a `GHOST_BTN` tier below secondary, hero board docked into the
  play-vs-computer card, Play-online + Open-matches merged into one card, slimmed Daily
  row, a consolidated progress rail, and a dark-elevation retune in `theme.css`.
- **Value:** P17/P27 got the lobby *placed*, but it reads flat: three co-equal primary
  buttons (Quick Play / Create match / Play puzzle) so nothing leads; the hero board — the
  brightest object on the page — floats orphaned away from any action; "Play online" and
  "Open matches" are one intent (find a game with people) split across two surfaces; and on
  dark the panel/well/border tokens sit too close to separate, so cards melt into the table.
  The page doesn't rank itself, so the eye has nowhere to land.
- **Scope:** a hierarchy + grouping pass over `HomeScreen.tsx`, not a rebuild.
  (a) **One primary on the page** — Quick Play stays `PRIMARY_BTN`; Create match →
  secondary; Customize / tutorial / Join-by-ID / Refresh → a new `GHOST_BTN` tier (third
  step below secondary, added to `theme.ts`). (b) **Dock the hero board inside** the
  Play-vs-computer card so the page's most colorful object decorates the primary action
  instead of floating. (c) **Merge** Play-online + Open-matches into one "Play with friends"
  card (create → open list → join-by-ID, in intent order). (d) **Slim the Daily row** from a
  full card to a one-line hook. (e) **Progress rail** — reuse `ProgressionPanel`, consolidate
  its 5 stat tiles → 3 + a streak line. (f) **Dark elevation retune** in `theme.css`
  (`--pnl`/`--pnl-bd`/`--well` stepped apart + a dark panel-shadow token via `--pnl-shadow`).
  Two-column play-column + progress-rail on wide, single stack on narrow (keep P27's
  no-regression contract). No behavior change to any card's action; layout/visual only.
- **Depends on:** nothing. Revises P17+P27's shipped home layout (surface: `HomeScreen.tsx`,
  `ProgressionPanel.tsx`, `theme.ts`, `theme.css`). Mockup approved before build.

### P29 — Front door: ambient board + action menu
- **Status:** shipped — **M1 + M2** both landed. The lobby is now a board-left /
  menu-right front door (uniform rows: Quick Play · Custom Game · Daily Puzzle · Tutorial ·
  Play with Friends · Your Stats; Custom Game took a screen, the last two are modals), and
  the board plays itself off precomputed heuristic games replayed move-by-move — so the
  home page still ships **no engine in the initial bundle**. `HeroBoard` is gone,
  superseded by `AmbientBoard`.
- **Value:** the lobby (P17→P27→P28) is a stack of cards that *describes* the game; a
  chess.com-style front door *shows* it — a large, living board carrying the page while a
  single vertical menu says exactly where you can go. Ranked cards fixed the hierarchy, but
  the page is still inert and its actions are scattered across card bodies. One board, one
  menu: the game sells itself and every destination is one click, one place.
- **Scope / milestones:**
  - **M1 — shell, menu, destinations.** Two-column lobby: board left (static at first),
    vertical action menu right. Menu rows are **fully uniform** for now — same visual weight,
    no icons, no accent fill (icons/accents are a later pass). Rows: **Quick Play** (launches
    the saved setup, as today) · **Custom Game** (→ **new screen** holding the current
    Customize form: players, AI count, blitz, per-seat difficulty) · **Daily Puzzle**
    (existing, "New today" badge) · **Tutorial** (opens the shipped How-to-play flow) ·
    **Play with Friends** (**modal** wrapping P28's existing `card-friends` body) · **Your
    Stats** (**modal** wrapping `ProgressionPanel`). Screens vs modals is deliberate: Custom
    Game is a setup flow leading into a game, so it takes the view; the rest are glances, so
    they overlay. Bring in the 2×2 four-color piece glyph from the approved mockup as the
    wordmark icon. `App.tsx` routing is a plain state switch, so the new screen is one more
    branch.
  - **M2 — ambient self-play board.** The board plays itself by **replaying precomputed
    games** — a handful of full games generated offline from the simplest heuristic bot (same
    technique that produced `HeroBoard`'s `HERO_CELLS`), embedded as move lists and replayed
    one move every ~1–2s, reusing the shipped `ob-settle` placement animation so pieces slot
    in; on game end, brief hold → fade → next game. **No engine at runtime** — this preserves
    `HeroBoard`'s deliberate "no engine in the initial bundle" property and stays
    deterministic. Purely decorative, non-interactive; `prefers-reduced-motion` snaps to a
    finished position instead of looping.
- **Depends on:** nothing. Reuses shipped parts wholesale — the friends card (P28), the
  progression panel (P15/P28), the tutorial (P4), the daily puzzle (P14), the heuristic bot
  (P9, at generation time only), and the `ob-settle` animation (P16). **Leaderboard is
  explicitly out of scope** — see P30. Supersedes P28's card-column layout;
  `home-layout.spec.ts` gets rewritten again.

### P30 — Leaderboard
- **Status:** deferred
- **Value:** a shared ranking is the payoff that makes scores *mean* something — the reason
  to chase a better game rather than just log one. It's the natural sixth row in P29's menu.
- **Scope:** a server-backed leaderboard + the screen that shows it. Open questions at build
  time: what's ranked (daily-puzzle score? vs-AI best? online results?), what identity backs
  an entry (nickname is currently client-supplied and unauthenticated), and anti-cheat —
  today's scores live in `localStorage` and are trivially forged, so a leaderboard needs a
  server-side source of truth, not a client upload.
- **Depends on:** **networked play / server-side persistence** — deferred until that exists
  (user's call). Overlaps P14 M3 (server leaderboard for the daily puzzle), which should
  either fold into this entry or become its first milestone. No dead "Coming soon" row ships
  in P29's menu meanwhile.

### P31 — Last-move ring outlines the piece, not its cells — SHIPPED
- **Status:** shipped — the ring is one silhouette around the move's cells, stroked on the
  outline and clipped to the piece so it hugs the border without bleeding onto a neighbour.
  The silhouette walk came out of `buildRegions` into a pure `cellOutline()`
  (`src/client/board/outline.ts`), now shared by the bevel and the ring.
- **Value:** the just-played piece is the one thing on the board a player and their
  opponents need to find instantly. The brass ring is drawn per-cell, so a 5-square piece
  reads as five boxed squares with their shared edges stroked through the middle — it
  fights the skeuomorphic finish (which correctly bevels only the silhouette) and makes
  the piece harder to read as one object, not easier.
- **Scope:** in `PlacedLayer`, draw the last-move ring as a single silhouette around the
  union of the move's cells — emit only edges facing a cell *outside* the move — instead
  of one inset rect per cell. The technique already exists a few lines up: `buildRegions`
  builds the bevel's silhouette exactly this way. Since same-color pieces may never share
  an edge, a move's cells are always one 4-connected blob, so no special-casing. Out of
  scope: the advisor's legal-move hints, which mark *independent candidate squares* and
  are correct as per-cell boxes.
- **Depends on:** nothing. One component; the fix reaches every surface that renders a
  board through `PlacedLayer` at once — live game, recap scrubber (P2 R0), daily puzzle
  (P14), tutorial (P4).

### P32 — In-game event vocabulary (cuts, mobility swings, endgame beats) + maintained registry
- **Status:** shipped — both milestones. The registry is [`docs/EVENTS.md`](../EVENTS.md)
  (ids, triggers, thresholds, consumers), held to the detectors in both directions by
  `tests/events-registry.test.ts`; the *why* is [ARCHITECTURE §6](../ARCHITECTURE.md).
  Thresholds were **measured, not guessed** — over 20 self-play games a placement can bury
  at most 3 attach points, so the intuitive "3+ lost = a cut" bar was the ceiling and fired
  once per *20 games*; the shipped bars run ~2.8 cuts / 1 cramped / 1 endgame per game.
  Re-measure the rate before retuning. Cut victims' buried corners are scarred on the board
  per-cell (M2) — lost corners are scattered points, not one connected blob.
- **Value:** P16 built the ceremony pipeline but its vocabulary is one event ("X is
  out of moves") — the game's dramatic verbs (cutting off a corner, squeezing an
  opponent's room, the final rounds) are never detected, so board drama is silent
  regardless of presentation. This is the *content* layer that P7 (sound), P2 R1
  (recap key moments), and P34 (mobility surfaces) all consume.
- **Scope:**
  - Pure detectors in the `drama.ts` pattern (rules-core diffs, side-effect-free,
    unit-tested): **cut** — an opponent's placement removes a large share of a color's
    frontier (open corner-attachment points / legal moves); **cramped** — a color's
    mobility falls below a threshold; **endgame countdown** — last-rounds framing when
    hands run short. Anti-spam thresholds so only real cuts fire.
  - Presentation rides the existing `useGameEvents` → `EventBeats` seam (plus a brief
    highlight of the killed region for cuts).
  - **The vocabulary is a maintained registry** — `docs/EVENTS.md` as the single
    source of truth (event name, trigger definition, threshold, consumers), plus a
    schema-style test (P21 doctrine) asserting doc ↔ detector alignment both ways,
    so the vocabulary can't drift from code.
- **Depends on:** nothing. Feeds P7, P2 R1, P34. Threshold tuning is feel, not
  research.

### P35 — Lobby menu hierarchy pass (one primary, adaptive rows)
- **Status:** shipped — all four parts landed: (a) one brass-accented, molded primary
  row with the rest uniform/neutral; (b) Your Stats → top-bar `ProfileChip` opening the
  progression modal; (c) no brand-color row coding, one accent on the primary; (d) adaptive
  rows — Tutorial de-emphasizes when done, Daily Puzzle carries the live P15 streak count.
  ALL-CAPS labels + square icon slots. Dropped the blue accent for the molded brass finish.
- **Value:** P29 shipped the board-left / menu-right front door with six deliberately
  co-equal rows — the punted "later pass" is this entry. The board already does tier-one
  work (ambient demonstration that sells the game); the menu's job is to convert that
  into one obvious click. Today nothing leads, and Your Stats — a noun in a column of
  verbs — dilutes the menu's "ways to play" reading.
- **Scope:** a hierarchy pass over P29's menu column, not a rebuild. (a) **One primary** —
  Quick Play gets the page's single accent/elevation; every other row stays uniform and
  neutral. Chosen because it's the only action with no preconditions (no friends online,
  no config knowledge, not once-a-day), so it doubles as the fallback for users who don't
  know what they want. Explicitly **no** 3-tier system and **no** grouping — five intents,
  no natural pairs; order rows by expected frequency instead. (b) **Your Stats → top bar**
  as an avatar/profile affordance with a glanceable number (rating or streak), opening
  the existing `ProgressionPanel` modal. Frees the sixth row P30 wants. (c) **No brand-color
  coding of rows** — the four logo colors mean *seats/pieces* in this game; a red row reads
  "red player," not "action category," and the calm-menu-vs-colorful-board contrast is
  itself the hierarchy device. Palette stays reserved for game semantics; one accent on
  the primary. Binding guidance for the icons/accents pass P29 deferred. (d) **Adaptive
  rows** — Tutorial de-emphasizes once completed (completion state from P4/P15's local
  store); Daily Puzzle's "New today" badge extends to carry the P15 streak count. Badging,
  not reordering — rows stay put so the menu stays learnable.
- **Depends on:** P29 (shipped — the surface), P15 (shipped — streak/completion data).
  Cross-ref P30: the freed sixth row is where the leaderboard lands when unblocked.

### P40 — Theme-proof the piece finish (audit PlacedLayer's constants)
- **Status:** shipped — `PlacedLayer`'s literal alphas/`pl-vol` stops moved onto `--tile-*`
  tokens in `theme.css`, retuned per built-in so the molded finish holds on dark mats.
- **Value:** the molded finish is the game's tactile identity (P5), but much of it is only
  guaranteed on a pale mat — detail that disappears on Lamplight loses the identity exactly
  where the lamplight look is meant to sell it.
- **Scope:** audit `PlacedLayer`'s literal alphas (window rim 0.22 / 0.15, AO seam 0.12,
  dye border's 30% mix, contact shadow 0.35, grain 0.04) and the `pl-vol` stops. Keep the
  ones genuinely mat-independent; move the rest onto `--tile-*` tokens (adding vocabulary
  where it's missing) and retune per built-in. Same shape as the two fixes P5 already made:
  `--mat-lo` for the stud ring, `--mat-stud` for its radius. No new UI — the Settings token
  editor surfaces any token for free.
- **Depends on:** nothing (P5 shipped).
- **Notes:** trigger was a real miss — P5's studs shipped invisible on Lamplight behind a
  green suite, caught only by eyeballing the dark theme. Verification is per-theme
  screenshots, not assertions; that absence of a metric is why this is product and not
  research.

### P41 — Rotate-view button: icon-only, hover-reveal, corner-anchored
- **Status:** shipped — P6's labelled `Rotate board ⟲` row is replaced by an arrow-only
  (⟲) control anchored off the board frame's bottom-right corner; faint at rest (opacity
  0.4), revealed to full opacity on board-frame hover or button focus, and kept in the tab
  order with an aria-label so keyboard/touch users aren't stranded. Reclaims the vertical
  space the labelled row occupied; rotate behaviour unchanged. `BlokusBoardView.tsx`.
- **Value:** P6's labelled rotate button reads as chrome bolted under the board; an arrow
  glyph is self-evident and the label is noise. Anchoring it off the board's **bottom-right
  corner** (where the player's own corner sits) ties the control to the thing it acts on and
  reclaims the vertical space under the board.
- **Scope:** drop the text; render the rotate affordance as an **arrow-only** control
  positioned outside the board's bottom-right corner, revealed on **hover/focus** of the
  board frame — keep a persistent focus target so keyboard/touch users aren't stranded
  (hover-only would hide it from them). No change to the rotate behaviour itself.
- **Depends on:** P6 (shipped — the button + board auto-orient).

### P42 — Placed pieces read as proud, not sunken (fix inverted depth)
- **Status:** shipped — the AO seam that was stroked *inside* each piece silhouette (reading
  as a recessed well, inverting the P5 finish) is now cast **outside** the footprint via an
  inverse mask, blurred into a feathered contact shadow on the mat so the piece reads proud.
  Masked to all footprints so one piece's shadow doesn't fall on an edge-sharing neighbour;
  depth still driven by `--tile-ao` per theme. `PlacedLayer.tsx` + `theme.css`.
- **Value:** the tactile board (P5) is the game's identity, but a placed piece currently
  reads as *pressed into* the mat instead of resting on it — the depth cue points the wrong
  way, undercutting the whole skeuomorphic finish.
- **Scope:** audit `PlacedLayer`'s shadow/AO stack (contact shadow, AO seam, window-rim
  insets) for the cue that reads as an inset *well* rather than a cast shadow — a piece on a
  surface throws an **outer** shadow onto the mat and catches a top light; a recess throws an
  **inner** shadow. The contact/AO geometry likely needs to sit outside the piece silhouette.
  Verify across all three built-in themes (the finish is theme-driven — a fix tuned on Linen
  can invert again on Walnut).
- **Depends on:** nothing. Same component as P40/P31; if P40 is taken first, fold this in —
  both retune the same alpha stack.

### P43 — Event feed panel (persistent game log / marquee)
- **Status:** shipped — `EventFeed` is a new consumer of the `useGameEvents` stream (the
  hook now exposes an append-only `log` alongside the transient `beats`; one detection seam,
  no new detection, inherits P32 anti-spam). Rendered as a scrollable vertical **"Game log"**
  panel in the right rail; the marquee was the explicit either/or alternative and the vertical
  log was chosen (reads better as reviewable history, fits the panel column). Toggle in
  Settings → Gameplay under a new **"Narration"** section, **default ON**. EVENTS.md Consumers
  row added.
- **Value:** P32's beats are transient pills — a player who looks away misses the drama and
  has no history of it. A persistent feed makes the game's narrative reviewable during play;
  a horizontal marquee gives the same content at a fraction of the footprint.
- **Scope:** a new **consumer** of the `useGameEvents` stream (add a row to
  [EVENTS.md](../EVENTS.md)'s Consumers table) rendering the beat history as either (a) a
  scrollable vertical log or (b) a horizontal scrolling marquee — pick one in build (marquee
  favoured for footprint on the P6 study-table layout). Toggle in Settings, **default ON**
  (note: advisor toggles default *off*; this is ambient narration, not an advisor aid).
  Inherits P32 anti-spam — no new detection.
- **Depends on:** P32 (shipped — the events), P38 (the Gameplay/Settings toggle home) or P12
  (the settings surface) for the switch.

### P44 — Incursion advisor: highlight opponent diagonal cut-through corners
- **Status:** shipped (2026-07-20, `a587459`) — pure predicate `incursionCorners(G, forColor)`
  in [src/client/advisor/incursions.ts](../../src/client/advisor/incursions.ts) with one
  feel-tuned constant `INCURSION_MIN_PIECE=3` pinned by
  [tests/incursions.test.ts](../../tests/incursions.test.ts); overlay rides the
  `LegalMoveHints` seam with a new `threat` tone; opt-in "Incursion Warnings" toggle in
  Settings → Gameplay (`pref-incursion-advisor`, default OFF). Scope item (2) EVENTS.md
  registration dropped (see below) — no event id/sound cue owed.
- **Value:** cuts (P32 `cut`) are named *after* they happen. This warns *before*: it marks
  the corners where an opponent could thread a diagonal past your wall into the space behind
  it — the defensive read strong players make and beginners miss.
- **Scope:** (1) **define** the predicate (`drama.ts` pattern — a pure, deterministic helper)
  as a sibling of the advisor predicates in `src/client/advisor/` — "your line," "the space
  behind it," and "a legal opponent diagonal that reaches it" made precise; deterministic +
  one feel-tuned threshold, like `cut`/`cramped` (threshold tuning is feel, not research —
  the P32 precedent, so this stays **product-only**). (2) ~~register it in EVENTS.md as a
  new event id~~ — **dropped (rescoped 2026-07-20 during /implement).** An EVENTS.md event
  is a `(prev,cur)` crossing that fires once on a ply and carries a banner + TTL + a
  *mandatory* sound cue (tests/sound-cues.test.ts fails CI otherwise); the incursion advisor
  is a **standing predicate over the current position**, silent and recomputed each turn — it
  does not meet the project's working definition of an event. So no `EVENT_IDS` entry, no
  EVENTS.md row, no sound cue, no doc↔detector alignment test; the feel-tuned threshold stays
  a plain named constant with a direct unit test instead. (3) an advisor **overlay**
  highlighting the at-risk corners, riding the `LegalMoveHints` seam (standing overlay), not
  the transient cut-highlight/`CutMarks` seam. (4) **toggle** in the P38 Gameplay tab,
  **default OFF** (advisor aids default off, per P38).
- **Depends on:** P32 (the event registry + detector pattern), P38 (the toggle home).

### P45 — Lobby menu: subtitles into hover tooltips
- **Status:** deferred — the call went against it (2026-07-22). The mockup was the whole
  deliverable, so the open work was the judgement, not code: the Tension below wins, and
  the subtitles stay. Revisit only if the menu grows enough rows to feel noisy.
- **Value:** a cleaner, calmer menu column — the P35 hierarchy reads faster without a
  subtitle under every row.
- **Tension (why it stays exploratory):** the subtitles currently *teach* what each row does
  at a glance and give touch users the "what" with no hover to fall back on; tooltips trade
  that scannability/discoverability for tidiness, which can work against the menu's
  one-obvious-click job (P35). A side-by-side mockup was built to make the call.
- **Scope:** if pursued — subtitle text → `title`/tooltip on hover/focus of each
  `ActionMenu` row; keep the primary (Quick Play) row's subtitle **persistent** so the hero
  action never depends on hover; needs a touch/tap-to-reveal story.
- **Depends on:** P35 (shipped — the rows + subtitles).

### P46 — Quick Play configurable default
- **Status:** shipped — the default is **pinned explicitly from Custom Game**, rejecting both a
  Settings-owned copy of the setup form (splits one setup UI across two places) and
  keep-last-played-plus-reset (leaves the default unpredictable; only adds an escape hatch after
  the fact). Launching and pinning are now separate paths; P17's blitz/extreme guard runs on
  both, so no invalid setup can be started *or* pinned.
- **Value:** "last custom config" makes Quick Play unpredictable — one odd experiment poisons
  the one-click path. A stable, *settable* default keeps Quick Play the reliable fallback P35
  leans on as the always-valid primary action.
- **Scope:** *starting* a game stops writing the Quick Play default — that write is what makes
  a one-off experiment sticky. Only an explicit "pin as my Quick Play default" in Custom Game
  sets it; Quick Play launches the pinned setup, or the built-in one when nothing is pinned.
  Pinning changes state without navigating, so it has to say what it did. Preserve P17's
  blitz/extreme-resolve guard — it moves onto the launch path instead of riding along with
  the save.
- **Depends on:** P17 (shipped — Quick Play + persisted setup).

### P48 — Right-rail & piece-tray layout: widen horizontally + collapsible panels (all modes)
- **Status:** shipped
- **Value:** The right rail stacks the Your-Hand tray with a side panel (live Standings in
  play, the Analysis score+mobility timelines in review). In review the Analysis panel is
  taller than the Standings it replaces, so the stack overflows: the transport/scrubber bar
  (below the table) is pushed below the fold and requires scrolling, and the column looks
  lopsided against the much shorter left player-card column. Underneath is a more fundamental
  layout choice — the piece tray spends its bulk vertically while there is ample unused
  horizontal width.
- **Scope:** revises the shared right-rail/tray layout across **all** modes (play table's
  right column, review table's right column), not review-only. Two moves: (1) widen the rail
  and let the Your-Hand tray expand its bulk horizontally rather than vertically into the
  unused width, applied consistently in play and review so the tray reads the same everywhere;
  (2) make the rail panels collapsible in all modes (hand tray, standings, analysis), so a
  viewer can reclaim vertical space and keep the primary controls — action dock in play,
  transport bar in review — in view without scrolling. Pure layout/visual: no change to
  timelines, scrubber behavior, standings content, or move logic. The "nothing shifts between
  play and review" parity note in `ReviewTable.tsx` already breaks vertically; this supersedes
  it with a wider shared layout. ~~Update the affected layout tests (`review-table`,
  board-view/right-rail).~~ — void, no such tests existed; `e2e/rail-layout.spec.ts`
  covers the rail instead.
- **Shipped:** both moves, via `RailPanel.tsx` (the fold seam) + a horizontally-spending
  `HandTray`. Measured pre-change, the overflow premise above was narrower than stated:
  in the all-AI watch case the transport bar was already in view (no human seat ⇒ no tray
  in the rail), so the overflow only bites when the rail carries **tray + Analysis**.
- **Depends on:** nothing. Revises P6 (study-table three-column layout) and P2 + P34's shipped
  review layout. Surfaces: `BlokusBoardView.tsx`, `ReviewTable.tsx`, `HandTray.tsx`.

### P49 — Rotate-view: rotate the frame, settle to a fixed grid
- **Status:** shipped (2026-07-21) — both facets. Spike resolved in favour of the
  **coordinate re-index**: the CSS-layer option leaves a rotated pointer space *and*
  drags every grid-riding overlay into it, which is the frame/contents split this
  entry exists to kill. The re-index turned out contained — each board layer already
  positions from board indices, so `Board` takes the turns and screen-space stays an
  implementation detail behind it. Orientation is now a fact about the *contents*:
  `Board`'s whole interface (board array, hints, cut marks, the `(x, y)` it reports
  back) stays in board coordinates, and the spin is a transient on a wrapper *outside*
  `BoardFrame` — frame and grid turn as one rigid object, then the turn commits to the
  data and the transform snaps back to identity. `ReviewTable` dropped its second copy
  of the transform and takes the same prop.
- **Value:** the rotate control spins the grid *inside* a static frame — `.board-rotator`
  carries the `rotate(boardTurns*90deg)` transform, `BoardFrame` doesn't — so the frame
  visibly detaches from its contents mid-animation. And because a 20×20 grid is rotationally
  symmetric, spinning the whole grid to its 90° end state is wasted motion: the only thing
  that *needs* to end up reoriented is the pieces, so the local seat's corner sits at the
  bottom. The current model animates the wrong invariant.
- **Scope:** two facets, one code path (`BlokusBoardView.tsx` board-rotator transform).
  (1) **Frame joins the animation** — the rotation reads as one rigid object turning:
  `BoardFrame` rotates together with the grid during the 0.2s spin instead of staying put.
  (2) **Settle to a fixed grid** — at rest the grid (and any coord/frame chrome) returns to
  standard orientation; only the *placed pieces* end up rotated about the board centre. The
  spin is a transient visual; the committed state re-renders pieces at their rotated board
  positions over an unrotated grid. Grid-riding overlays (`LegalMoveHints`, `CutMarks`,
  previews) must resolve to the settled orientation, not the transient one. **Open question
  for the builder** — spike first: does "pieces rotate around centre" mean a real coordinate
  re-index (changes what hit-testing/hover see) or a CSS layer that stays rotated over an
  unrotated underlay (cheaper, but leaves a rotated pointer space)? That choice is the crux;
  settle it before building.
- **Depends on:** nothing. Refines P6 + P41 (both shipped).

### P50 — Move Options: mark the anchor points, not just the footprint
- **Status:** shipped — a second, sparser layer marks the anchors under the reach fill. The
  anchor set is derived from the rules core's own corner-contact cells (now exported) rather
  than the client's `expansionAnchors` room metric, so the marks can't disagree with what the
  engine actually hooks onto — including the pre-start case, where the lone anchor is the
  color's start corner. Drawn as a small square pip, not the scaffolded blue ring: square
  matches every other mark on this board, and a pip stays under the "guidance, not chrome" bar.
- **Value:** Move Options shades every cell any legal placement of the held piece could cover
  (one `tone: 'legal'` hint, active-color tint, in `BlokusBoardView.tsx`). That shows *reach*
  but hides *why*: the player can't see the diagonal corner-contacts — the anchors — that make
  those placements legal. Anchors are the strategic unit of Blokus; the footprint is just their
  consequence.
- **Scope:** distinguish anchor cells from footprint cells in the overlay, quietly.
  `LegalMoveHints.tsx` already defines an unused `anchor` tone (blue ring `#3468cf`) — this is
  the wiring it was scaffolded for. Compute the anchor set alongside `legalTargetCells` (the
  open corners the held piece can touch) and emit a second, sparser hint layer. Design intent:
  *indicate anchors without polluting the board or fighting the skeuomorphic theming* — favour
  a restrained mark (small corner dot/notch at the contact point, or a ring only on anchor
  cells) over another full fill. Exact treatment is a builder call; the bar is "reads as
  guidance, not chrome."
- **Depends on:** nothing — anchors are deterministic from the placement rules (no advisor
  signal, no research). Sibling to P44 (which marks *opponent* cut corners); shares the
  corner-marking vocabulary with `CutMarks`, worth reusing for visual consistency.

### P52 — Pin the review transport: the action bar never moves
- **Status:** shipped — `ReviewTable` is a `100dvh` grid (rows `1fr auto`): the board+rails
  region takes `1fr` and scrolls inside itself, the transport is the `auto` bottom row and is
  positionally invariant to panel folds, rail resize, and viewport height. Parents supply the
  bounded cell (`LocalAIGame` while reviewing, `App` standalone). `e2e/rail-layout.spec.ts`
  asserts an unchanged, fully-in-view transport rect across expanded/folded/short-viewport;
  /verify confirmed identical rect (delta 0.0) with screenshots. The scope's play-dock tail
  (apply the same seam to `BlokusBoardView.tsx` *if it holds*) was conditional and stays
  deferred by design — out of the reported bug's scope, not owed by this fix.
- **Value:** In review the transport bar sits in normal flow below the table, so its
  y-position is a function of the tallest column. With the rail carrying both Analysis and
  the Your Hand tray it lands below the fold — the primary control for the mode is off-screen
  until you scroll or fold a panel. P48 shipped collapsible rail panels as a mitigation; this
  makes it structural. The bar should be positionally invariant: it does not move when panels
  open, close, resize, or when the window does.
- **Scope:** restructure the review table as a viewport-height grid (`100dvh`, rows
  `1fr auto`): the table region scrolls internally (`min-height: 0` + rail `overflow-y: auto`),
  the transport is the fixed bottom row and never participates in content height. Removes the
  rail→bar coupling rather than trimming it. Rejected alternatives: `position: sticky/fixed`
  (bar floats over content, and sticky still moves before it sticks); capping rail height alone
  (bar still shifts as content reflows). Pure layout — no change to scrubber behavior,
  timelines, or move logic. The same seam covers the play dock in `BlokusBoardView.tsx`; do
  review first, then apply the pattern to play if it holds.
- **Acceptance:** an e2e assertion that the transport bar's viewport rect is unchanged and
  fully in view across (a) both rail panels expanded, (b) both folded, (c) a short viewport
  (e.g. 1280×720), plus **/verify with screenshots at each state** — the bug is invisible to
  vitest and typecheck, so a visual pass is required before it's done. Extend
  `e2e/rail-layout.spec.ts`.
- **Depends on:** nothing. Succeeds P48 (shipped) — completes its intent. Surfaces:
  `ReviewTable.tsx`, `RailPanel.tsx`, possibly `BlokusBoardView.tsx`.

### P53 — Standalone review needs the table's chrome (Settings, Controls, Leave) — SHIPPED
- **Status:** shipped (2026-07-22, merge `2448d2f`) — taken as the preferred shape, not the
  cheap one: a shared `src/client/TableShell.tsx` owns the table chrome (wordmark ·
  kind-of-table pill · status slot · Settings/Controls/Leave chips) plus P52's `fill`
  flex-column layout, and both entry paths — `LocalAIGame` and `App`'s standalone-review
  branch — render it, so the two can't drift again. Covered by a new
  `e2e/game-history.spec.ts` walk (Your stats → Review → chips → home) and /verify
  screenshots of both paths.
- **Value:** review reached from a table is rendered inside `LocalAIGame`, so it inherits
  the table's chip row — Settings, Controls help, Leave. Review reached from "Your stats" →
  Recent games is a sibling branch in `App` with no shell at all: the chips are gated on
  `session && !aiConfig`, false there, so the screen has no Settings, no Controls help, and
  no visible way to the menu. Its one exit (`‹ Back`) lives in the transport bar — the bar
  P52 exists because it drops below the fold — so in practice the screen reads as a dead
  end. Same view, two different amounts of chrome depending on how you arrived.
- **Scope:** give the standalone review branch the same session chrome as the in-game one.
  Preferred shape: lift the chip row out of `LocalAIGame` into a small shared review/table
  shell both branches render, so the two entry paths can't drift again — not a second copy
  of the chips in `App.tsx`. Leave here means "back to main menu" (the `‹ Back` destination);
  Play Again stays absent (no session behind it, per the existing comment). No change to
  scrubber, timelines, or the record format.
- **Acceptance:** enter review from Recent games and from a finished vs-AI game; both show
  the same chip set and both reach the menu without scrolling or the Escape key. **/verify
  with screenshots of both entry paths** — this is chrome presence, which the suite doesn't
  assert. Add an e2e that walks Your stats → Review → back to the home screen.
- **Depends on:** P52 for the *reliably visible exit* half — if the transport bar still falls
  out of view, `‹ Back` stays hidden regardless. Build P52 first or together. Succeeds P15 M2
  (shipped). Surfaces: `App.tsx`, `LocalAIGame.tsx`, `ReviewTable.tsx`.

### P59 — Achromatic tray & thumbnail finish (the low-contrast seat's inventory)
- **Drafted:** 2026-07-22
- **Status:** proposed
- **Value:** in Duo one seat's 21-piece inventory strip is near-illegible on every theme —
  White's glyphs on the pale seat card in Linen/Walnut, Black's on the dark card in
  Lamplight. **Verified** by eye on all three during
  [P20](#p20--variety-blokus-duo--blitz--shipped) M2c's eyes-on pass. The cause is not Duo:
  [../../src/client/tray/PieceThumb.tsx](../../src/client/tray/PieceThumb.tsx) paints its
  mold, glint, placed-dash and micro-mode border from hardcoded constants, so
  [P40](#p40--theme-proof-the-piece-finish-audit-placedlayers-constants)'s
  theme-proofing audit never reached this file and M2c's value-class fork has no
  counterpart here. Duo is just the first color pair extreme enough to make the existing
  hardcoding *visible* — a fixed dark hairline is all that defines a white glyph, and on a
  near-white panel that isn't enough.
- **Scope:**
  - Tokenize those constants and resolve them through `tileVar` / `TILE_FINISH`
    ([../../src/client/theme.ts](../../src/client/theme.ts)), so a thumb's molding forks by
    value class the way the board's does.
  - **Respect why the tray isn't SVG.** The board's per-cell pattern machinery was
    deliberately rejected at 13px × 21 thumbs per hand. `tileVar` returns a `var()` string,
    so it drops into `box-shadow` / `border` unchanged — this is a token change, not a
    rewrite, and a rewrite would be the wrong answer.
  - Micro mode carries it worst (only a border, no mold). Check the full-size hand tray at
    the same time — **asserted, not observed**: only the seat-card micro strip was seen.
  - Hold it with a contrast floor in
    [../../tests/tileFinish.test.ts](../../tests/tileFinish.test.ts)'s idiom rather than by
    eye alone. Unlike the board finish, this one *does* reduce to "the glyph is not its
    background," so it need not stay eyes-only.
- **Adjacent, explicitly unverified — check while you're in there, don't inherit as a
  claim:** legal-move hints render as the translucent active color, which on cream is a
  readable grey for Black. Whether White's survive the same treatment was never observed.
- **Depends on:** nothing. P20 M2c shipped the token vocabulary this reuses.

---

## Epic: Engagement & retention

The "why come back" layer — daily hooks and a memory of your journey across games.

### P14 — Daily puzzle
- **Drafted:** 2026-07-06
- **Status:** partial — **M1 shipped** (reshaped from static solitaire to a *contested*
  personal-best puzzle): a fixed daily seed plays a deep opening (~11 pieces per color),
  hands the player one color, then the other three colors answer every player placement
  one at a time with a heuristic move
  (`src/game/puzzle/daily.ts`, pure), so corners and lanes get contested like a real game
  rather than a frozen packing position. Score = squares you place (a personal best,
  yours regardless of who wins); "Copy result" share on finish, now carrying P26's
  emoji grid. M2 (best-move, blocked on AD4) + M3 (server leaderboard) pending.
- **Value:** a daily reason to open the app — same seeded challenge for everyone,
  shareable emoji-grid result (Wordle-style; renderer built in P26, reused here rather
  than re-scoped). Converts an evergreen board game into a habit.
- **Scope / milestones:** M1 *contested* — fixed daily seed, deep opening, opponents
  answer every move, "fit as many of your pieces as you can," score = cells you place,
  local share text. M2 *best-move* — "find the strongest placement,"
  graded against MCTS. M3 — server-shared leaderboard.
- **Depends on:** M1: nothing (engine + seeded self-play exist). M2: research
  [AD4](../research/backlog/advisor.md) (move-grading signal must be trustworthy
  before it grades *you*). M3: server work.

### P15 — Local progression, stats & history — SHIPPED
- **Status:** shipped (2026-07-21) — both milestones. **M1**: a "Your progress"
  home-screen card backed by a localStorage store (games, per-tier win rate, best score,
  current/best streak, perfect clears) with one-time milestone toasts. **M2**: finished
  games persist to a capped localStorage list under M1's counters, and any row opens in
  `recap/ReviewTable`. Two premises the entry carried were wrong and are worth keeping
  as the *why*: (a) the `ReplayScrubber` it planned to reuse was removed by P2 R0.2, so
  M2 replays through `ReviewTable` + `useReplay`, which already render from a
  `GameRecord` with no live client; (b) P1's records go to a **dev-only** disk endpoint,
  so on a built app nothing was retaining games at all — M2 therefore owns a
  player-facing store of its own, written independently of that POST. "M2 depends on P1"
  was only ever true for the record *format*, not for retrieval.
- **Value:** games leave a residue — beating `extreme` the first time should look
  different from losing your first game. Makes P13's named tiers *feel* like a ladder.
- **Scope / milestones:** M1 localStorage counters — games played, win rate per tier,
  best score, streaks, milestone toasts (first win vs each tier, perfect clear).
  **M2** (settled with the human, 2026-07-21) game history: finished games persist to a
  capped localStorage list alongside the existing dev sink; the list lives under M1's
  counters in the "Your stats" modal — the residue surface already exists, and a home-row
  destination would sit empty until you've played (P35 keeps that menu precondition-free);
  picking a game opens it in `ReviewTable`.
- **Depends on:** M1: nothing. M2: P1 for the record *format* only (see Status);
  replay assets shared with P2 (recap).

### P51 — "Best score" reports your worst game — SHIPPED
- **Status:** shipped (2026-07-21, merge `e69687c`) — the fold is variant-aware:
  `basic` folds `min` (lower is better, GAME_SPEC §6), `advanced` folds `max`. The
  single `bestScore` slot became `bestScores` per variant (squares-left and points
  share no scale), and the tile carries its unit ("37 left" / "20 pts"). Scope's two
  fall-out decisions are settled in the diff, nothing owed: (a) the legacy cross-variant
  `bestScore` had no variant tag and can't be repaired, so sanitize drops it — the tile
  blanks until the next game, every other counter survives (e2e-covered); (b) the "best
  takes the max" unit test was rewritten per variant, not deleted.
- **Value:** P15 M1's headline "Best score" tile is wrong under the default scoring
  variant, and wrong in the direction that mocks you: `basic` scores remaining squares
  (lower is better, GAME_SPEC §6) while the fold takes `Math.max`. Ten real games
  scoring 32–43 displayed **43**. It's one of three headline numbers on the stats
  surface, and P15 M2 has just put a per-game list underneath it whose rows show the
  true spread — so the tile is now visibly contradicted by the rows below it.
- **Scope:** make the fold variant-aware (`advanced` is already right; this is purely
  the `basic` path, which is the default). `GameResult` carries a bare `score` today,
  so either the variant reaches the fold or the caller normalizes to a higher-is-better
  figure first — that choice is the work. Two things fall out and want settling with
  it: (a) stored `bestScore` values are already polluted and a single stored number
  can't be recovered from, so decide reset vs. let-it-self-correct; (b) the existing
  "best score takes the max" unit test encodes the bug as intended behaviour and needs
  rewriting per variant, not deleting. Label the unit on the tile while you're there —
  M2's history rows read "37 left" for exactly this reason.
- **Depends on:** nothing. Fixes P15 M1 (shipped); sits under P15 M2's list.

---

## Epic: Social & multiplayer presence

### P19 — Multiplayer identity & reactions — SHIPPED
- **Status:** shipped — locally-persisted nickname sent as the seat name on join;
  canned-emoji reactions broadcast over boardgame.io's chat side channel (never
  touches `G`) and surface as transient toasts on the sender's player card.
- **Value:** online opponents are literally "P0/P1" today — anonymous games feel
  dead. A nickname and a few canned reactions ("nice move," "ouch," …) change the
  social temperature cheaply, without open-chat moderation burden.
- **Scope:** nickname field (persisted locally, sent on join); canned-reaction button
  row broadcast via the existing transport; shown as toasts by the player card.
- **Depends on:** nothing hard; reuses boardgame.io transport.
- **P19.1 (shipped) — text-only reactions:** drop the emoji glyphs; reactions render as
  their `label` text only (`Nice move` / `Wow` / `Thinking…`) in both the `ReactionBar`
  picker and the `PlayerCard` toast. Matches the product's emoji-free monochrome tone
  (cf. the emoji-free top-bar icons in P12). Keep or drop the `emoji` field — rendering
  just stops using it. Depends on: nothing (P19 shipped).

---

## Epic: Game modes

### P20 — Variety: Blokus Duo & blitz — SHIPPED
- **Drafted:** 2026-07-06
- **Status:** shipped (2026-07-22, merge `bb12931`) — all milestones landed.
  **M1 (blitz) shipped**: per-move countdown for human seats in the
  offline vs-AI table. **M2a shipped**: board size + start cells live in `GameConfig`,
  read through `boardSizeOf` / `startCellOf` accessors; `bitboard.ts`'s hardcoded
  `SIZE`/`MASK20` are gone. Classic remains the only shipped variant and no behaviour
  changed — the brute-force move oracle and the bitboard-vs-`isLegalPlacement`
  differential still pass, which is what makes that claim checkable. **M2b shipped** —
  **Duo is playable**, offline and online: `black`/`white` in the `Color` union,
  per-variant `VARIANTS` table (play colors, 14×14, interior start cells, forced
  advanced scoring, seat counts), lobby variant switch with Duo's now-moot mode/scoring
  controls shown resolved rather than lying, GAME_SPEC_DUO §6's D1–D5 as rules-core
  tests, plus an e2e. The owed size-defaulting sweep is done and then some: `size` is now
  **required** on `idx`/`xy`/`inBounds` (P54's closing step, pulled in here because the
  sweep already touched the call sites), so the silent-corruption class is a typecheck
  error. Five further defects only the running app could show — keyboard cursor clamped
  to 19, advisor footprint keyed to a 20-stride, progression defaulting to Classic,
  Duo setup dropping the human seat, game-over mosaic framed at Classic's pixel size —
  were found by /verify and fixed. Co-landed with **P56** (merge `eaaf694`).
  **M2c shipped** — the `--tile-*` finish tokens fork by value class (`-dark` /
  `-light`, resolved through a `var()` fallback chain), so a theme overrides only where
  the base finish genuinely fails at that end of the range. `--piece-black` /
  `--piece-white` are tuned per theme against that theme's mat rather than shared.
  What's mechanical underneath is pinned by `tests/tileFinish.test.ts` (fallback chain
  resolves; `PlacedLayer` can't reach a class-varying token bare; every dye edge
  separates from its own body, with a control showing black clears that bar *only*
  because of the fork); the look itself was verified the only way it can be — eyes-on
  across Linen, Lamplight and Walnut, Duo and Classic.
- **Note (M1):** expiry auto-plays a *random legal move*, not a skip — Blokus has no pass
  move (GAME_SPEC §5), so a timeout forfeits your choice of move, not your turn. The
  entry's "auto-skip **or** auto-random" was resolved to auto-random for that reason.
- **Rescope (2026-07-21):** the old M2 premise — "board size + start-cell rule become
  mode config" — was incomplete, and the omitted half is the larger one. Duo is a
  **two-colour** game (black + white), not the Classic four on a smaller board; four
  colours × 89 squares cannot fit 196 cells, so "generalize board size" alone yields
  something that isn't Duo and isn't playable. Rules are now specified in
  [../GAME_SPEC_DUO.md](../GAME_SPEC_DUO.md) — a delta doc sourced to the official
  Mattel sheet (FWG43, ©2017): 14×14, interior start cells `(4,4)`/`(9,9)`, advanced
  scoring only, black moves first.
- **Value:** classic 20×20 is the only way to play. Duo (14×14, interior diagonal
  starts) is *the* canonical 2-player experience; blitz (per-move timer) makes the
  same engine feel like a different game.
- **Scope / milestones:**
  - **M1 blitz** — shipped (see Status/Note).
  - **M2a rules-core generalization** — shipped (see Status). "Corner" was renamed to
    "start cell" throughout the rules core, since Duo's start cells are interior and the
    old name misleads.
  - **M2b Duo rules** — shipped (see Status). `config.playColors`; add `black` + `white` to the `Color` union
    (today `blue|yellow|red|green`, ~171 refs / 36 files / 58 `Record<Color,…>` sites);
    14×14 preset, start cells, forced advanced scoring, lobby + turn glue. Ships playable
    on a provisional flat skin. **Owes an explicit sweep of the size-defaulting call
    sites** — `idx`/`xy`/`inBounds` default to Classic, so a Duo-aware caller that omits
    the size argument silently gets 20. Confirmed real, not hypothetical:
    [../../src/game/ai/heuristic.ts](../../src/game/ai/heuristic.ts) already calls them
    with no size argument, so on a 196-cell board it would index as if 400, read
    `undefined`, and `undefined !== null` makes out-of-range cells read as *occupied*.
    Silent corruption with nothing red — grep the call sites, don't trust the suite.
    The sweep is bounded and small: **25 call sites across 5 files** (`placement.ts` 5,
    `moves.ts` 3, `alphabeta.ts` 7, `heuristic.ts` 6, `legalMoves.ts` 4) — the rules-core
    two are already size-aware from M2a, so M2b's own share is the client callers.
    The AI/advisor half of that sweep was meant to be its own entry —
    [P54](#p54--variant-aware-ai-harness-let-the-arena-play-duo--shipped) — but M2b's required-`size`
    flip forced those call sites anyway, so it absorbed them and left P54 the harness.
    M2b also encodes GAME_SPEC_DUO §6's worked cases **D1–D5** as rules-core tests —
    D5 pins the start-cell pair against the anti-diagonal misreading §3 documents,
    the only mechanical guard on those coordinates until P55's registry test exists.
    And M2b **co-lands
    [P56](#p56--variant-identity-through-game-records-history--progression--shipped)**: the
    game recorder runs at every game-over, so a playable Duo without record/stats
    variant identity silently loses every Duo game it finishes (see P56).
  - **M2c achromatic tile finish** — shipped (see Status). Split out because `MatLayer`/`PlacedLayer` shade tiles with *relative* modulations
    (`--tile-hi` 0.42, `--tile-lo` 0.26, `--tile-ao`, `--tile-shadow` 0.35, `--tile-dye`
    30%) tuned against saturated mid-tones; black and white are the degenerate case and
    clip at **both** ends. Per CLAUDE.md this failure is invisible to vitest/typecheck/
    lint — the only detector is looking at each theme, so it needs its own eyes-on pass.
- **Depends on:** M1: nothing (shipped). M2a: nothing — the spec now exists. M2b: M2a.
  M2c: M2b.
- **Human-owned follow-up (outstanding):** [../GAME_SPEC.md](../GAME_SPEC.md) needs a
  pointer to `GAME_SPEC_DUO.md` (edit-guard blocks it), claimed by the human 2026-07-22.
  The other half of this line — adding `GAME_SPEC_DUO.md` to `.claude/edit-blocklist` — was
  already done and is dropped; **verified** by reading the file, which lists it.

### P24 — Blitz clock legibility (put the countdown where the eyes are) — SHIPPED
- **Status:** shipped — a board-side countdown bar (mono readout + depleting fill,
  spanning the board width just above the frame) puts the clock in the field of view;
  in the final seconds (<3s) the bar breathes red and the board frame gains a static red
  glow ring — a peripheral cue dead-center in view. The top-bar chip stays as the precise
  readout. Motion gated by `useReducedMotion`; inert online and when no clock runs.
  (`src/client/blitz/BlitzBoardBar.tsx` + `blitzFraction`; merge 531e3e1.)
- **Value:** the blitz clock (P20 M1) renders in the top bar, but during a timed move the
  player is looking at the board and the tray — nowhere near it. A shrinking number is
  also its only urgency cue. Observed while verifying P20: at a 5s limit the timeout
  fires before you register the clock exists, and a random move gets played for you. The
  feature is fair but currently illegible, which reads as the game cheating.
- **Scope:** move or mirror the countdown into the player's field of view (candidates:
  the active PlayerCard, a board-frame treatment, a ring around the staged piece);
  escalate the existing `data-urgent` state (<3s) from a color/weight change into
  something peripherally visible — board-edge tint, pulse, or tick.
- **Constraints:** any motion cue must respect `useReducedMotion` (it gates all P16
  ceremony); the top-bar chip stays as the precise readout even if a second surface
  becomes the primary cue — don't trade precision for peripherality.
- **Depends on:** P20 M1 (shipped). **Synergy with P7 (sound)** — a final-seconds tick is
  the obvious audio cue and rides P16's existing event hooks; the visual cue should land
  first so blitz is legible without audio (sound is deferred, and muted tabs are common).
- **Explicitly out of scope:** whether the clock *should* keep running mid-composition
  (pause / grace period). That's a fairness question, deliberately left untriaged.

### P25 — Blitz bot pacing (make the CPU take a human amount of time) — SHIPPED
- **Status:** shipped — in blitz, `easy`/`medium`/`hard` bots floor their visible
  think-time to a jittered, tier-scaled interval before submitting (`blitzPaceMs`, delays
  the submit not the search; `?botDelay=0` still forces instant for e2e). `extreme` is
  excluded from blitz — the difficulty `<select>` disables it in place
  (`extreme — needs untimed play`) and `resolveExtremeForBlitz` drops any extreme seat to
  `hard` on blitz-enable, saved-setup load, and launch. No tier's search or strength
  changes. (`src/client/ai/difficulty.ts` + `LocalAIGame.tsx` + `HomeScreen.tsx`; merge 7c768d1.)
- **Value:** in blitz (P20 M1) only the human is on a clock. Bot think-time is set by its
  tier, not the match: easy ~0.6s, medium ~0.5s, hard ~2s. Against a 5s human clock that
  reads as the CPU sniping instantly while you sweat — the mode feels rigged even though
  the rules are identical for both sides.
- **Scope:**
  - Pace `easy`/`medium`/`hard` in blitz only: floor each bot's visible think-time to a
    randomized, human-plausible interval (jittered, not a constant, so it doesn't read as
    a fixed animation), scaled by tier so a stronger opponent visibly "thinks longer".
  - **Disable `extreme` while blitz is on** — it has no time budget (`iterations: 500`,
    ~12s/move), already longer than a 5s or 10s limit, so pacing cannot fix it. The
    difficulty `<select>` disables that option and says why, concisely, in place — e.g.
    the option renders as `extreme — needs untimed play`. No modal, no separate warning
    banner. If a saved Quick Play setup carries `extreme` + blitz, resolve it (drop to
    `hard`, or clear blitz) rather than starting an unwinnable race.
- **Pacing is presentation:** it delays the *submit*, never the search. No tier's strength
  changes, so the ladder anchored by F14/F15 stays valid. `?botDelay=` must still force 0
  for e2e.
- **Non-goal:** slowing bots in untimed play — the current pace is right there.
- **Depends on:** P20 M1 (shipped). No research dependency: excluding `extreme` is what
  removes the "can a capped extreme still be a tier?" question from the critical path.

### P33 — What-if mode (branching timelines from any turn)
- **Status:** deferred — parked deliberately (2026-07-13); the shape is still
  "something to think about."
- **Value:** a finished game becomes a playground: fork the timeline at any ply,
  play the branch out vs bots, and compare outcomes across branches
  ("multi-dimensional chess") — losses become material instead of terminal. A
  standalone mode, not just a recap button.
- **Scope (sketch):** fork from the scrubber at ply N (replay through the pure rules
  core, hand control to the human — same substrate as P2 R2); persist branches per
  game; a branch-compare surface (final scores / boards side by side, maybe a tree
  view). Open design questions: branch UI, how many forks, whether bots replay
  deterministically per seed.
- **Depends on:** P1 (logs) + P2 R0 scrubber (both shipped). Subsumes P2 R2's
  replay-fork substrate if built — build the substrate once (see P2's R2 note).

### P56 — Variant identity through game records, history & progression — SHIPPED
- **Status:** shipped — co-landed with [P20](#p20--variety-blokus-duo--blitz--shipped) M2b
  (merge `eaaf694`). `GameRecord` carries `variant`; `SerializedRecord` is **v3** with
  v1/v2 reading back as `classic`, and seats/scores/winners/moves keyed by the variant's
  play-color list instead of `COLOR_ORDER` position. The variant threads through every
  reconstruction (`replayGame`, `buildRecap`, `summarize`, the recorder's capture +
  score cross-check) and through the P15 store (`perTier`, `bestScores` and the
  milestone unlocks are per-variant; `sanitize` migrates pre-variant blobs to
  `classic`). Guards landed as specified: a Duo serialize → deserialize → replay
  round-trip, a test that a finished Duo game **survives** the recorder's catch and
  `loadHistory`'s drop-on-read, and a progression fold keeping Classic and Duo in
  separate buckets (`tests/duoRecords.test.ts`).
- **Value:** the whole persistence pipeline identifies a game by `(mode, scoring)` and
  addresses colors *positionally* through `COLOR_ORDER` — the variant is
  unrepresentable. `GameRecord` ([../../src/game/ai/selfplay.ts](../../src/game/ai/selfplay.ts))
  has no variant field, and `mode: 2` already means Classic two-humans-two-colors, so it
  cannot also mean Duo; `serializeRecord` writes seats/scores/winners/moves by
  `COLOR_ORDER` index (`black`/`white` → −1); and every reconstruction path —
  `replayGame`, `buildRecap` ([../../src/game/recap.ts](../../src/game/recap.ts)), the
  recorder's replay cross-check
  ([../../src/client/log/recorder.ts](../../src/client/log/recorder.ts)) — funnels
  through `createInitialState(mode, scoring)`, which can only build a Classic board, so
  a Duo first move at (4,4) throws against the corner rule. The failure is **silent by
  the layer's own design**: the recorder's catch-and-warn and `loadHistory`'s
  drop-on-read ([../../src/client/log/history.ts](../../src/client/log/history.ts))
  were built for legacy corruption and swallow the structurally-new Duo data
  identically — the first finished Duo game simply *vanishes* (no log record, no
  history row, no recap), with vitest/typecheck/lint green because every test in this
  layer constructs Classic states. Downstream, the P15 store mixes variants:
  `GameResult` ([../../src/client/progression/progression.ts](../../src/client/progression/progression.ts))
  carries no variant, so `perTier` W/L blends Classic and Duo games against a tier
  whose strength differs per variant (research AE29's premise — and P18's future
  per-persona records inherit the same blend), `bestScores.advanced` shares one slot
  across two different games (the P51 "one slot, two quantities" bug reborn), and
  first-win / perfect-clear milestones fire once across variants.
- **Scope:**
  - `variant` on `GameRecord`; `SerializedRecord` **v3** with v1/v2 reading as
    `classic` (the existing version-defaulting pattern), and seat/score/winner/move
    arrays keyed by the variant's play-color list instead of `COLOR_ORDER` position.
  - Thread the variant through every reconstruction: initial-state building,
    `replayGame`, `buildRecap`, the recorder capture + score cross-check, and
    `summarize`'s seat/lineup reads (today `colorsLabelled` filters `COLOR_ORDER`, so
    a repaired Duo record would still summarize as `watched` / score `null`).
  - P15 store: `variant` on `GameResult`; `perTier`, `bestScores`, and the milestone
    unlocks keyed per variant; `sanitize` migrates pre-variant blobs to `classic`
    (the P51 precedent: attribute or drop, never guess).
  - **Guards (the point of the entry):** a serialize → deserialize → replay round-trip
    test on a Duo record; a test that a finished Duo game **survives** the recorder's
    catch and `loadHistory`'s drop-on-read — the silent paths must be proven
    pass-through for well-formed new-variant data, not just for Classic; a progression
    fold test asserting Classic and Duo results land in separate buckets.
  - **Sequencing constraint:** must **co-land with [P20](#p20--variety-blokus-duo--blitz--shipped)
    M2b** — the recorder runs at every game-over, so "ships playable" opens this window
    immediately, one dependency *before*
    [P54](#p54--variant-aware-ai-harness-let-the-arena-play-duo--shipped).
- **Depends on:** [P20](#p20--variety-blokus-duo--blitz--shipped) M2b (`black`/`white` in
  `Color`, `config.playColors`). Reads the variant registry from
  [P55](#p55--mechanical-classicduo-separation-make-variant-drift-impossible-not-discouraged)
  once that lands, but must not wait for it.

### P58 — Variant-scoped onboarding & feel content (tutorial, blitz pacing)
- **Drafted:** 2026-07-22
- **Status:** in-progress
- **Value:** two player-facing surfaces are calibrated to Classic with nothing
  recording the scope. The tutorial
  ([../../src/client/tutorial/scenarios.ts](../../src/client/tutorial/scenarios.ts))
  builds a Classic state and teaches "your first piece must cover your own starting
  corner" — true in its Classic flow, false as a statement about the game once Duo
  ships, and Duo's *defining* rule (interior start cells,
  [../GAME_SPEC_DUO.md](../GAME_SPEC_DUO.md) §3) has no teaching surface at all. Blitz
  pacing (`BLITZ_PACE_MS`,
  [../../src/client/ai/difficulty.ts](../../src/client/ai/difficulty.ts)) floors
  visible think-time against each tier's *Classic* search cost (P25); Duo searches are
  faster (196 cells, one opponent), so the tuned human-plausible feel drifts. Neither
  is code-incorrect and no test can see either — content and feel, the same detector
  class as P20 M2c's "the only detector is looking at it."
- **Scope:**
  - A Duo teaching surface: either a Duo scenario in the tutorial flow (interior start
    cell, one-opponent framing, advanced-only scoring) or an explicit variant gate on
    the existing flow with its copy scoped to Classic — decided at build time; the
    requirement is that no copy states a Classic-only rule as a rule of "the game."
  - Re-measure per-tier think-time on Duo and re-check the `BLITZ_PACE_MS` ranges
    against it — measured with `time`, not guessed.
  - Where content deliberately stays Classic (the front-door ambient board, the daily
    puzzle), the Classic-by-design intent gets written at the site as part of
    [P55](#p55--mechanical-classicduo-separation-make-variant-drift-impossible-not-discouraged)'s
    lint exemptions — not silently inherited.
- **Depends on:** [P20](#p20--variety-blokus-duo--blitz--shipped) M2b (playable Duo). The pacing
  check wants [P54](#p54--variant-aware-ai-harness-let-the-arena-play-duo--shipped)
  first — pacing has to be *measured* on a Duo board, which needs the arena.

---

## Epic: Project & doc tooling

Dev-facing hygiene that keeps the doc discipline mechanical instead of manual.

### P21 — Backlog schema test (docs as reliable data)
- **Status:** shipped — [tests/backlog-schema.test.ts](../../tests/backlog-schema.test.ts)
  parses this file + `docs/research/backlog/*.md` and asserts heading shape, unique
  in-namespace IDs, canonical `— SHIPPED` suffix, a documented-vocab `**Status:**`
  (product vocab from this file; research vocab from FRAMEWORK.md), and required
  fields on *open* entries (terminal ones may compress). First run surfaced two
  drifts — P1's hyphen `- SHIPPED` suffix and AE10's undocumented `resolved` status —
  fixed by their owners (/ship, /research).
- **Value:** grep-based orientation of the backlogs (skills read only `### <ID>` +
  `Status:` lines, never whole files) is only as reliable as the format — and drift
  already exists (P1's `- SHIPPED` vs the em-dash `— SHIPPED` elsewhere). A schema
  test makes retrieval mechanically trustworthy — the benefit of a structured
  dataset without leaving markdown — applying the "let tests enforce the spec"
  doctrine to the backlogs themselves.
- **Scope:** one vitest alongside the existing spec-invariant tests that parses
  this file + `docs/research/backlog/*.md` and asserts, per entry: heading shape
  `### <ID> — Title` with a unique `P#`/`AE#`/`AD#` (em-dash canonical, optional
  `— SHIPPED` suffix); a `**Status:**` drawn from that backlog's documented vocab;
  required fields (product: Value + Scope; research: the framework block —
  Objective/Hypothesis/Method/Success criteria/Cost/Log). The test only *reads*
  docs — single-writer contract untouched. Its first run will surface existing
  drift; fixing that goes through each file's owner (/ship, /research).
- **Depends on:** nothing.

### P22 — "Next up" queues (ranked head of each backlog)
- **Status:** shipped — `## Next up` blocks head this file + both
  `docs/research/backlog/*.md` (dependency-ready IDs, payoff-ranked, one-line why);
  the P21 schema test now fails CI if any listed ID is missing or terminal. Retired
  the competing signals: ai-engine.md's `next candidate` tag dropped, and this file's
  "sequencing lives in BUILD_ORDER" line repointed at the Next up block. Skill
  read/refresh one-liners proposed to the human as diffs (skills are human-owned).
- **Value:** makes "implement the next high-priority feature" / "run the next
  experiment" resolve unambiguously. Today product sequencing is delegated to
  BUILD_ORDER — finished, so a dangling pointer — and research order decays
  ("ordered roughly by payoff," plus one stale-able ad-hoc `next candidate` tag).
  Ranking only the *head* of each pool keeps maintenance cheap and honest: the
  human reviews a 5-line block, not the whole pool.
- **Scope:**
  - A `## Next up` block at the top of this file and each
    `docs/research/backlog/*.md`: 3–5 ranked IDs, dependency-ready entries only,
    one-line why each. The first line is the authoritative answer to "what's next."
  - Refreshed at the events that change priority, by the existing single writers:
    /ship on product status flips and intake; /research at close (Phase 4) and
    intake (Phase P).
  - Retire competing signals: drop ai-engine.md's `next candidate` tag; repoint
    this file's "sequencing lives in BUILD_ORDER" line at the Next-up block.
  - Extend P21's schema test: every Next-up ID must exist with a non-terminal
    status, so staleness fails CI; /checkpoint's dangling-state sweep double-checks.
  - Skill one-liners (/ship, /research, /implement, /checkpoint read/refresh the
    block): human-owned — proposed as diffs for sign-off at implementation.
- **Depends on:** nothing to add the blocks; the mechanical staleness check lands
  with/after P21. Initial rankings are the human's call (implementer proposes,
  user confirms).

### P55 — Mechanical Classic/Duo separation (make variant drift impossible, not discouraged)
- **Drafted:** 2026-07-22
- **Status:** partial — **the three mechanical guards shipped** (`052c867`), each *held
  by a test* rather than asserted: (1) `tests/variants-registry.test.ts` holds `VARIANTS`
  to GAME_SPEC/GAME_SPEC_DUO both ways — board size, colours + turn order, start cells,
  scoring, seat counts; (2) [../../src/client/tuning.ts](../../src/client/tuning.ts)
  generalises P54's one-off `DUO_EVENT_THRESHOLDS` into a per-variant delta axis, and
  [../../src/client/signals.ts](../../src/client/signals.ts) registers the standing
  signals (`INCURSION_MIN_PIECE`) that had no doc mirror at all, both mirrored in
  [../EVENTS.md](../EVENTS.md); (3) the `no-restricted-imports` guard, with four
  Classic-by-design file exemptions that state their reason. **Only the CLAUDE.md
  Invariant line is still owed** — human-owned, so it is a proposal awaiting sign-off,
  not work an agent finishes.
- **Value:** Duo's arrival turned every board-size and colour-set assumption into a
  correctness question, and today the answer is *convention*: research M6 and the
  `(Classic)` finding tags ask future sessions to remember, and GAME_SPEC_DUO.md's delta
  discipline asks them not to restate. Conventions are exactly what fails silently under
  agentic edits across parallel sessions. This repo already knows the better answer —
  [P21](#p21--backlog-schema-test-docs-as-reliable-data)'s schema test,
  [P32](#p32--in-game-event-vocabulary-cuts-mobility-swings-endgame-beats--maintained-registry)'s
  events registry, and the edit-guard hook all make alignment mechanical — and this entry
  applies that idiom to the variant split. The failure it prevents is the one
  [P54](#p54--variant-aware-ai-harness-let-the-arena-play-duo--shipped) documents:
  code reading the wrong board size stays green through vitest, typecheck **and** lint
  while the bot plays a corrupted game.
- **Scope:**
  - **Variant registry + both-ways test** (the
    [tests/events-registry.test.ts](../../tests/events-registry.test.ts) pattern): a
    single source-of-truth registry of variants in code, and a test asserting it agrees
    with [../GAME_SPEC_DUO.md](../GAME_SPEC_DUO.md) in **both** directions — board size,
    start cells, colour set, scoring rule. No variant in code the doc doesn't describe;
    no value in the doc the code contradicts.
    **Known limit, stated so nobody over-trusts it:** this pins *values*, not prose. It
    cannot detect a shared rule restated in the delta doc — that stays convention.
    Until this test exists, the start-cell pair `(4,4)`/`(9,9)` is guarded only by
    GAME_SPEC_DUO §3's in-doc warning against the anti-diagonal misreading — which is
    why the §6 worked cases (D1–D5, D5 being that exact invariant) land as rules-core
    tests with [P20](#p20--variety-blokus-duo--blitz--shipped) M2b rather than waiting here.
  - **Variant dimension for the signal registries.** `EVENT_THRESHOLDS`
    ([../../src/client/drama.ts](../../src/client/drama.ts)) is a flat record and
    [../EVENTS.md](../EVENTS.md) had no variant column. **P54 settled the event half:**
    the re-check moved `CUT_MIN_LOSS`, so `DUO_EVENT_THRESHOLDS` + a **Duo deltas** table
    landed, both held by [tests/events-registry.test.ts](../../tests/events-registry.test.ts).
    What's left here is generalising that one-off delta into a real per-variant axis, and
    folding in the unregistered
    standing-signal thresholds while at it: `INCURSION_MIN_PIECE`
    ([../../src/client/advisor/incursions.ts](../../src/client/advisor/incursions.ts))
    is feel-tuned like `CUT_MIN_LOSS` but has no doc mirror, no both-ways test, and no
    recorded variant scope, because the registry's charter covers only *events*. A
    second "standing signals" table (they are deliberately not events — P44) under the
    same test closes that class.
  - **Scoped lint rule:** `no-restricted-imports` on `BOARD_SIZE` / `COLOR_ORDER` /
    `CORNERS` within variant-sensitive paths (`src/game/ai/**`, `src/client/board/**`,
    `src/client/advisor/**`, plus the three files the drift analysis found outside
    those trees: `src/client/drama.ts`, `src/game/recap.ts`, `src/game/share.ts`), so
    reaching for a Classic constant from code that must be variant-aware is a lint
    error. `CORNERS` is in the list because it is the third Classic constant with a
    live wrong-use path — the exact fallback P54 removes from `alphabeta.ts`.
    `eslint.config.js` already scopes rules per `files` block, so this drops in.
    Intentionally-Classic surfaces caught by the widened net take a per-file disable that
    must state the Classic-by-design rationale — the exemption comment is where that intent
    finally gets recorded. **Refined 2026-07-22 (post-P54): this is an exemption list, not
    a clean sweep.** P54 previously claimed `arena.ts`/`arena.cli.ts` were the last two
    `COLOR_ORDER`-as-playing-set callers; a check of the tree after P54 landed says
    otherwise. Budget for *annotating* the Classic-by-design set, not converting it.
    **Snapshot, not a spec — re-derive membership when you build this** (a list in prose
    rots; that is the mistake being corrected here). As of 2026-07-22, and what makes
    each Classic-scoped, which is the part worth not re-deriving: `selfplay.ts` (stamps
    `variant: 'classic'`, self-consistent), `valuenet.ts` (4-colour feature layout),
    `pentobi/arena.ts` (Classic-only external baseline), `ambient.ts`, `puzzle/daily.ts`,
    and the client palette UI (`Wordmark`, `AmbientBoard`, appearance, `PalettePicker`).
    Guards the **constant-import** path; P54's required-`size`
    param guards the **function-call** path — different holes, both needed.
    **Shipped — and the snapshot above had indeed rotted, exactly as warned.** Membership
    was re-derived at build time: `drama.ts`/`recap.ts`/`share.ts` no longer import any of
    the three (the rule now keeps it that way), `puzzle/daily.ts` and the palette UI fall
    outside the guarded trees, and `board/orientation.ts` was *converted*, not exempted —
    it wants every colour any variant deals, so it reads a variant-union `ALL_COLORS` the
    registry test holds. Four files were genuinely Classic-by-design and carry the stated
    reason. **Read `eslint.config.js`, not this paragraph, for the current membership.**
  - **Agentic-layer guard:** propose a CLAUDE.md **Invariant** line naming the variant
    split. The former blocker is gone — CLAUDE.md has been tracked since `7aa4017`, so an
    invariant written there reaches parallel sessions and fresh clones; the line is
    proposable now, with human sign-off (CLAUDE.md stays human-owned).
    **Half of this bullet is already done** (verified at P55's claim gate, 2026-07-22):
    it also asked to add `docs/GAME_SPEC_DUO.md` to `.claude/edit-blocklist` once §7's
    open questions settled — `905c325` added it ahead of that, and §7 is still open, so
    the doc is guarded *earlier* than drafted, not later. Only the CLAUDE.md line remains.
  - **Explicitly not here:** making `size` a required argument of `idx`/`xy`/`inBounds` —
    that is P54's closing step, since P54 already rewrites three of the five files
    involved and splitting it would touch them twice. It is also the highest-value guard
    of the lot, so it must not wait on P55.
- **Depends on:** [P20](#p20--variety-blokus-duo--blitz--shipped) M2b (shipped) + P54 (shipped) —
  both cleared, so this is dependency-ready. The registry needed a real second variant to
  hold, and the lint rule would have fired on code P54 was still fixing.
  **Half the first bullet is already there:** M2b landed a `VARIANTS` table in
  [../../src/game/modes.ts](../../src/game/modes.ts) as the code-side source of truth, so
  what this entry still owes is the *both-ways test* against GAME_SPEC_DUO.md, not a new
  registry.

### P57 — Variant scope as schema in the research layer (make M6 true) — SHIPPED
- **Status:** shipped — every Scope item landed, including the optional findings tag:
  open AE/AD entries now carry a `Variant:` line checked against a vocabulary the test
  *reads from* FRAMEWORK.md's `## Variant scope` (so the doc stays the definition and
  no second source of truth can drift), findings from F19 on must carry a variant tag
  (F1–F18 grandfathered, as FINDINGS' preamble already drew it), the gate text sits in
  /triage and /research Phase P where M6 claimed it, and all 22 open entries — not only
  the AD2–AD4 the entry named — were brought into compliance. `difficulty.ts`'s tier
  comment now scopes F8/F15/F18 to Classic and names the known non-transfers.
- **Value:** [../research/FINDINGS.md](../research/FINDINGS.md)'s M6 closes with
  "Enforced at /triage (classification) and /research Phase P (entry gate)" — and
  neither skill contains the gate. Both carry M5's new-track check; neither mentions
  variants; FRAMEWORK.md's template has no variant field. So the scoping rule the
  research layer *paid for* (M6 documents three silent breaks) exists only as prose
  that misdescribes itself as enforced — the most corrosive kind of drift in a repo
  whose method is trusting exactly such claims. Concretely open today: a
  variant-silent AE/AD entry passes the P21 schema test exactly as F1–F18 originally
  did; AD2–AD4 ([../research/backlog/advisor.md](../research/backlog/advisor.md)) name
  no variant while their validation corpus (Run O, 697k positions) is Classic 4p
  self-play and AD2/AD3's candidate value signal — the F15 rank term — is
  algebraically void at two colors (AE31); and the tier comment in
  [../../src/client/ai/difficulty.ts](../../src/client/ai/difficulty.ts) states
  F8/F15/F18 constants as universal truths.
- **Scope:**
  - **Schema, not convention:** a required `Variant:` line on *open* AE/AD entries,
    with a small vocabulary (`classic` / `duo` / `both` / `mechanism`), enforced by
    extending [tests/backlog-schema.test.ts](../../tests/backlog-schema.test.ts)'s
    required-fields check — the P21 pattern, one more field. Template line in
    FRAMEWORK.md to match.
  - The gate text M6 already claims: one line in /triage's classification step and one
    in /research Phase P, beside the existing M5 lines.
  - Correct M6's enforcement sentence to name what actually enforces it. Optionally
    extend the schema test to require a variant tag on findings from F19 on.
  - Apply the rule to today's violators: variant-scope lines on AD2–AD4 (corpus and
    value-signal caveats above) and on `difficulty.ts`'s finding citations.
  - **Split pens, stated:** this entry's product-side work is the schema test and the
    skill text; every edit under `docs/research/` (FRAMEWORK.md template, FINDINGS M6,
    AD2–AD4) executes through /research, its single writer.
- **Depends on:** nothing — dependency-free guardrail work, startable now; coordinates
  with /research for its half.
