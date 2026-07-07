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

1. **P4** — pre-game tutorial: independent, pure UI, onboarding payoff; builds the
   legal-placement highlight that P3 R1 reuses (build once).
2. **P3** (R1) — mid-game advisor legal-placement overlay: pure UI, unblocked today;
   shares P4's highlight asset.
3. **P14** (M1) — daily-puzzle solitaire: a daily reason to open the app; engine +
   seeded self-play already exist.
4. **P15** (M1) — local progression stats: games leave a residue (win rates, streaks);
   nothing blocking.
5. **P19** — multiplayer identity & reactions: cheap social win; reuses the
   boardgame.io transport.

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
- **Status:** proposed (blocked on P1 + research AD4 signal, AD2 evaluator)
- **Value:** turn-level annotations after a game — "good plays," blunders, swings, with
  plain-English messages ("Turn 6: you closed your own corridor"). Special interest:
  games where humans beat the AI. A local LLM could later narrate the structured signal.
- **Scope / milestones:** **R0 — replay scrubber + score-over-time timeline, no AI**
  ("when did I fall behind?" — genuine advice with zero evaluator risk; scrubber
  shared with P15 M2). R1 — event thresholds → message templates → recap UI.
  R2 — **"retry from this turn"**: jump into the game at a flagged turn and play it
  out vs bots (replay to turn N via the pure rules core, hand control to the human) —
  closes the learn-loop. Shares assets with P3.
- **Depends on:** P1 (logs) for all milestones; R0 needs nothing else. R1+: research
  [AD4](../research/backlog/advisor.md) computes/validates the signal (MCTS
  best-move gap + eval-swing); research AD2 for the score. AD4 also feeds P14 M2
  (daily-puzzle move grading) — shared payoff.

### P3 — Mid-game advisor overlay
- **Status:** proposed (R1 unblocked; R2+ deferred until the evaluator is trustworthy)
- **Value:** live in-game guidance without overwhelming the player.
- **Scope / milestones:** R1 "show legal placements" — **pure UI, unblocked today**
  (`generateLegalMoves` is exact, F7); also the core asset for P4's tutorial step 3 —
  build once. → R2 "suggest 2–3 candidate moves with plain-English reasons" →
  R3 "heatmaps / strategic priorities."
- **Depends on:** R1: nothing. R2+: P1; research AD2 (evaluator) + AD3 (win-prob).
  High UI complexity in R2+.

### P4 — Pre-game tutorial (interactive)
- **Status:** proposed (independent — not gated on logging or the evaluator)
- **Value:** teach the four core ideas faster than text — corner-touch rule, no
  own-edge-touch, first move from your corner, preserving expansion lanes.
- **Scope:** scripted 4-step interactive sequence: place a legal piece → see an illegal
  edge-touch rejected → see multiple corner options → compare "bad but legal" vs "better
  for growth."
- **Depends on:** nothing. Mostly UI. Step 3 reuses P3 R1's legal-placement
  highlight component — build once, share.

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
- **Remaining:** long-move UX for `extreme` (→ P10).

### P10 — Long-move feedback for the strongest tier
- **Status:** proposed (independent; small).
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
    implementation detail, retunable at will.
  - **Decision rule per AE win:** efficiency wins (same strength, cheaper —
    AE2/AE9/AE17-type) retune existing tiers in place (snappier moves, same band);
    **ceiling wins** mint a new top tier only if they beat the current top by a
    measured margin (≥60 % game-share, per that AE entry's bar) *and* meet a
    latency budget — otherwise fold into `extreme`'s config.
  - Recalibration workflow: after any engine change touching shipped tiers, re-run
    the ladder monotonicity arena check (Runs J–K precedent) plus anchor-pool
    matches; cap the ladder at ~5–6 named rungs (keeps the per-seat picker and
    P18 personas sane).
  - Code side as before: extend `Difficulty` union + `DIFFICULTIES` order +
    per-tier bot-strategy map once tiers diverge past MCTS-config; setup UI tier list.
- **Depends on:** research AE21 (population-play Elo — the anchor-pool measurement
  that makes recalibration cheap and trustworthy); a won AE experiment beating the
  current top tier for any actual new rung.

### P18 — Bot personas
- **Status:** proposed
- **Value:** turns "difficulty dropdown" into rivals — name, face, think-time quips,
  and a *real* play style (heuristic weight variants: aggressive blocker vs greedy
  expander), not just cosmetics.
- **Scope:** persona definitions mapped onto existing tiers + weight variants; setup
  UI picks rivals instead of tiers (tier still visible).
- **Depends on:** nothing. Optional later research follow-up if we want to *verify*
  styles are distinct (would then get an AE entry).

---

## Epic: Game feel & UI

Look, feel, and interaction. Curated from [../dev_notes/OPEN_IDEAS.md](../dev_notes/OPEN_IDEAS.md)
§UI. Theming principle: playful skeuomorphism, translucent-plastic Blokus pieces, the
four classic colors as accents, shapes as the star.

### P5 — Skeuomorphic piece & board finish
- **Status:** partial — joined-piece translucent **gel finish shipped** for placed cells
  (PlacedLayer SVG overlay). Remaining: board plastic texture, tray, translucent-plastic
  polish across all palettes.
- **Value:** the tactile "real Blokus set" identity.
- **Scope:** hyperrealistic board plastic; per-palette piece finishes; grain/bevel/shadow.

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
- **Notes:** themes + tokens are CSS custom properties swapped on `<html>` (no React
  re-render); palette, token overrides, theme, and inventory choice persist to
  localStorage. Top-bar triggers are emoji-free monochrome SVG icons.

### P7 — Sound design
- **Status:** proposed (deferred — later release)
- **Value:** nostalgic 90s/2000s-internet feel; MIDI/Flash-era piece-placement sounds. Should be deeply satisfying.
- **Scope:** placement/UI SFX, palette of nostalgic cues.

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
    on drop
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

---

## Epic: Engagement & retention

The "why come back" layer — daily hooks and a memory of your journey across games.

### P14 — Daily puzzle
- **Status:** proposed
- **Value:** a daily reason to open the app — same seeded challenge for everyone,
  shareable emoji-grid result (Wordle-style). Converts an evergreen board game into
  a habit.
- **Scope / milestones:** M1 *solitaire* — seeded mid-game position (self-play to
  turn N with a fixed daily seed), "fit as many remaining pieces as you can," score =
  cells placed, local share text. M2 *best-move* — "find the strongest placement,"
  graded against MCTS. M3 — server-shared leaderboard.
- **Depends on:** M1: nothing (engine + seeded self-play exist). M2: research
  [AD4](../research/backlog/advisor.md) (move-grading signal must be trustworthy
  before it grades *you*). M3: server work.

### P15 — Local progression, stats & history
- **Status:** proposed
- **Value:** games leave a residue — beating `extreme` the first time should look
  different from losing your first game. Makes P13's named tiers *feel* like a ladder.
- **Scope / milestones:** M1 localStorage counters — games played, win rate per tier,
  best score, streaks, milestone toasts (first win vs each tier, perfect clear).
  M2 game history list + replay scrubber.
- **Depends on:** M1: nothing. M2: P1 (game logging); replay assets shared with
  P2 (recap).

---

## Epic: Social & multiplayer presence

### P19 — Multiplayer identity & reactions
- **Status:** proposed
- **Value:** online opponents are literally "P0/P1" today — anonymous games feel
  dead. A nickname and a few canned reactions ("nice move," "ouch," …) change the
  social temperature cheaply, without open-chat moderation burden.
- **Scope:** nickname field (persisted locally, sent on join); canned-reaction button
  row broadcast via the existing transport; shown as toasts by the player card.
- **Depends on:** nothing hard; reuses boardgame.io transport.

---

## Epic: Game modes

### P20 — Variety: Blokus Duo & blitz
- **Status:** proposed
- **Value:** classic 20×20 is the only way to play. Duo (14×14, center-adjacent
  starts) is *the* canonical 2-player experience; blitz (per-move timer) makes the
  same engine feel like a different game.
- **Scope / milestones:** M1 blitz — per-move countdown, auto-skip or auto-random on
  expiry (UI + turn glue only). M2 Duo — board size + start-cell rule become mode
  config (touches rules core → GAME_SPEC + ARCHITECTURE updates required).
- **Depends on:** M1: nothing. M2: rules-core generalization (board size is
  currently a constant).

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
