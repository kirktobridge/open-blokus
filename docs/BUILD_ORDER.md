# OpenBlokus — Build Order

Phased plan. **Every phase ends in something runnable** (a command produces visible,
testable output) and lists exactly what to verify before moving on. References:
[GAME_SPEC.md](GAME_SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md).

Guiding rule: **the pure rules core (Phases 1–3) is finished and tested before any
boardgame.io or React code.** Bugs are cheapest to find there.

> **Status: all phases shipped ✅.** Phases 0–9 are implemented, committed, and covered
> by 42 unit tests + Playwright e2e (`npm test` runs both). This plan is retained as the
> historical build record.

---

## Phase 0 — Project skeleton ✅

**Goal:** Vite + TS + React app boots; Vitest runs.

- `npm create vite@latest` (React + TS template); add `vitest`, `eslint`, `prettier`.
- `src/shared/constants.ts`: `BOARD_SIZE = 20`, `COLORS`, `GAME_NAME = 'open-blokus'`.
- Placeholder `<App>` renders "OpenBlokus".
- Add scripts: `dev`, `build`, `test`, `serve` (server added in Phase 4).

**Runnable:** `npm run dev` → page says "OpenBlokus". `npm test` → 0 tests, exits clean.

**Verify:** dev server loads with no TS errors; Vitest is wired.

---

## Phase 1 — Pieces & geometry (pure) ✅

**Goal:** all 21 pieces and their orientations exist as data.

- `src/game/types.ts`: `Color`, `PieceId`, `Cell`, `Placement`, etc. (ARCHITECTURE §3).
- `src/game/pieces.ts`: `PIECES` base-cell table (GAME_SPEC §2); D4 orientation
  generator + dedup; `resolveCells(placement)` (transform + translate).
- `src/game/board.ts`: `idx(x,y)`, `xy(i)`, `inBounds`, `orthoNeighbors`,
  `diagNeighbors`.

**Runnable:** `npm test tests/pieces.test.ts`.

**Verify (tests):**
- 21 pieces; counts by size = 1/1/2/5/12; total squares = 89.
- Every piece's base cells are normalized (min x = min y = 0) and connected.
- Orientation counts match GAME_SPEC table (`X5`→1, `I5`→2, `F5`→8, …; totals 6/19/63).
- `resolveCells` round-trips a known case (e.g. `T4` rot1 reflected at (5,5)).

---

## Phase 2 — Placement legality (pure) ✅

**Goal:** the core Blokus rule is correct.

- `src/game/modes.ts`: corners per color (GAME_SPEC §3); `owners` map per mode.
- `src/game/placement.ts`: `isLegalPlacement(G, color, pieceId, cells)` enforcing
  all five §4 rules; `applyPlacement(G, color, pieceId, cells)`.

**Runnable:** `npm test tests/placement.test.ts`.

**Verify (tests = GAME_SPEC §8 cases 1–2):**
- First move legal **only** if it covers the color's corner.
- Non-first move: corner-touch same color = legal; edge-touch same color = illegal;
  edge-touch a *different* color = legal.
- Out-of-bounds / overlap rejected.
- `applyPlacement` paints the right cells and moves the piece remaining→placed.

---

## Phase 3 — Move generation, scoring, stuck (pure) ✅

**Goal:** game-end and scoring are correct, no framework yet.

- `src/game/moves.ts`: `generateLegalMoves(G, color)`, `hasAnyMove(G, color)`.
- `src/game/scoring.ts`: `remaining`, basic + advanced color scores, per-player
  aggregation (ignore shared in 3p), winners with ties.

**Runnable:** `npm test tests/scoring.test.ts` (+ a moves test).

**Verify (tests = GAME_SPEC §8 cases 3–4):**
- `hasAnyMove` false for a fabricated full/blocked board, true for an open one.
- Advanced scoring reproduces the rulebook example exactly: **+20 / −8 / −24 / −20**.
- Basic scoring picks the lowest remaining; ties return co-winners.
- `generateLegalMoves` on an empty board for blue returns only corner-covering
  placements.

---

## Phase 4 — boardgame.io wiring (single-player local) ✅

**Goal:** a playable 4-player game in one browser via the Local master + debug panel.

- `src/bgio/setup.ts`: `setup` + `validateSetupData` (ARCHITECTURE §7).
- `src/bgio/turnOrder.ts`: color-aware turn order (ARCHITECTURE §4).
- `src/bgio/BlokusGame.ts`: assemble `Game<GameState>` — `name`, `setup`, `moves:
  { placePiece }`, `turn` (`minMoves/maxMoves: 1`, custom order, `onEnd`/`onBegin`),
  `endIf`, `disableUndo`.
- `src/client/BlokusClient.ts`: `Client({ game, board, multiplayer: Local(),
  debug: true })`; temporary text board listing active color + legal-move count.

**Runnable:** `npm run dev` → use the boardgame.io **debug panel** to call
`placePiece` and step turns.

**Verify:**
- Turn order cycles `blue→yellow→red→green`; `endIf` fires when all stuck.
- Illegal `placePiece` is rejected (returns `INVALID_MOVE`, state unchanged).
- 2p and 3p `setup` produce correct `owners`; `validateSetupData` rejects
  `mode≠numPlayers`.
- A scripted full game in the debug panel reaches game-over with sane scores.

> Milestone: rules are fully playable headlessly. Everything after is UI/networking.

---

## Phase 5 — Board & piece rendering (read-only) ✅

**Goal:** see a real game state.

- `src/client/board/Board.tsx`, `Cell.tsx`: 20×20 CSS grid colored from `G.board`.
- `src/client/tray/PieceTray.tsx`, `PieceThumb.tsx`: render each color's remaining
  pieces from `PIECES`.
- `src/client/controls/ScorePanel.tsx`: live remaining-square counts.
- Wire as the `board` component (`BoardProps<GameState>`), replacing the text board.

**Runnable:** `npm run dev` → place pieces via debug panel, watch the grid + tray +
scores update.

**Verify:**
- Board cells match `G.board` exactly (spot-check corners and a placed piece).
- Tray greys out placed pieces; counts in `ScorePanel` match `remaining`.
- Renders all of 2p/3p/4p without layout breakage.

---

## Phase 6 — Interactive placement ✅

**Goal:** place pieces by clicking, not via debug panel.

- `src/client/hooks/useSelection.ts`: `selectedPieceId`, `rotation`, `reflected`,
  `hoverCell` (UI-only state, ARCHITECTURE §6).
- `GhostPiece.tsx`: preview at hover anchor; green/red tint via `isLegalPlacement`.
- `Controls.tsx`: rotate ⟳, flip ⇄, **confirm** → `moves.placePiece(...)`.
- Disable input unless `ctx.currentPlayer`'s color is owned by this client's `playerID`.

**Runnable:** `npm run dev` with `Local()` rendering one `<BlokusClient>` per player —
full pass-and-play game, mouse only.

**Verify:**
- Preview legality matches what the engine accepts (no "looked legal, rejected").
- Rotate/flip cycle through all distinct orientations.
- Can play a complete 4p pass-and-play game to game-over; `GameOverModal` shows
  correct winner under both scoring variants.
- Input is locked when it isn't your turn/color.

---

## Phase 7 — Server & networked multiplayer ✅

**Goal:** real multiplayer across browsers/devices.

- `src/server/index.ts`: `Server({ games: [BlokusGame], origins })`; `serve` script.
- Swap client `multiplayer` to `SocketIO({ server })` (env-driven: Local in dev tests,
  SocketIO for networked).
- Pass `matchID`, `playerID`, `credentials` into `<BlokusClient>`.

**Runnable:** `npm run serve` + `npm run dev`; open two browsers, both pass `matchID`
+ distinct `playerID` → synchronized game.

**Verify:**
- Move in browser A appears in browser B in realtime.
- A client with no `playerID` is a spectator (can watch, can't move).
- Server rejects moves with wrong/missing credentials.
- Refreshing a tab restores live state (server is authoritative).

---

## Phase 8 — Lobby / rooms ✅

**Goal:** create and join matches without hand-passed IDs.

- `src/client/hooks/useLobby.ts`: `LobbyClient` wrapper.
- `HomeScreen`, `MatchList`, `CreateMatchForm` (mode 2/3/4 + scoring → `setupData`).
- `<App>` routing: `home → lobby → match`; persist `{playerID, credentials}` per
  `matchID` in `localStorage`.
- Wire `playAgain` from `GameOverModal`; `leaveMatch` on exit.

**Runnable:** `npm run serve` + `npm run dev` → create a match in one browser, see it
listed and join from another, play to completion, "play again".

**Verify:**
- `createMatch` with each mode produces a joinable match; `validateSetupData` blocks
  bad combos with a visible error.
- Join auto-assigns seats; refresh keeps your seat (localStorage).
- Spectators can open a match without taking a seat.
- `playAgain` routes both players into the new match.

---

## Phase 9 — Polish & hardening ✅

**Goal:** ship-quality.

- Storage: switch server to flatfile/DB connector (ARCHITECTURE §7) so matches
  survive restart.
- UX: last-move highlight, "stuck — auto-passed" toast, whose-turn indicator,
  responsive layout, keyboard rotate/flip.
- Production `origins`, env config, build + deploy (see
  [boardgame.io/deployment.md](boardgame.io/deployment.md)).
- A11y pass (color-blind-safe palette / patterns, focus states).

**Runnable:** `npm run build` + served prod bundle against the deployed server.

**Verify:**
- Full networked game survives a server restart mid-match.
- Lighthouse/a11y check passes basics; playable color-blind.
- All Phase 1–3 unit tests still green; add an end-to-end smoke test
  (create → join → play a few moves → assert state).

---

## Dependency summary

```
P0 skeleton
└─ P1 pieces ── P2 placement ── P3 moves/scoring   (pure core, fully tested)
                                   └─ P4 bgio wiring (headless playable)
                                        └─ P5 render ── P6 interaction (local play)
                                             └─ P7 server/socket ── P8 lobby ── P9 polish
```

Phases 1–3 are the foundation and must be green before P4. P5–P6 can develop against
`Local()` with zero server. P7 only swaps the transport. Stop at any phase boundary
and have a working artifact.
