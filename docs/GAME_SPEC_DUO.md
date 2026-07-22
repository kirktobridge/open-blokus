# OpenBlokus — Blokus Duo Specification

Canonical rules for the **Duo** variant, encoded from the official Mattel Blokus Duo
instructions (**FWG43**, ©2017 Mattel). Companion to [GAME_SPEC.md](GAME_SPEC.md),
which specifies the Classic 20×20 game and remains the source of truth for every
rule this document does not override. Anything ambiguous in the printed rules is
resolved here and marked **[RULING]**.

> **This is a delta document.** It states *only* what Duo changes. Pieces, the
> placement rules, adjacency helpers, turn flow, and the scoring formulas are
> **not** restated here — they are identical to Classic and owned by GAME_SPEC.md.
>
> **Precedence.** This file governs wherever it states a Duo value; everything it
> does not state is inherited from GAME_SPEC.md unchanged. A rule restated here
> *without* changing it is a bug in **this** file — delete the restatement, don't
> reconcile the two copies.
>
> **Cross-references.** `GAME_SPEC §N` always means that document; a bare `§N` is a
> section of this one. [tests/spec-linkage.test.ts](../tests/spec-linkage.test.ts)
> fails if either kind points at a section that doesn't exist.

---

## 1. What Duo changes

| | Classic (GAME_SPEC.md) | **Duo (this doc)** |
|---|---|---|
| Board | 20 × 20 (400 cells) | **14 × 14 (196 cells)** |
| Colors in play | `blue`, `yellow`, `red`, `green` | **`black`, `white`** |
| Players | 2–4 humans | **exactly 2** |
| Pieces per color | 21 | 21 (identical set) |
| Pieces total | 84 | **42** |
| Start cells | the four corners | **two interior cells** (§3) |
| Scoring | basic *or* advanced | **advanced only** (§4) |

Everything else — the 21 shapes and their coordinates (GAME_SPEC §2), the five
placement rules and adjacency helpers (GAME_SPEC §4), turn flow / passing / game end
(GAME_SPEC §5) — is **unchanged**.

---

## 2. Coordinate system

Identical in form to GAME_SPEC §1, with `N = 14`:

- A cell is `(x, y)`, `x` = column (0 = left … **13** = right), `y` = row
  (0 = top … **13** = bottom). Top-left = `(0,0)`, bottom-right = `(13,13)`.
- Board index = `y * 14 + x`.

---

## 3. Start cells & first move

Each color is assigned one **start cell**; the first piece that color plays must
cover it. Duo's start cells are **interior**, not corners — this is the variant's
defining structural difference from Classic.

| Color | Index | Position | Cell `(x,y)` |
|-------|-------|----------|--------------|
| `black` | 0 | upper-left of centre  | `(4, 4)` |
| `white` | 1 | lower-right of centre | `(9, 9)` |

**Source.** The FWG43 sheet marks both cells with ringed dots on the p.2 board
diagram, labelled "starting points", and instructs: *"Player 1 places one of their
pieces on one of the two starting points. Player 2 places one of their pieces on
the second starting point."*

**Symmetry check.** On the 14 × 14 grid (indices 0–13) the pair satisfies
`4 + 9 = 13` on both axes — exactly 180°-rotationally symmetric about the board
centre `(6.5, 6.5)`. The position is mirror-fair, and any proposed pair that fails
this check is wrong.

> **[NOTE — coordinate convention]** Retail Duo literature commonly gives these
> cells as `5,10` and `10,5`, which is **1-indexed (column, row-counted-from-bottom)**.
> Converting to this project's convention (0-indexed, `y` from the **top**):
>
> - `col 5 → x = 5 − 1 = 4`; `row 10 → y = 14 − 10 = 4` ⇒ **`(4,4)`**
> - `col 10 → x = 10 − 1 = 9`; `row 5 → y = 14 − 5 = 9` ⇒ **`(9,9)`**
>
> Misreading `5,10` as a top-origin `(x,y)` pair yields `(4,9)` / `(9,4)` — the
> **anti-diagonal**. Both candidate pairs are 180°-symmetric, so the symmetry check
> above does **not** disambiguate them. The FWG43 diagram does: its dots sit
> upper-left and lower-right, which is the main diagonal. Do not "fix" these
> coordinates without re-reading the diagram.

> **[RULING]** A color's first placement must cover *its own* assigned start cell,
> not merely either one. The diagonal-adjacency requirement (GAME_SPEC §4 rule 4)
> is waived for that first move. This is identical in form to Classic — only the
> cell differs.

### 3.1 Placement-rule deltas

GAME_SPEC §4 applies verbatim with two substitutions:

- **Rule 2 (in bounds):** every cell satisfies `0 ≤ x < 14` and `0 ≤ y < 14`.
- **Rule 4 (first move):** "the color's assigned corner cell" reads "the color's
  assigned start cell", per the table above.

---

## 4. Scoring

Duo uses **advanced scoring only** — the system in GAME_SPEC §6.2, formula and bonuses
unchanged. Duo's delta is the *choice*, not the arithmetic: Classic offers basic or
advanced, Duo offers only advanced.

> **[RULING]** The basic / lowest-remaining-wins variant (GAME_SPEC §6.1) does
> **not** apply to Duo and must not be offered for it. FWG43 defines exactly one
> scoring system, and it is the advanced one. Duo therefore ignores any
> `scoring` selection made in the lobby.

Worked example from the sheet (p.4): white placed all 21 with the monomino last
(+20); black was left holding two 3-square pieces and one 4-square piece (−10).
White wins.

---

## 5. Players & turn order

| Player | Color |
|--------|-------|
| P0 | `black` |
| P1 | `white` |

- Only the two Duo color sets are in play. The Classic colors are **absent from the
  game** — not merely unowned. They have no pieces, no start cell, and never take a turn.
- Turn order alternates `P0, P1`.
- Player score = their single color's score (§4). There is no shared color and no
  multi-color ownership, so GAME_SPEC §7.2 and GAME_SPEC §7.3 do not apply.
- Passing and game end follow GAME_SPEC §5 unchanged: a player who cannot place any
  remaining piece passes, and the game ends when both players are blocked. The sheet
  states this directly: *"When a player is unable to place one of their remaining
  pieces on the board, that player must pass."*

> **[RULING — not fixed by the sheet]** FWG43 says only *"Decide who will start
> first"* and never fixes a color. This spec pins the first move to **black** so the
> engine has a deterministic turn order. If first-player choice is later exposed as
> a lobby option, this ruling is what it overrides.

---

## 6. Worked validation cases (for tests)

| # | Setup | Placement | Legal? | Why |
|---|-------|-----------|--------|-----|
| D1 | empty board | `black` plays `I1` at `(0,0)` | **No** | first move must cover black's start cell `(4,4)`; a board corner is not a start cell in Duo |
| D2 | empty board | `black` plays `I1` at `(4,4)` | **Yes** | covers black's assigned start cell |
| D3 | empty board | `white` plays `I1` at `(4,4)` | **No** | `(4,4)` is black's start cell; white must cover `(9,9)` |
| D4 | any | any placement with a cell at `x = 14` or `y = 14` | **No** | out of bounds — Duo indices are `0..13` (§3.1) |
| D5 | — | the start-cell pair | — | invariant: `black.x + white.x == 13` and `black.y + white.y == 13` (180° symmetry, §3) |

D5 is an invariant test, not a placement case — it guards the coordinate convention
against the anti-diagonal misreading described in §3.

---

## 7. Open questions

- **First-player choice** — pinned to black above; not fixed by the sheet.
- **Piece colors** — `black` / `white` are the official FWG43 colors. Rendering them
  is a known problem for the tile finish system, whose highlight/shadow amplitudes
  (`--tile-hi`, `--tile-lo`, `--tile-ao`, `--tile-shadow`, `--tile-dye`) are tuned
  against saturated mid-tones and clip at both ends of the value range. That is an
  appearance concern, not a rules concern, and is tracked in the product backlog.
