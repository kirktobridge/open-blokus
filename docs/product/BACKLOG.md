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

1. **P36** — deploy F15's `rankRewardWeight` 0.25 (AE15, won): sibling flip to the
   just-landed P37 that buys better lost-position play (+1.3 placed squares, CI-clear, no
   win-rate cost) and hands the advisor a non-degenerate value signal in lost positions.
   Same replication-batch / `replication-pending` caveat P37 landed under.
2. **P41** — rotate-view button: icon-only, hover-reveal, corner-anchored. Dependency-free
   (P6 shipped); drops the labelled rotate control's chrome for an arrow glyph anchored off
   the board's bottom-right corner, reclaiming the space under the board.
3. **P43** — event feed panel: a persistent consumer of the `useGameEvents` stream (P32's
   beats are transient pills that a player who looks away misses). Dependency-ready — P32,
   P38, and P12 all shipped; render the beat history as a scrollable log or footprint-friendly
   marquee, toggle in Settings.

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
- **Status:** in-progress.
- **Value:** deploys research win AE15/F15 (rank-normalized reward shaping at
  w=0.25), which sits won but undeployed behind a shipped default of 0. Buys better
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

### P47 — Auto-mute when watching a fully-bot game
- **Status:** proposed
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
- **Status:** proposed
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
- **Status:** proposed
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
- **Status:** proposed
- **Value:** cuts (P32 `cut`) are named *after* they happen. This warns *before*: it marks
  the corners where an opponent could thread a diagonal past your wall into the space behind
  it — the defensive read strong players make and beginners miss.
- **Scope:** (1) **define** the predicate in the rules core (`drama.ts` pattern) — "your
  line," "the space behind it," and "a legal opponent diagonal that reaches it" made precise;
  deterministic + one feel-tuned threshold, like `cut`/`cramped` (threshold tuning is feel,
  not research — the P32 precedent, so this stays **product-only**). (2) **register** it in
  [EVENTS.md](../EVENTS.md) as a new event id (the doc↔detector test enforces both ways).
  (3) an advisor **overlay** highlighting the at-risk corners, riding the existing
  cut-highlight seam. (4) **toggle** in the P38 Gameplay tab, **default OFF** (advisor aids
  default off, per P38).
- **Depends on:** P32 (the event registry + detector pattern), P38 (the toggle home).

### P45 — Lobby menu: subtitles into hover tooltips
- **Status:** proposed (exploratory — mockup reviewed)
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
- **Status:** proposed (to flesh out)
- **Value:** "last custom config" makes Quick Play unpredictable — one odd experiment poisons
  the one-click path. A stable, *settable* default keeps Quick Play the reliable fallback P35
  leans on as the always-valid primary action.
- **Scope (rough):** define a built-in default vs-AI setup; Quick Play launches it unless the
  player has set their own default. Surface a "set as my Quick Play default" affordance (from
  the custom-game setup, or in Settings). Preserve P17's blitz/extreme-resolve guard. Exact
  UX TBD.
- **Depends on:** P17 (shipped — Quick Play + persisted setup).

### P48 — Right-rail & piece-tray layout: widen horizontally + collapsible panels (all modes)
- **Status:** proposed
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
  it with a wider shared layout. Update the affected layout tests (`review-table`,
  board-view/right-rail).
- **Depends on:** nothing. Revises P6 (study-table three-column layout) and P2 + P34's shipped
  review layout. Surfaces: `BlokusBoardView.tsx`, `ReviewTable.tsx`, `HandTray.tsx`.

---

## Epic: Engagement & retention

The "why come back" layer — daily hooks and a memory of your journey across games.

### P14 — Daily puzzle
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

### P15 — Local progression, stats & history
- **Status:** partial — **M1 shipped**: a "Your progress" home-screen card backed by
  a localStorage store (games, per-tier win rate, best score, current/best streak,
  perfect clears) with one-time milestone toasts (first win vs each tier, perfect
  clear). M2 (game history list + replay scrubber) pending — the scrubber is now
  built and ready to reuse: `src/client/recap/ReplayScrubber` (shipped with P2 R0).
- **Value:** games leave a residue — beating `extreme` the first time should look
  different from losing your first game. Makes P13's named tiers *feel* like a ladder.
- **Scope / milestones:** M1 localStorage counters — games played, win rate per tier,
  best score, streaks, milestone toasts (first win vs each tier, perfect clear).
  M2 game history list + replay scrubber.
- **Depends on:** M1: nothing. M2: P1 (game logging); replay assets shared with
  P2 (recap).

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

### P20 — Variety: Blokus Duo & blitz
- **Status:** partial — **M1 (blitz) shipped**: per-move countdown for human seats in the
  offline vs-AI table. **M2 (Duo) not started**, still blocked on rules-core board-size
  generalization.
- **Note (M1):** expiry auto-plays a *random legal move*, not a skip — Blokus has no pass
  move (GAME_SPEC §5), so a timeout forfeits your choice of move, not your turn. The
  entry's "auto-skip **or** auto-random" was resolved to auto-random for that reason.
- **Value:** classic 20×20 is the only way to play. Duo (14×14, center-adjacent
  starts) is *the* canonical 2-player experience; blitz (per-move timer) makes the
  same engine feel like a different game.
- **Scope / milestones:** M1 blitz — per-move countdown, auto-skip or auto-random on
  expiry (UI + turn glue only). M2 Duo — board size + start-cell rule become mode
  config (touches rules core → GAME_SPEC + ARCHITECTURE updates required).
- **Depends on:** M1: nothing. M2: rules-core generalization (board size is
  currently a constant).

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
