# Product backlog

Curated pool of **product / feature** ideas we want to build — the shippable,
user-facing side of the project. Sibling to [../research/](../research/): research owns
*questions* (measurable, arena/data-answered); this owns *features* (user value + UX
milestones). When a feature can't state a success bar without writing "N/A", it belongs
here, not in research.

A backlog is a **prioritized pool, not a committed plan** — sequencing/phasing lives in
[../BUILD_ORDER.md](../BUILD_ORDER.md). Source pipeline mirrors research:
[../dev_notes/OPEN_IDEAS.md](../dev_notes/OPEN_IDEAS.md) is the raw, unmaintained
developer dump; this file is the curated version. Rules → [../GAME_SPEC.md](../GAME_SPEC.md);
structure → [../ARCHITECTURE.md](../ARCHITECTURE.md).

Status vocab: `proposed` / `partial` (some milestones shipped) / `shipped` /
`deferred`. Product features don't carry a hypothesis or a game-share bar — that's what
distinguishes them from a research entry.

---

## Epic: Advisor & game analysis

The player-facing intelligence surface. Each feature **depends on a research question**
being answered first (the evaluator/win-prob/blunder signal must be *trustworthy*
before it's *shown*) — those questions live in
[../research/backlog/advisor.md](../research/backlog/advisor.md) (AD2–AD4). Build order
runs foundation → offline surfaces → live surfaces.

### P1 — Game-logging foundation (infra)
- **Status:** proposed (foundational — unblocks P2, P3, and research AD2–AD4 + AE4)
- **Value:** move-by-move data is the substrate for every analysis/advisor feature and
  for self-play datasets (learned eval, research AE4).
- **Scope:** design a game-log schema + a system that manages it; decide the split
  between **app-logging** (debug/telemetry) and **game-logging** (analysis data); emit
  from both the arena and real matches.
- **Depends on:** nothing (it's the root). Get the app-vs-game boundary right early —
  long-lived schema decision.
- **Notes:** build-a-thing, not an experiment, so it lives here rather than research.

### P2 — Post-game recap (play-by-play, blunders, key moments)
- **Status:** proposed (blocked on P1 + research AD4 signal, AD2 evaluator)
- **Value:** turn-level annotations after a game — "good plays," blunders, swings, with
  plain-English messages ("Turn 6: you closed your own corridor"). Special interest:
  games where humans beat the AI. A local LLM could later narrate the structured signal.
- **Scope:** the *delivery* — event thresholds → message templates → recap UI. Shares
  assets with P3.
- **Depends on:** P1 (logs); research [AD4](../research/backlog/advisor.md) computes/validates
  the signal (MCTS best-move gap + eval-swing); research AD2 for the score.

### P3 — Mid-game advisor overlay
- **Status:** deferred (until UI/style is finalized AND the evaluator is trustworthy)
- **Value:** live in-game guidance without overwhelming the player.
- **Scope / milestones:** R1 "show legal placements" → R2 "suggest 2–3 candidate moves
  with plain-English reasons" → R3 "heatmaps / strategic priorities."
- **Depends on:** P1; research AD2 (evaluator) + AD3 (win-prob). High UI complexity.

### P4 — Pre-game tutorial (interactive)
- **Status:** proposed (independent — not gated on logging or the evaluator)
- **Value:** teach the four core ideas faster than text — corner-touch rule, no
  own-edge-touch, first move from your corner, preserving expansion lanes.
- **Scope:** scripted 4-step interactive sequence: place a legal piece → see an illegal
  edge-touch rejected → see multiple corner options → compare "bad but legal" vs "better
  for growth."
- **Depends on:** nothing. Mostly UI.

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

### P6 — Board layout & navigation
- **Status:** partial — read-only controls reference panel **shipped**; board-rotate
  animation **shipped**. Remaining: layout (center vs left-half with tray), player's
  corner always bottom, full keyboard/mouse placement model.
- **Value:** comfortable placement + orientation control.
- **Scope:** WASD/cursor hover, scroll/arrows rotate, space/click place, Enter submit;
  rotate-view button; board positioning.

### P7 — Sound design
- **Status:** proposed (deferred — later release)
- **Value:** nostalgic 90s/2000s-internet feel; MIDI/Flash-era piece-placement sounds.
- **Scope:** placement/UI SFX, palette of nostalgic cues.
