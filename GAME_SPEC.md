# OpenBlokus — Game Specification

Canonical rules for the OpenBlokus clone, encoded from the official Mattel Blokus
instructions (BJV44, ©2013 Mattel). This document is the single source of truth for
game logic. Anything ambiguous in the printed rules is resolved here and marked
**[RULING]**.

---

## 1. Overview

- **Board:** 20 × 20 grid (400 cells).
- **Players:** 2–4.
- **Pieces:** 84 total = 21 polyomino pieces per color, in 4 colors.
- **Colors (canonical order):** `blue`, `yellow`, `red`, `green`.
- **Object:** place as many of your squares on the board as possible. Lowest squares
  remaining wins (basic) or highest computed score wins (advanced).

### Coordinate system

- A cell is `(x, y)` where `x` is the **column** (0 = left … 19 = right) and `y` is
  the **row** (0 = top … 19 = bottom).
- Top-left = `(0, 0)`. Bottom-right = `(19, 19)`.
- Piece shapes are defined as a set of cells **normalized** so the minimum `x` and
  minimum `y` are both `0`.
- A *placement* applies a transform (rotation + optional reflection) to a piece's
  base cells, then translates them onto the board.

---

## 2. The 21 pieces (per color)

Each color owns exactly one copy of every piece below. Square totals:

| Size (squares) | Count | Pieces |
|----------------|-------|--------|
| 1 | 1  | `I1` |
| 2 | 1  | `I2` |
| 3 | 2  | `I3`, `V3` |
| 4 | 5  | `I4`, `O4`, `T4`, `L4`, `S4` |
| 5 | 12 | `F5`, `I5`, `L5`, `N5`, `P5`, `T5`, `U5`, `V5`, `W5`, `X5`, `Y5`, `Z5` |

**Total: 21 pieces, 89 squares per color.** (`1 + 2 + 6 + 20 + 60 = 89`.)

Pieces may be freely **rotated** (90° steps) and **reflected** (flipped). The
"Orient." column is the number of distinct fixed orientations (reference / move-gen
sanity check; the totals are 6 trominoes, 19 tetrominoes, 63 pentominoes).

### 2.1 Monomino (1)

| ID | Squares | Base cells | Orient. | Shape |
|----|---------|-----------|---------|-------|
| `I1` | 1 | `(0,0)` | 1 | `X` |

### 2.2 Domino (2)

| ID | Squares | Base cells | Orient. | Shape |
|----|---------|-----------|---------|-------|
| `I2` | 2 | `(0,0) (1,0)` | 2 | `XX` |

### 2.3 Trominoes (3)

| ID | Squares | Base cells | Orient. | Shape |
|----|---------|-----------|---------|-------|
| `I3` | 3 | `(0,0) (1,0) (2,0)` | 2 | `XXX` |
| `V3` | 3 | `(0,0) (0,1) (1,1)` | 4 | `X·` / `XX` |

```
I3:  XXX

V3:  X·
     XX
```

### 2.4 Tetrominoes (4)

| ID | Squares | Base cells | Orient. | Shape |
|----|---------|-----------|---------|-------|
| `I4` | 4 | `(0,0) (1,0) (2,0) (3,0)` | 2 | line of 4 |
| `O4` | 4 | `(0,0) (1,0) (0,1) (1,1)` | 1 | 2×2 square |
| `T4` | 4 | `(0,0) (1,0) (2,0) (1,1)` | 4 | T |
| `L4` | 4 | `(0,0) (0,1) (0,2) (1,2)` | 8 | L |
| `S4` | 4 | `(1,0) (2,0) (0,1) (1,1)` | 4 | S / Z |

```
I4: XXXX     O4: XX     T4: XXX     L4: X·     S4: ·XX
                XX          ·X·         X·         XX·
                                        XX
```

> **[RULING]** Blokus allows reflection, so the standard set has a single skew
> tetromino (`S4`) and a single L tetromino (`L4`); their mirror images (Z / J) are
> reachable by flipping and are **not** separate pieces.

### 2.5 Pentominoes (5)

| ID | Squares | Base cells | Orient. | Shape |
|----|---------|-----------|---------|-------|
| `F5` | 5 | `(1,0) (2,0) (0,1) (1,1) (1,2)` | 8 | F |
| `I5` | 5 | `(0,0) (1,0) (2,0) (3,0) (4,0)` | 2 | line of 5 |
| `L5` | 5 | `(0,0) (0,1) (0,2) (0,3) (1,3)` | 8 | L |
| `N5` | 5 | `(1,0) (0,1) (1,1) (0,2) (0,3)` | 8 | N |
| `P5` | 5 | `(0,0) (1,0) (0,1) (1,1) (0,2)` | 8 | P |
| `T5` | 5 | `(0,0) (1,0) (2,0) (1,1) (1,2)` | 4 | T |
| `U5` | 5 | `(0,0) (2,0) (0,1) (1,1) (2,1)` | 4 | U |
| `V5` | 5 | `(0,0) (0,1) (0,2) (1,2) (2,2)` | 4 | V |
| `W5` | 5 | `(0,0) (0,1) (1,1) (1,2) (2,2)` | 4 | W |
| `X5` | 5 | `(1,0) (0,1) (1,1) (2,1) (1,2)` | 1 | + |
| `Y5` | 5 | `(1,0) (0,1) (1,1) (1,2) (1,3)` | 8 | Y |
| `Z5` | 5 | `(0,0) (1,0) (1,1) (1,2) (2,2)` | 4 | Z |

> **Note:** The gap at (1,0) is intentional — U5 is an open-top rectangle, not a solid 2×3 block.

```
F5: ·XX   I5: XXXXX   L5: X·    N5: ·X    P5: XX    T5: XXX
    XX·                   X·        XX        XX        ·X·
    ·X·                   X·        X·        X·        ·X·
                          XX        X·

U5: X·X   V5: X··   W5: X··   X5: ·X·   Y5: ·X    Z5: XX·
    XXX       X··       XX·       XXX       XX        ·X·
              XXX       ·XX       ·X·       ·X        ·XX
                                            ·X
```

> **Implementation note:** store the base cells exactly as above in a `PIECES`
> table. Generate the distinct orientations at load time by applying the 8 elements
> of the dihedral group D4 (4 rotations × {identity, reflection}) and deduplicating
> normalized cell sets. Cache them keyed by `pieceId`.

---

## 3. Corners & first move

Each color is assigned one board corner. The **first piece** a color plays must
cover that corner cell.

| Color | Index | Corner | Cell `(x,y)` |
|-------|-------|--------|--------------|
| `blue`   | 0 | top-left     | `(0, 0)`   |
| `yellow` | 1 | top-right    | `(19, 0)`  |
| `red`    | 2 | bottom-right | `(19, 19)` |
| `green`  | 3 | bottom-left  | `(0, 19)`  |

Play order `blue → yellow → red → green` traces the corners clockwise
(top-left → top-right → bottom-right → bottom-left), matching the official rules.

> **[RULING]** A color's first placement must *cover its own assigned corner cell*
> (not merely any corner). The corner-adjacency rule (§4) is waived for the first
> move of each color.

---

## 4. Placement rules

A placement of `pieceId` at oriented, translated cells `C` (for the color whose turn
it is) is **legal** iff ALL of the following hold:

1. **Available:** the color still owns `pieceId` (not yet placed).
2. **In bounds:** every cell in `C` satisfies `0 ≤ x ≤ 19` and `0 ≤ y ≤ 19`.
3. **Empty:** every cell in `C` is currently empty on the board.
4. **First-move / corner rule:**
   - If this is the color's **first** placement: `C` must contain the color's
     assigned corner cell (§3).
   - Otherwise: at least one cell in `C` is **diagonally adjacent** (corner-to-corner)
     to an existing cell of the **same color**.
5. **No edge contact:** **no** cell in `C` is **orthogonally adjacent**
   (shares a side: up/down/left/right) to any existing cell of the **same color**.

Rules 4 and 5 together are the core Blokus constraint: *same-color pieces must touch
at corners and may never touch along a side.*

- **Other colors:** there are **no** restrictions on contact between different colors
  (they may share edges and corners freely).
- **Immutable:** once placed, a piece is never moved or removed.

### Adjacency helpers

- **Orthogonal neighbors** of `(x,y)`: `(x±1, y)`, `(x, y±1)`.
- **Diagonal neighbors** of `(x,y)`: `(x±1, y±1)`.

---

## 5. Turn flow, passing, game end

- Turns proceed in color order `blue → yellow → red → green`, repeating.
- On your turn you **must place a piece if any legal placement exists**.
- If a color has **no** legal placement (no remaining piece can be placed anywhere),
  that color is **passed** (skipped) for the rest of the game — it is "stuck."
  - **[RULING]** A pass is automatic and permanent: once a color cannot move, it is
    skipped on all subsequent rounds. (A stuck color cannot become unstuck, because
    the board only ever fills further.)
- The **game ends** when every color is stuck (no color can place any piece).

> The engine determines "stuck" by attempting move generation for the color: for each
> remaining piece, each orientation, each board position, test legality (§4). If none
> is legal, the color is stuck. Stuck flags are recomputed after every placement; the
> engine then advances the turn to the next non-stuck color, so a stuck color is simply
> never given a turn.

---

## 6. Scoring

Let `remaining(color)` = sum of square-counts of that color's **unplaced** pieces.
Let `allPlaced(color)` = the color placed all 21 pieces (`remaining == 0`).
Let `monominoLast(color)` = the color's **last placed** piece was `I1` (the 1-square
piece).

### 6.1 Basic scoring (default)

- Score per color = `remaining(color)`.
- **Lowest** total wins.

### 6.2 Advanced scoring

Per color:

```
score(color) = -remaining(color)
             + (allPlaced(color) ? 15 : 0)
             + (allPlaced(color) && monominoLast(color) ? 5 : 0)
```

- I.e. each unplaced square is **−1**; placing all pieces is **+15**; if the *very
  last* piece you placed was the monomino, an extra **+5** (so a perfect game = +20).
- **Highest** total wins.

> Verified against the rulebook's worked example:
> blue all placed + monomino last = **+20**; yellow missing two 4-square pieces =
> −8; red missing 3+16+5 squares = **−24**; green missing 3+12+5 = **−20**.

### 6.3 Aggregating per player

Final standings combine color scores by player according to mode (§7). Ties are
**[RULING]** shared (co-winners); the engine reports all tied players.

---

## 7. Player modes

`numPlayers` is the number of **humans**. All four color sets are always on the board;
modes differ only in who owns which color and how the shared color rotates.

### 7.1 Four players (standard)

| Player | Colors |
|--------|--------|
| P0 | blue |
| P1 | yellow |
| P2 | red |
| P3 | green |

- Turn order = color order = `blue, yellow, red, green` = `P0, P1, P2, P3`.
- Player score = their single color's score.

### 7.2 Two players

| Player | Colors |
|--------|--------|
| P0 | blue + red |
| P1 | yellow + green |

- Color order `blue, yellow, red, green` ⇒ current player sequence `P0, P1, P0, P1`.
- Player score = sum of **both** controlled colors.

### 7.3 Three players

| Player | Colors |
|--------|--------|
| P0 | blue |
| P1 | yellow |
| P2 | red |
| — | green = **shared** |

- The 4th color (`green`) is shared and played **alternately** by each player in
  turn. Each time green's turn comes up, the next human in rotation `P0 → P1 → P2 →
  P0 …` plays green's move.
- Final scores are computed exactly as the 4-player game; **the shared color's score
  is ignored** (it counts for no one).
- Player score = their single owned color's score.

> **[RULING]** Shared-color rotation advances by one human each time green takes a
> turn (including when green is forced to pass because it is stuck — though once
> stuck, green is skipped entirely per §5, ending its rotation).

---

## 8. Worked validation cases (for tests)

1. **First move legality:** blue's first piece is legal iff it covers `(0,0)` and is
   in bounds; any placement not covering `(0,0)` is illegal.
2. **Corner-only growth:** a second blue piece touching an existing blue piece only at
   a corner is legal; the same piece moved to share an edge with blue is illegal;
   sharing an edge with a *red* piece (different color) is legal.
3. **Stuck detection:** a color with pieces remaining but no legal placement is
   skipped; game ends only when all colors are stuck.
4. **Advanced score:** the four §6.2 example values must reproduce exactly.
5. **Piece integrity:** the 21 base shapes deduplicate (under D4) to 1/2/2/5/12 pieces
   by size and 89 total squares.

---

## 9. boardgame.io Implementation Notes

Mapping of spec concepts to boardgame.io framework primitives:

> **State must be plain JSON.** boardgame.io syncs `G` over the network and persists
> it via storage connectors, so every field must survive `JSON.stringify`. Do **not**
> use `Set` or `Map` in `G` — they serialize to `{}` and silently lose data. Use
> arrays and plain objects.

- `G.board`: `(Color | null)[]` — flat array of 400 cells, index `= y * 20 + x`, `null` = empty
- `G.colors[color].remaining`: `PieceId[]` — unplaced pieces for this color
- `G.colors[color].lastPlaced`: `PieceId | null` — last piece placed, for the monomino bonus check
- `G.colors[color].hasStarted`: `boolean` — whether the color has made its first (corner) move
- `G.colors[color].stuck`: `boolean` — `true` once the color has no legal placement remaining
- `G.sharedRotation`: `number` (`0 | 1 | 2`) — 3-player mode only; index into `[P0, P1, P2]` indicating which human plays green's current turn
- `G.lastMove`: `number[]` — flat board indices of the most recently placed piece (UI highlight only; not a rule input)

**Turn flow:**

- After every `placePiece` move (inside the move): recompute all colors' `stuck` flags, then advance `activeColorIndex` to the next non-stuck color. Auto-skip happens here — in the move — so turn advancement is deterministic and synchronous (an earlier `turn.onBegin` + `events.endTurn()` approach was not reliably synchronous).
- The turn order's `first` / `next` set `currentPlayer` to the active color's owner. Because the move already skipped to a non-stuck color, a turn never lands on a stuck color.
- If every color is stuck, `activeColorIndex` is left unchanged and `endIf` ends the game (`COLOR_ORDER.every((c) => G.colors[c].stuck)`).

**Move validation:**

- `moves.placePiece` returns `INVALID_MOVE` (boardgame.io sentinel) for any failed §4 check — do not mutate `G` on failure
- There is **no** `pass` move. `placePiece` is the only move clients can call; skipping a stuck color is automatic (see *Turn flow* above) — handled by advancing `activeColorIndex` inside the move, with the turn-order `next` then mapping the active color to its owning player.

**3-player shared color:**

- `G.sharedRotation` advances by 1 (mod 3) each time green completes a turn (a placement)
- Once green is stuck (§5), it is skipped entirely and `G.sharedRotation` no longer advances
