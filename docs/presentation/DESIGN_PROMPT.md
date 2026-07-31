# Prompt for Claude Design

Design a slide deck from the attached `DRAFT.md`. It is a fully worked-out
presentation plan for a ~30-minute talk about OpenBlokus — a browser Blokus clone
with a researched MCTS game AI, built entirely by vibe coding with Claude Code.
Attached alongside it: 19 pre-captured screenshots (PNG) and 2 text captures (TXT).

## Audience & register

Technical non-developers: SQL / basic Python / data-workflow people. Zero Blokus
knowledge, zero game-dev knowledge, curious about AI. Friendly-expert tone —
confident, concrete, never salesy.

## How to read DRAFT.md (it is the source of truth)

- The `## Meta` section gives target slide counts per step (~21 slides total).
  Keep the seven-step structure and ordering exactly; do not add, merge, or
  renumber content sections.
- Per step: **Talking Points** → speaker notes (keep close to verbatim; they are
  written to be said aloud). **Slide Content** → what goes on the slide.
  **Demo / Visual Moment** → the asset or diagram for that slide. **Avoid** →
  a per-slide guardrail; treat each as a hard constraint.
- **Every number in the draft is a measured result** (win rates, Elo ratings,
  point swings, dates). Reproduce them exactly as written — never round, restate,
  or invent statistics. If a stat feels awkward on a slide, shrink it, don't
  change it.
- Slides marked as live-demo moments (notably 6.1, carried-piece placement) get a
  minimal placeholder slide — a title and one line — not a mocked screenshot.

## Asset map (filenames → slides)

Every `[SCREENSHOT: …]` label in the draft has a pre-captured file:

| File | Slide |
|---|---|
| 01-home-ambient.png | Step 1 title background; reuse full-bleed for the Step 7 closing slide |
| 02-piece-tray.png | Step 1 ("your entire hand for the whole game") |
| 03a-ghost-legal.png / 03b-ghost-illegal.png | Step 2 rules panel (side by side) |
| 11-schema-test-failure.txt | Step 4 ("the paperwork has a linter") — render as terminal output |
| hist-01-flat-board.png | Step 5 baseline; also the "before" half of 6.2 |
| hist-02-old-lobby.png | optional before/after with 01-home-ambient wherever the evolution story lands (Step 5 or opening Step 6) |
| 04-board-closeup-finish.png | Step 6.2 "after" (the money shot — give it room) |
| 05a/b/c-theme-\*.png + 05d-settings-panel.png | Step 6.4 (three vertical strips of the same board) |
| 06-difficulty-picker-elo.png | Step 6.6 |
| 07-review-scrub.png | Step 6.7 (annotate the mobility cliff per the draft) |
| 08a–08d-\*.png | Step 6.8, 2×2 grid |
| 09a-duo-board.png / 09b-classic-board.png | Step 7 (side by side) |
| 10-emoji-share.txt | Step 7 exit slide — render monospace on a card, keep the emoji glyphs intact |

Screenshots were captured at 2× DPI — crop freely, never upscale.

## Diagrams to draw (the four `[DIAGRAM]` items — no captures exist)

1. **MCTS cycle** (Step 6.5): select → expand → rollout → backpropagate around a
   small game tree, one branch visibly thickening with visits.
2. **Corner "doorway" fan** (Step 6.5): a Blokus corner marked as a doorway with a
   fan of simulated futures radiating from it.
3. **Document map** (Step 4): five boxes (GAME_SPEC · ARCHITECTURE · BUILD_ORDER ·
   product BACKLOG · research/) with tests drawn as the enforcers holding pairs
   together.
4. **Corner-touch zoom** (Step 2): ~6×6 grid, two same-color pieces touching at one
   circled corner, plus a red "not allowed" edge-touch variant.

## Visual direction

- Derive the deck's palette and mood from the screenshots themselves — warm,
  tabletop, molded-plastic. Pick **one** of the game's themes as the deck's base
  (Lamplight or Walnut project best) and stay in it; don't mix theme moods.
- Projector legibility beats density: big stats, generous margins, nothing below
  ~24pt equivalent. The draft already limits on-slide text; don't add more.
- Render both `.txt` assets as monospace terminal/card blocks, not as prose.

## Known caveats (so you don't "fix" real things)

- The legal-placement ghost tint is the **player's own color**, not green; only
  illegal is red. The draft is already worded accordingly — don't recolor to a
  green/red convention.
- `hist-01-flat-board.png` includes the old debug panel on the right — that's
  period-accurate "day one" charm. Keep it or crop it deliberately, but don't
  treat it as a capture error.
- `08c-unplayable-shading.png` is the sparsest of the four advisor shots — keep it
  small in the 2×2 grid.

## Deliverable

The slide deck plus per-slide speaker notes lifted from the draft's Talking
Points. Where you must deviate from the draft (layout constraints, asset cropping),
note the deviation in the speaker notes rather than silently changing content.
