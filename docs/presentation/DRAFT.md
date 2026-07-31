# OpenBlokus — Presentation Draft

Audience: technical non-developers (SQL / Python / data workflows), no Blokus
knowledge, curious about AI. Prepared for handoff to Claude Design.

> Repo: https://github.com/kirktobridge/open-blokus — pull assets per the
> `[SCREENSHOT]` / `[DIAGRAM]` labels below. All screenshots are pre-captured in
> `docs/presentation/assets/` (filenames `01-…` through `hist-02-…` keyed to the
> labels); diagrams still need to be drawn.

---

## Meta

- **Estimated total time:** 28–35 minutes (including one 2-minute live demo and the
  2-minute AI explanation beat).
- **Suggested slide count:** Step 1: 2 · Step 2: 2 · Step 3: 2 · Step 4: 3 ·
  Step 5: 1 · Step 6: 8–9 (one per feature + 2 for the AI beat) · Step 7: 3.
  **Total: ~21 slides.**
- **Live demo vs static:** Step 6's first feature (carried-piece placement) is the one
  moment that genuinely needs a *live* demo — the feel of carrying a piece can't be
  screenshotted. Everything else works as static slides; Step 1 benefits from the
  self-playing ambient board running silently behind the title.

---

## Step 1 — What is Blokus?

*Source: GAME_SPEC.md §1–§3.*

### Talking Points

- "Blokus is a board game about claiming territory with Tetris-like tiles. Each of
  four colors gets the same 21 pieces, and you take turns placing them on a shared
  20-by-20 grid. Whoever fits the most of their pieces onto the board wins."
- "There's exactly one rule that makes it interesting: your own pieces may only touch
  each other **corner to corner** — never side to side. That one constraint turns a
  tile-laying game into a knife fight over diagonal escape routes."
- "It takes thirty seconds to learn and it's genuinely deep — which also makes it a
  perfect target for building a game AI."

### Slide Content

- Title slide: project name over a live mid-game board.
- One line: *"21 pieces per color · one shared board · corners touch, edges never."*
- The "aha" to land verbally: **every piece you place opens new corners for you and
  walls off space from everyone else** — offense and defense in the same move.

### Demo / Visual Moment

- [SCREENSHOT: the ambient self-playing board on the home screen
  (`src/client/lobby/AmbientBoard`) mid-game — four colors radiating from the four
  corners, skeuomorphic finish. Ideal running silently behind the title while you
  talk.]
- [SCREENSHOT: the piece tray (`src/client/tray/PieceTray.tsx`) showing all 21 pieces
  of one color — "here's your entire hand for the whole game."]

### Avoid

- Don't name piece IDs (`F5`, `X5`…) or say "polyomino" — say "Tetris-like tiles"
  and move on.

---

## Step 2 — How Blokus is Played

*Source: GAME_SPEC.md §4 (placement rules), §5 (turn flow & game end), §6 (scoring).*

### Talking Points

- "Your first piece must cover your starting corner of the board. After that, every
  new piece must touch one of your existing pieces — but only diagonally, at a
  corner. It can never share an edge with your own color."
- "Picture this: you've placed an L-shape. Its corners are now your doorways — the
  only cells you can grow from. Your opponent can slide a piece right up against
  your edges to seal a doorway shut. Other colors can touch you anywhere; only your
  *own* color is restricted."
- "The game ends when nobody can legally place anything. Then you count the squares
  you *couldn't* place — fewest left over wins. So a big awkward piece you're stuck
  holding at the end is exactly as painful as it sounds."

### Slide Content

- Three rules, three icons: **Start in your corner → Touch your corners → Never your
  edges.**
- One "picture this" panel: a piece placed legally (corner-touch, tinted in the
  player's own color) next to the same piece placed illegally (edge-touch, red).
- End state: "board freezes → count your leftovers → lowest wins."

### Demo / Visual Moment

- [SCREENSHOT: the ghost-piece preview in-game — the same piece hovered in a legal
  spot (tinted the player's own color) and an illegal edge-touching spot (red tint).
  This is the whole rule set in one image; the app's `GhostPiece` legality tint
  renders it for free. Note: legal ≠ green — legal previews use the mover's color;
  only illegal is fixed red.]
- [DIAGRAM: a 6×6 zoom-in — two blue pieces touching at exactly one corner with the
  corner circled, and a red "not allowed" version where they share an edge.]

### Avoid

- Don't explain the scoring bonuses (+15 all-placed, +5 monomino-last), the 2/3-player
  color-sharing modes, or the auto-pass mechanics aloud — "fewest squares left wins"
  is all a non-gamer needs. GAME_SPEC's "diagonally adjacent / orthogonally adjacent"
  phrasing should become "corners touch / edges never."

---

## Step 3 — Claude Code and Vibe Coding

*Source: CLAUDE.md (development approach); BUILD_ORDER.md (the runnable-loop).*

### Talking Points

- "Everything you're about to see was built with Claude Code. Think of it as a
  developer permanently on call who reads plain English: I describe what I want, it
  writes the code, runs the tests, and explains what it did — in my terminal, with
  full access to the project."
- "The working style is called vibe coding: **describe → see it → adjust.** You
  describe the feature, you look at the running result, you say what's wrong, and you
  loop. You never need to read the source yourself — you steer by what you can see."
- "This isn't a detour in the story — it's the method that makes everything after
  this slide possible. I'm a data person, not a game developer, and this is a
  real-time multiplayer game with a researched AI opponent."

### Slide Content

- Plain definition card: *"Claude Code = a developer on call who reads plain English."*
- The loop as three arrows: **describe → see it → adjust** (repeat).
- One concrete example of a prompt-shaped request next to its visible outcome (e.g.
  "make placing a big piece sound heavier" → the placement click now scales with
  piece size — a real shipped feature, P7).

### Demo / Visual Moment

- [SCREENSHOT: a real Claude Code terminal session on this repo — a plain-English
  request at the prompt, a diff being applied, tests passing below it.]

### Avoid

- Don't oversell "no code involved" — the honest and more impressive claim is "I
  never had to read the code; the *system* around it kept it trustworthy," which
  sets up Step 4.

---

## Step 4 — The Operating System Around the Project

*Sources: CLAUDE.md (doc & claim discipline), BUILD_ORDER.md, ARCHITECTURE.md,
docs/research/FINDINGS.md, tests/backlog-schema.test.ts, tests/events-registry.test.ts.*

### Talking Points

- "Here's the part that made vibe coding scale. The AI wrote the software, but a set
  of guardrails — documents, tests, and workflows — is what kept a project I never
  read line-by-line understandable, repeatable, and safe to evolve."
- "The core idea: every fact lives in exactly one place, and wherever possible a
  *test* — not a human — checks that the documents and the code still agree. When
  docs can drift silently, they will; so the important agreements are mechanical."
- "And the project distinguishes what it *believes* from what it has *measured*.
  Product features go in one backlog; AI experiments go in a research log with
  statistics, confidence grades, and committed evidence files. That separation is
  why I can tell you exact win rates later in this talk."

### Slide Content

- The document map, five boxes: **GAME_SPEC** (the rules) · **ARCHITECTURE** (the
  why) · **BUILD_ORDER** (the plan — every phase ends runnable) · **product/BACKLOG**
  (features) · **research/** (experiments: append-only log → distilled FINDINGS).
- Guardrails, concretely (pick 4):
  - **Every build phase ends in something runnable** — never weeks of invisible
    progress. *(BUILD_ORDER.md, guiding rule.)*
  - **Tests police the paperwork**: a "won" research result must name where it
    deployed; a backlog entry drafted before its dependency shipped gets flagged as
    stale. *(tests/backlog-schema.test.ts.)*
  - **Docs and code are held in sync both ways** — e.g. the registry of in-game
    events and the code that detects them are checked against each other by a test.
    *(tests/events-registry.test.ts, docs/EVENTS.md.)*
  - **Evidence is committed, not remembered**: the bot Elo ratings ship as a JSON
    artifact fingerprinted against the match data it was fit from — a test rejects
    the ratings if the data changes without recalibration.
    *(src/game/ai/ladder/classic.json, P62.)*
- One-liner from the project's own instructions: *"Once code exists, code + tests own
  the **what**; docs keep the **why**."* *(CLAUDE.md.)*
- Also worth a bullet: repeatable slash-command workflows (/implement, /research,
  /land, /checkpoint) that encode the process itself, so every session follows the
  same rails.

### Demo / Visual Moment

- [DIAGRAM: the five-box document map with arrows for who checks whom — tests in the
  middle holding BACKLOG↔code and EVENTS↔detectors together. Keep it to one screen.]
- [SCREENSHOT: a failing schema-test message, e.g. the backlog test rejecting a "won"
  entry with no "Deploys as:" line — "the paperwork has a linter" lands instantly
  with this audience.]

### Avoid

- Don't tour file contents or read doc prose on-slide. This audience lives in data
  quality and schema validation — pitch it as "constraints and CI for the project's
  claims," not as documentation hygiene.

---

## Step 5 — What I First Built

*Source: BUILD_ORDER.md Phases 0–6 ("Runnable" / "Verify" lines).*

### Talking Points

- "A few days of vibe coding produced a complete, working Blokus: all 21 pieces, the
  full rules, click-to-place with rotate and flip, four players pass-and-play in one
  browser, played to game-over with correct scores and a winner."
- "The order mattered: the pure rules engine was built and fully tested *before* any
  UI existed — including reproducing the official rulebook's scoring example exactly.
  So when the pretty version showed up later, the rules under it were already solid."
- "This is the baseline, not the destination. Everything interesting happened after."

### Slide Content

- "Day-one product" checklist: ✅ all 21 pieces & orientations · ✅ full placement
  rules · ✅ legal-move preview (color/red ghost) · ✅ 4-player pass-and-play ·
  ✅ scoring + winner screen.
- Small caption: rules core verified against the official rulebook's worked scoring
  example (+20 / −8 / −24 / −20) before the first real UI. *(BUILD_ORDER Phase 3.)*
- (Phases 7–9 — real networked multiplayer, lobby, persistence — shipped next;
  mention in one breath, no slide of their own.)

### Demo / Visual Moment

- [SCREENSHOT: an early-style plain board — the flat CSS-grid look of Phase 5/6, if
  recoverable from git history; otherwise a deliberately unstyled mock. Its job is
  to contrast with the P5 finish two slides later.]

### Avoid

- Don't walk the phase list or say "boardgame.io," "Vite," or any stack name. One
  sentence of *what a user could do* beats ten of architecture.

---

## Step 6 — How It Evolved (Feature by Feature)

*Source: docs/product/BACKLOG.md (per-feature P# cited inline). Order: UX/gameplay
first, then the AI beat, then difficulty & advisors.*

### 6.1 Carried-piece placement — *BACKLOG P23, P6*

- **Talking point:** "You click a piece and it sticks to your pointer — you carry it
  to the board, rotate and flip it in flight, and drop it where it lands. It's the
  difference between filling in a form and playing with physical tiles."
- **Slide:** before/after interaction sketch: select-then-click vs carry-and-drop.
- **Demo:** ⭐ **live demo moment** — carry a piece, rotate mid-carry, drop it. 30
  seconds, no slide can replace it.
- **Avoid:** UI-internals words like "staged state" or "hover anchor."

### 6.2 The skeuomorphic finish — *BACKLOG P5, P42*

- **Talking point:** "The board became an injection-molded plastic Blokus set:
  per-cell wells, alignment studs, translucent tiles, all lit from one direction.
  Every alpha and highlight is a theme token — the finish survives any color scheme."
- **Slide:** side-by-side: flat early board vs P5 finish. Caption: "same data,
  different craft."
- **Demo:** [SCREENSHOT: mid-game board close-up with the PlacedLayer finish — the
  project's primary visual identity; crop to ~8×8 cells so the molding reads at
  projector distance.]
- **Avoid:** the token/theming machinery — that story belongs to 6.4.

### 6.3 Procedural sound — *BACKLOG P7*

- **Talking point:** "All audio is synthesized in the browser — zero sound files.
  Placing a piece makes a satisfying click whose pitch scales with piece size, and
  game events like cuts and endgame beats each get their own cue. The test suite
  literally checks the rendered waveform — it once caught a limiter quietly ducking
  every sound in the game."
- **Slide:** "Zero audio assets" + three cue names with waveform squiggles.
- **Demo:** play the placement click live for a small vs a large piece (or a
  screen-recorded clip with audio).
- **Avoid:** Web Audio API terminology.

### 6.4 Themes & settings — *BACKLOG P12, P60*

- **Talking point:** "Three built-in table themes — Linen, Lamplight, Walnut — plus
  five preset piece palettes including colorblind-safe ones, and you can retint any
  color live. The molded finish re-lights itself for each theme."
- **Slide:** the three themes as three vertical strips of the same board.
- **Demo:** [SCREENSHOT: the Settings panel (`src/client/settings/`) open over the
  board, mid-theme-switch; or a 3-up of Linen / Lamplight / Walnut.]
- **Avoid:** CSS variables — say "every visual constant is a named dial."

### 6.5 — Pause: how the bots actually work (the AI beat)

*Sources: FINDINGS.md F6, F8, F12, F17, F18; src/client/ai/difficulty.ts.*
Placed here deliberately: before difficulty tiers or advisors mean anything, the
audience needs the 2-minute version of MCTS.

**The 2-minute spoken explanation:**

> "The bots use Monte Carlo Tree Search — MCTS. Here's the whole idea: think of a
> chess player who, before each move, mentally plays through thousands of possible
> futures — not perfectly, just quickly. The bot doesn't know any Blokus strategy.
> It picks a candidate move, then plays the rest of the game out semi-randomly to
> the very end, notes who won, and writes that result back onto the move it started
> from. Then it does that again, thousands of times, using a formula that balances
> trying new moves against revisiting ones that keep winning. After all those
> simulated games, it plays the move it kept coming back to.
>
> "Four steps in a loop: **select** a promising path down the tree, **expand** it by
> one new move, **roll out** — simulate the game to the end — and **backpropagate**
> the result up the tree. That's it. No strategy book anywhere.
>
> "And here's what I love: in Blokus the real resource is *corners* — the diagonal
> doorways your future pieces grow from. Nobody told the bot that. It discovers it,
> every move, by noticing that futures where it kept its corners open tend to end in
> wins.
>
> "Almost everything I learned tuning this came from measuring, not intuition. The
> single biggest factor is that simulations must run to the *end of the game* —
> truncating them early turns a 68% win rate into 39%, a 29-point collapse, because
> guessing the winner mid-game is a bad proxy for knowing it (F6). Making legality
> checks 2.5× faster with a bitboard board representation converted directly into
> strength — 71% win rate at the same wall-clock, purely because speed buys more
> simulations (F12). And how many candidate moves the bot weighs at each step — the
> 'beam' — has to match its thinking budget: give a 30-simulation bot 16 options and
> it spreads 2 samples per option, which is coin-flipping — that tier actually *lost*
> to the simple bot until the beam was narrowed (F8)."

**Plain-English glossary (slide or handout):**

- **MCTS** — a search that builds a decision tree from thousands of random game
  simulations and learns which early moves tend to lead to winning endings.
- **Rollout / playout** — one simulated game played from a position to the very end:
  "what happens if we keep playing from here?"
- **Beam width** — how many candidate moves the bot weighs at each decision point;
  the wrong ratio of options-to-simulations is pure noise.
- **Heuristic weighting** — the bot's rough intuition for which moves to try first
  (piece size, open corners, blocking) before simulation takes over.

**Slide content:**

- The four-phase loop as a cycle diagram, plus the punchline stat: *full-length
  simulations vs truncated = 68% vs 39% win rate (F6).*
- A "measured, not guessed" strip: full rollouts +29 pts (F6) · bitboard speed →
  71% at matched clock (F12) · rollout width +11 pts at deep budgets (F18) · beam
  must scale with budget (F8).

**Demo / Visual:**

- [DIAGRAM: the select → expand → rollout → backpropagate cycle around a small game
  tree, one branch thickening as visits accumulate.]
- [DIAGRAM: a Blokus corner marked as a "doorway," with a simulated-futures fan
  radiating from it — ties the algorithm to the game object the audience just
  learned.]

**Avoid:** the UCT/UCB1 formula, the word "hyperparameter," and any code.

### 6.6 Difficulty tiers with measured strength — *BACKLOG P9, P61, P62; FINDINGS F19*

- **Talking point:** "Easy through Extreme aren't vibes — each tier is a different
  compute budget, and each has a measured chess-style Elo rating from a
  round-robin tournament between all the bots: Easy ≈ 1549, Medium ≈ 1683,
  Hard ≈ 1796, Extreme ≈ 2056."
- **What the tiers are, mechanically** *(difficulty.ts)*: Easy = the heuristic
  formula, no search. Medium = MCTS, ~30 simulations/move (beam 6). Hard = MCTS,
  ~139 simulations (beam 16). Extreme = 500 simulations, no time cap, wide rollout
  sampling — and it's still only ≈ Pentobi level 1–2 of 9 (F14). Lots of room left.
- **Slide:** the four tiers as a ladder with Elo numbers; footnote: *ratings are a
  committed, test-guarded artifact (`src/game/ai/ladder/classic.json`).*
- **Demo:** [SCREENSHOT: the difficulty picker showing the per-tier strength ratings
  (shipped by P61).]
- **Avoid:** Bradley-Terry, anchoring, or pool-relativity — "a tournament between
  all the bots, scored like chess ratings" is the whole story here.

### 6.7 Post-game review — *BACKLOG P2, P34, P1*

- **Talking point:** "Every offline game is recorded. Afterwards you scrub back
  through each move and watch two charts evolve: the score race, and *mobility* —
  how many doorways each color had left. You can usually spot the exact move where
  someone's game quietly died."
- **Slide:** one annotated review screenshot; arrow at a mobility cliff: "here's
  where green got sealed in."
- **Demo:** [SCREENSHOT: `src/client/recap/ReviewTable.tsx` mid-scrub — board state
  plus the score and mobility timelines below.]
- **Avoid:** replay-infrastructure plumbing.

### 6.8 Advisor overlays — *BACKLOG P3, P34, P44, P39, P50*

- **Talking point:** "Opt-in coaching overlays, all off by default: highlight where
  you can legally play, meter how much room you have left, flag which of your pieces
  are unplayable this turn, and warn you when an opponent has a diagonal doorway
  cutting into your territory before you'd ever spot it."
- **Slide:** 2×2 grid of the four overlays on the same position.
- **Demo:** [SCREENSHOT: the incursion advisor (P44) marking an opponent's
  cut-through corner inside your area — the most dramatic of the four.]
- **Avoid:** calling a piece "dead" — the project deliberately says *unplayable this
  turn*; placeability changes as the board fills.

---

## Step 7 — Wrap-Up

*Sources: BACKLOG.md (P62, P54, P49, P52, P64, P18, P61); FINDINGS.md (F14, F18, F19, F20).*

### Talking Points — recent additions

- "Recently shipped: the Elo ladder became a committed, test-guarded artifact — the
  strength number you see in the difficulty picker is mechanically tied to the match
  evidence it came from (P62, P61). And the game grew a second variant: Blokus Duo,
  two players on a 14×14 board, which forced the whole codebase — and the AI — to
  stop assuming one board (P54)."

### Talking Points — research highlights

- "I benchmarked my bots against Pentobi, a calibrated open-source Blokus engine. My
  best bot sits at roughly level 1–2 of its 9 levels — and one level lower on the
  Duo board (F14, F20). That's sobering after months of beating my *own* previous
  bots, and it's exactly why external benchmarks matter: self-relative progress can
  be a hall of mirrors."
- "My favorite single result: a 600-game controlled experiment showed that sampling
  more candidate moves during each simulation adds 11 points of win rate at high
  budgets — a change of one constant, zero new code (F18). You only find that by
  measuring."

### Talking Points — what's next

- "Next: an in-app arena where you pit bots against each other and watch (P64), and
  bot personas — named rivals with play styles, so instead of 'Medium' you're
  playing *someone* (P18)."

### Slide Content

- Slide 1 — "Recently shipped": Elo artifact in the picker · Duo variant · polish
  (rotate-view animation P49, pinned review transport P52).
- Slide 2 — "What measuring taught me": the Pentobi reality check (F14/F20) + the
  +11-point one-constant win (F18).
- Slide 3 — closing line, full-bleed on the ambient board:

> **"This started as a way to learn something new — and it became a complete,
> tested, *researched* AI system, built by describing what I wanted in plain
> English. The tool that made it possible is one you could open tomorrow."**

### Demo / Visual Moment

- [SCREENSHOT: the Duo board (14×14, black & white pieces, interior start cells)
  next to the Classic 20×20 board — instantly communicates "second variant."]
- [SCREENSHOT: the emoji-grid share output from a real finished game — the
  Wordle-style 🟦🟨🟥🟩/⬜ grid from "Copy result" (`emojiBoard`, P26). Capture by
  finishing any vs-AI game and pressing Copy result; paste into a monospace text
  box on the slide. A crowd-pleaser to exit on.]

### Avoid

- Don't end on the roadmap — end on the takeaway. The roadmap is one breath; the
  closing sentence is the slide.
