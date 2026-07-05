# Handoff: The Study Table — OpenBlokus game-screen redesign

## Overview
A full visual + interaction redesign of the OpenBlokus game screen (the vs-AI table: 1 human vs
3 bots). Concept: **the match is a physical study table.** The board is a walnut-framed, recessed
*object* at dead-center — the only element with real depth — and everything else is *paper on the
table* (ivory cards with contact shadows). It reorganizes today's screen into three columns:

- **Left** — the four players as stacked cards, in turn order, each showing its full piece
  inventory as always-visible micro-silhouettes.
- **Center** — the framed board, a status line, and a single **action dock**.
- **Right** — **your** hand, grouped by piece size, plus a compact standings strip.

**Front-end only.** The engine (`src/game/*`), boardgame.io wiring, the keymap, and the two-phase
(stage → submit) placement flow all stay exactly as they are. This is a re-skin + re-layout of the
existing client components, not a logic change.

## Target codebase — this repo
`github.com/kirktobridge/open-blokus` · React 18 + TypeScript + Vite + **boardgame.io**. Styling is
inline `style={{…}}` objects that reference **CSS custom properties**; theme switches by toggling
`[data-theme]` on `<html>` with **no re-render** (`src/client/theme.css`). Piece colors come from a
reactive palette store (`usePaletteColors()`), so custom palettes must keep working.

### File map — what each design piece becomes
| Design component | Real file(s) to edit / add | Notes |
|---|---|---|
| **TopBar** (wordmark · `LOCAL GAME` chip · Theme/Colors/Help/Leave) | `src/client/ai/LocalAIGame.tsx` (the `vs AI · … · difficulty` bar) + move the triggers currently floated in `src/client/App.tsx` (`ThemeToggle`, `PalettePicker`, `ControlsHelp`) into it | "Leave table" = existing `onLeave`. Today Theme/Colors/Help are fixed-position buttons bottom-left; the redesign docks them top-right. |
| **Screen layout** (3 columns) | `src/client/BlokusBoardView.tsx` | The biggest change. Currently: left = `<h2>` + status `<p>` + rotate-board button + `<Board>` + `<Controls>`; right = `<ScorePanel>` + four `<PieceTray>`. Re-lay-out into Players / Board+Dock / Hand+Standings. |
| **PlayerCard ×4** (tile, name, difficulty, state tag, count, micro-inventory) | **new** `src/client/controls/PlayerCard.tsx` | Consolidates today's `ScorePanel` table + the three opponent `PieceTray`s. |
| **BoardFrame + mat** | wrap `<Board>` in `BlokusBoardView.tsx` | New walnut frame + recessed mat *around* the existing board; the board grid itself is unchanged. |
| **BoardGrid / cells / preview** | `src/client/board/Board.tsx`, `src/client/board/Cell.tsx` | Keep all preview/hover/staged logic. Only swap neutral tokens to the warm theme set and bump cell size (below). |
| **PieceFinish (skeuomorphic)** | `src/client/board/PlacedLayer.tsx` — **already implemented** | ⚠️ Do **not** rebuild this. The design's "finish" *is* this file (volume gradient, contact shadow, per-piece bevel, specular gloss, grain). Only change: point the last-move ring at `--brass` instead of `--last-move-ring`. |
| **ActionDock** | `src/client/controls/Controls.tsx` + `src/client/controls/keymap.ts` | Restyle the four buttons into the dock (spec below). Keycaps read from `BINDINGS`/`describeKeys`. |
| **HandTray** (your hand, grouped) | `src/client/tray/PieceTray.tsx`, `src/client/tray/PieceThumb.tsx` | Restyle: group by size, 13px cells, selected = well+ring, placed = dashed ghost. |
| **Opponent micro-inventory (2c)** | reuse a 5px `PieceThumb` variant inside `PlayerCard` | Same render as the tray, smaller, non-interactive. |
| **StatusLine** | the status `<p role="status">` in `BlokusBoardView.tsx` + the status text in `Controls.tsx` | Merge into one always-actionable sentence above the dock. |
| **Standings** | `src/client/controls/ScorePanel.tsx` | Chips sorted ascending by squares-left, leader ringed in `--brass`. |
| **GameOverCard** | `src/client/controls/GameOverModal.tsx` | Restyle; add `WINNER` tag. |
| **Theme tokens** | `src/client/theme.css` (`:root` + `[data-theme='dark']`), `src/client/theme.ts` (`CELL_PX`) | Add the warm surface tokens to both schemes (below). `ThemeToggle.tsx` already flips `[data-theme]`. |

## About the design files
The bundled `*.dc.html` files are **design references authored in HTML** — high-fidelity prototypes
of look and behavior, driven by a small preview runtime (`support.js`, `{{ }}` holes, `<sc-for>`).
They are **not** production code to paste. Recreate them in the React components above using the
real engine API. `blokus-core.js` is a stand-in mirror of `src/game/*` used only to render the
prototype — **use your actual `src/game` modules**, not this file. (Its `buildFinishElement()` is a
1:1 re-expression of your `PlacedLayer.tsx`, kept only so the HTML could draw the finish.)

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, shadows, and states are final; recreate pixel-close.
Two notes:
- The prototype hardcodes one mid-game position for realistic art; **in the app every value is
  derived live from `G`** — see **Data bindings**.
- The **action dock order is intentional** (edited by hand): in-hand slot → **PLAY MOVE** →
  ⟲ ⟳ ⇄ → Cancel, with each tool's keycap sitting *inside* its tile. Build it in that order.

---

## Component specs

Piece colors are **not** hardcoded — read them from `usePaletteColors()` (`colors[color]`). The
prototype's hexes (`blue #3468cf · yellow #d99c22 · red #c9463c · green #438f5b`) are a slightly
warmer take on the Classic palette (`theme.ts` COLOR_HEX = `#2563eb / #eab308 / #dc2626 / #16a34a`);
keep the app's palette, or update Classic if you want the warmer set. Dark theme brightens blue to
~`#4a7fe8` for contrast.

### TopBar
- Wordmark **OpenBlokus** — Nunito 900, 25px, `--top-ink`.
- Match chip — IBM Plex Mono, 14px, uppercase, `letter-spacing:.09em`, `--top-mut`, `1px solid
  --top-bd`, pill, `padding:5px 12px`. Copy: `LOCAL GAME`.
- Spacer, then utility chips **Theme · Colors · Help · Leave table** — Nunito 500, 12.5px, pill,
  `1px solid --top-bd`, `background:--top-bg`, `padding:6px 13px`; "Leave table" at 85% opacity.
  Wire to `ThemeToggle` / `PalettePicker` / `ControlsHelp` / `onLeave`.

### PlayerCard (×4, turn order)
Card: `--pnl` bg, `1px solid --pnl-bd`, `border-radius:12px`, `padding:12px 14px`, rest shadow
`0 5px 14px rgba(20,12,4,.24)`. **Active** player adds a 2px blue keyline:
`box-shadow: 0 0 0 2px #3468cf, 0 12px 24px rgba(20,12,4,.38)`.

Row 1 (`flex; align-items:center; gap:9px`):
- **Color tile** 20×20, `border-radius:5px`, fill = `colors[color]`, bevel
  `inset 0 2px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.28), 0 1px 2px rgba(0,0,0,.3)`.
- **Name** — Nunito 600, 14px. Human: `Blue · You`. Bots append difficulty in a lighter weight,
  color `#5B4C39`: `Yellow · easy`, `Red · hard`, `Green · medium`.
  ⚠️ **Per-bot difficulty is a new capability** — `LocalAIGame` currently takes a *single*
  `difficulty` for all bots. To label bots individually you'll need per-seat difficulty (thread it
  through `LocalAIGame` → `useBotRunner`/bot construction). If you keep one difficulty, show the same
  label on each bot.
- Spacer, then **state tag** (IBM Plex Mono, 9px, `.12em`, pill `padding:3px 8px`):

| State | Style | Content | Source |
|---|---|---|---|
| Active | solid `#3468cf`, white | `YOUR TURN` | `COLOR_ORDER[G.activeColorIndex]` & `canPlay` |
| On deck | `1px solid --pnl-bd`, `--mut` | `NEXT` | next non-stuck color in order |
| Has moved | outline, `--mut`, + 4px glyph | `PLAYED` + silhouette | `G.colors[c].lastPlaced` |
| No moves | outline, `--mut` | `NO MOVES` | `G.colors[c].stuck` |
| Winner | solid `--brass`, white | `WINNER` | `determineWinners(G)` on `ctx.gameover` |

Row 2 (`flex; align-items:baseline; gap:7px; margin-top:9px`): `{remainingSquares(G.colors[c])}` in
IBM Plex Mono **900, 22px**, then `squares left · {G.colors[c].remaining.length} pieces` in 11.5px
`--mut`.

Row 3 — **inventory** (`margin-top:9px`). Default = **micro-silhouettes (2c)**: `flex-wrap` row,
`gap:5px`, all 21 pieces at **5px/cell** in `colors[color]`; available = solid (`1px solid
rgba(0,0,0,.32)` cell border), **placed** = 75% opacity + `1px dashed #c8b997`, no fill. Membership
from `new Set(G.colors[c].remaining)`. Provide a toggle to a compact **21-dot** mode (6px rounded
dots, available ~0.95 / placed ~0.18) — in the prototype this is the `inventoryDisplay` prop.

### BoardFrame + mat (wraps the existing `<Board>`)
- **Frame:** `linear-gradient(160deg, --frame-a, --frame-b)`, `border-radius:16px; padding:19px`,
  `box-shadow: inset 0 1px 0 --frame-hi, inset 0 -1px 0 rgba(0,0,0,.4), 0 24px 48px rgba(15,9,3,.42)`.
- **Mat:** inside the frame — `background:--mat; border-radius:7px; padding:13px; box-shadow: inset 0
  2px 9px rgba(0,0,0,.26)`. The `<Board>` grid sits in the mat.
- **Board sizing:** today `CELL_PX = 24` (480px). The design reads at ~600px — bump `CELL_PX` toward
  30 in `theme.ts` (thumbnails use the separate `THUMB_PX`, unaffected). Cell/grid lines use `--grid`.
- Keep **board auto-rotation** (`TURNS_TO_BOTTOM_RIGHT` in `BlokusBoardView`, animated) and the
  start-corner marker (`Cell` `startHint`).
- **Finish + overlays** already come from `PlacedLayer` (see file map). Change only the last-move
  ring to `--brass`. Hover/staged ghost is `Cell` preview state (legal → `colors[activeColor]` @
  .55/.85; illegal → red) — keep as-is.

### StatusLine
Below the board, 13px `--top-mut`, always naming the next action. Prototype copy:
`{pieceId}` (mono, `--top-ink`) `in hand — hover to preview · click to stage · scroll rotates ·
right-click flips`. This is where scroll-rotate / right-click-flip get advertised (both already wired
in `Board.tsx`).

### ActionDock (order is intentional)
One row: `flex; align-items:center; gap:14px; --pnl` bg, `1px solid --pnl-bd`, `border-radius:16px;
padding:11px 16px; box-shadow:0 16px 32px rgba(15,9,3,.38)`. Left→right:
1. **In-hand slot** — 56×56 recessed well (`--well`, inset shadow, `border-radius:10px`) with a
   10px/cell preview of `PIECES[selectedPieceId]`.
2. **Label block** — `IN HAND` (mono 9.5px `--mut`) over `{pieceId} · {n} sq` (600, 14.5px).
3. Divider (1px × 46px, `--pnl-bd`).
4. **Primary — `PLAY MOVE`** — solid `#3468cf`, white, 600/15px, `border-radius:12px; padding:12px
   22px`, `+ Enter` keycap; **pulses** while a move is staged (see ob-pulse). → `onSubmit`
   (`submitMove`), enabled when `canSubmit` (`staged && legal`). Disabled = `--well` bg, `#a5987f`.
5. Divider.
6. **Tool tiles** ⟲ ⟳ ⇄ — each 48×40, `--well`, `1px solid --pnl-bd`, `border-radius:10px`, glyph
   ~17px with its **keycap badge inside** (mono, on `--ink`): ⟲ `A` → `sel.rotate(-1)`; ⟳ `D` →
   `sel.rotate(1)`; ⇄ `F` → `sel.flip()`. (Matches `BINDINGS`: rotateCCW `a`, rotateCW `d`, flip `f`.)
7. Divider.
8. **Cancel** — `CANCEL` + `Esc` keycap → `onClear` / `sel.reset` (or `unstage` when staged).

### HandTray (your hand only)
Panel: `width:300px; --pnl` bg, `1px solid --pnl-bd; border-radius:14px; padding:15px 16px;
box-shadow:0 14px 28px rgba(15,9,3,.32)`.
- Header: 18px color tile + `Your hand` (Nunito 600/15px) + spacer + `{n} pcs · {n} sq` (mono 10.5px).
- **Three groups**, each a mono label (9.5px, `.15em`, `#685F4F`, 900) over a `flex-wrap; gap:7px`
  row at **13px/cell**: `PENTOMINOES — 5 SQ` (12), `TETROMINOES — 4 SQ` (5),
  `TRIOMINOES · DOMINO · MONO` (≤3, 4). Group by `pieceSize(id)`.
- Piece states: available = filled `colors.blue` + bevel; **placed** = `1.5px dashed #c8b997`, ~0.8
  opacity; **selected** (`sel.pieceId`) = recessed `--well` + `0 0 0 2px #3468cf` ring. Click →
  `sel.selectPiece(id)` (only when active & not placed).

### Standings
Divider, mono label `REMAINING SQUARES` (9.5px, `.15em`, 900). A `flex; gap:7px` row of chips, one
per color, **sorted ascending by `remainingSquares(G.colors[c])`**. Chip: `--well` bg,
`border-radius:8px; padding:6px 9px`, 11px color swatch + number (mono 12.5px/600). **Leader** ringed
`1px solid --brass` (toggleable).

---

## Interactions & behavior (all already wired — see `BlokusBoardView.tsx` / `useSelection.ts`)
- **Two-phase placement.** Select piece → hover shows ghost → **click stages** (`sel.stage`) →
  `PLAY MOVE` pulses → **Enter**/click commits (`moves.placePiece`). Irreversible in Blokus, so the
  confirm beat is intentional.
- **Keymap (verbatim, `keymap.ts`):** `A` rotate CCW · `D`/`R` rotate CW · `W`/`S`/`F` flip · arrows
  nudge · `Space` stage · `Enter` submit · `Esc` cancel. **Scroll** rotates, **right-click** flips
  (`Board.tsx`). Surface as keycaps via `describeKeys(action)`.
- **`ob-pulse`** on the primary while staged: 1.8s ease-out infinite expanding/fading outline —
  `0%{outline:2px solid rgba(52,104,207,.5); outline-offset:2px} 70%,100%{outline-color:transparent;
  outline-offset:9px}`.
- **Illegal feedback.** `Cell` already renders illegal cells red @ .55/.85 via `isLegalPlacement`.
  The design adds a **reason toast** naming the broken §4 rule (`needs corner contact` · `shares an
  edge with Blue — same color touches corners only` · `overlaps` · `off board`). Illegal toast:
  `#f6e3dc` bg / `#dfab9d` border / `#7c2d24`. Staged toast: `#e9efdd` / `#bcca9e` / `#3c5222`.
- **Opponents are read-only** — counts + micro-inventory; only the active color's tray is interactive.

## Data bindings (real symbols)
- Active color: `COLOR_ORDER[G.activeColorIndex]` · can play: `isActive !== false && !ctx.gameover`.
- Squares left: `remainingSquares(G.colors[c])` (`game/scoring`). Piece count: `remaining.length`.
- Inventory / placed: `new Set(G.colors[c].remaining)` (PieceId[]); placed = not in set.
  `lastPlaced` glyph: `G.colors[c].lastPlaced`. Stuck → NO MOVES: `G.colors[c].stuck`.
- Piece geometry: `PIECES[pieceId]` (`game/pieces`). Colors: `usePaletteColors()`.
- Ghost/legality: `resolveCells({pieceId, rotation, reflected, x, y})` +
  `isLegalPlacement(G, activeColor, pieceId, cells)`; selection via `useSelection()`.
- Last-move ring: `G.lastMove` (indices) — drawn by `PlacedLayer`.
- Commit: `moves.placePiece({ pieceId, rotation, reflected, x, y })`.
- Winner: `ctx.gameover` payload → `GameOverModal` / `determineWinners(G)`.
- Difficulty label: the `difficulty` prop in `LocalAIGame` (single value today — see per-bot note).

## Design tokens

### Theme sets → `theme.css`
Add these warm surface tokens alongside the existing neutrals. Recommended mapping:
**`:root` (light) = Linen**, **`[data-theme='dark']` = Lamplight**; **Walnut** is the hero shown in
the prototype — ship it as an optional third scheme (`[data-theme='walnut']`) or your default.

**Walnut (hero / prototype):**
```
--frame-a:#6d5138; --frame-b:#452f1d; --frame-hi:rgba(255,255,255,.28);
--mat:#efe6d1; --grid:#d3c5a7;
--pnl:#f6efdf; --pnl-bd:#dbcdb2; --well:#eadfc8;
--ink:#2c251c; --mut:#8b7e69;
--top-ink:#efe6d4; --top-mut:#bfb29b; --top-bd:rgba(239,230,212,.28); --top-bg:rgba(239,230,212,.08);
--brass:#c29a58;
table-bg: radial-gradient(1150px 780px at 50% 40%, #584a3c, #493e33 55%, #372f27);
```
**Linen (light):**
```
--frame-a:#b38e63; --frame-b:#8a6845; --frame-hi:rgba(255,255,255,.45);
--mat:#fbf7ec; --grid:#ddd3bb;
--pnl:#fffdf6; --pnl-bd:#e4dac4; --well:#f1e9d5;
--ink:#332c21; --mut:#95886e;
--top-ink:#3a3225; --top-mut:#8d8069; --top-bd:rgba(58,50,37,.22); --top-bg:rgba(58,50,37,.05);
--brass:#a8834b;
table-bg: radial-gradient(1150px 780px at 50% 40%, #f0e9db, #e6dcca 55%, #d5c8b0);
```
**Lamplight (dark):**
```
--frame-a:#4a3826; --frame-b:#2b2013; --frame-hi:rgba(255,255,255,.16);
--mat:#211d17; --grid:#3a3327;
--pnl:#2c261e; --pnl-bd:#41392c; --well:#221d16;
--ink:#ece3d0; --mut:#a1947c;
--top-ink:#e8ddc6; --top-mut:#998c74; --top-bd:rgba(232,221,198,.22); --top-bg:rgba(232,221,198,.06);
--brass:#c9a05e;
table-bg: radial-gradient(1150px 780px at 50% 40%, #332a20, #262019 55%, #191512);
blue override: #4a7fe8;
```
Placed-ghost dash `#c8b997` · bot difficulty label `#5B4C39` · hand group label `#685F4F`.

### Typography
- **Nunito** — UI/display (wordmark & big numbers 900; section/group labels 900 uppercase; names
  600; utilities 500). App is `system-ui` today — add the font (Google Fonts `<link>` in
  `index.html`, or a CSS `@import`).
- **IBM Plex Mono** — state tags, keycaps, in-hand & standings counts, small letterspaced labels.
- Sizes: wordmark 25 · match chip 14 · nav chip 12.5 · section label 10 (`.16em`) · player name 14 ·
  state tag 9 (`.12em`) · big count 22 · sub-count 11.5 · status 13 · in-hand title 14.5 · standings
  number 12.5. Cells: board `CELL_PX≈30` · hand 13 · opponent micro 5 · dot 6 · played glyph 4.

### Radii · spacing · shadow
- Radii: pill 999 · panel 12 · hand panel 14 · board frame 16 · mat 7 · dock 16 · tool tile 10 ·
  well 10 · swatch 5 · keycap 4.
- Column gap 22 · card gap 10 · body padding `8px 26px 24px` · card padding `12px 14px`.
- Shadows: card rest `0 5px 14px rgba(20,12,4,.24)` · card active
  `0 0 0 2px #3468cf, 0 12px 24px rgba(20,12,4,.38)` · dock `0 16px 32px rgba(15,9,3,.38)` · board
  frame `inset 0 1px 0 --frame-hi, 0 24px 48px rgba(15,9,3,.42)` · beveled tile `inset 0 2px 0
  rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.28), 0 1px 2px rgba(0,0,0,.3)`.

## Assets
- **Fonts:** Google Fonts **Nunito** (400/500/600/700/900) + **IBM Plex Mono** (400/500/600).
- **Piece geometry:** `src/game/pieces.ts` (existing). No image assets; glyphs are Unicode `⟲ ⟳ ⇄`.
- **Finish:** `src/client/board/PlacedLayer.tsx` (existing) — reuse, don't rebuild.

## Files in this bundle
- `OpenBlokus - Build.dc.html` — **primary** redesigned game screen (Walnut, 2c inventories, upheld dock).
- `Redesign Directions.dc.html` — theme finishes (`1a` Walnut / `1b` Linen / `1c` Lamplight) +
  inventory studies (`2a`/`2b`/**`2c` chosen**) + the written brief.
- `Current UI (Recreation).dc.html` — today's screen, for before/after.
- `blokus-core.js` — prototype-only engine mirror (reference; use real `src/game/*` instead).
- `support.js` — prototype runtime (needed only to open the HTML; do not ship).

## Wiring it in with Claude Code
1. Drop this folder into the repo; point Claude Code at `README.md`.
2. Add the warm tokens to `theme.css`; bump `CELL_PX`; add the two fonts. (Cheap, global, low-risk —
   do this first so everything reskins at once.)
3. Re-layout `BlokusBoardView.tsx` into the three columns; add `PlayerCard.tsx`.
4. Restyle `Controls.tsx` → ActionDock (upheld order), `PieceTray/PieceThumb` → grouped HandTray +
   5px opponent inventories, `ScorePanel` → Standings chips, `GameOverModal` → GameOverCard.
5. Wrap `<Board>` in the walnut frame + mat; switch the last-move ring to `--brass`. Leave
   `PlacedLayer`, `Cell` preview logic, keymap, and `useSelection` intact.
6. Move `ThemeToggle`/`PalettePicker`/`ControlsHelp` triggers into the TopBar.
7. Keep piece fills bound to `usePaletteColors()`. Optional: per-bot difficulty; reason-toasts.
