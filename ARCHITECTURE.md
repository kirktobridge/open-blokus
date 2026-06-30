# OpenBlokus — Architecture

How the game in [GAME_SPEC.md](GAME_SPEC.md) maps onto a real stack. Covers stack
choices, repo layout, the `G` state type, the moves interface, the boardgame.io turn
model, the component tree, and the room/lobby system.

---

## 1. Stack decisions

| Concern | Choice | Why |
|---------|--------|-----|
| Build/dev | **Vite** + TypeScript | Fast HMR, first-class TS, simple multi-entry (client + server). |
| UI | **React 18** | Required by boardgame.io React client; mature. |
| Game engine | **boardgame.io 0.50.2** | Authoritative move validation, lockstep multiplayer, lobby REST API, undo/log — all free. Pulled docs in [docs/boardgame.io/](docs/boardgame.io/). |
| Transport | boardgame.io **SocketIO** master (remote) + **Local** master (pass-and-play / dev) | One code path; swap `multiplayer` option. |
| Server | boardgame.io **Server** (Koa) | Hosts game master + Lobby REST on one port. |
| Storage | In-memory (default) for MVP; **flatfile** then a DB connector later | Zero-config start; see §7. |
| Board rendering | **CSS Grid / SVG**, plain React | 20×20 = 400 cells; no canvas needed. |
| State (UI-only) | React local state + a small context | Selection/preview is ephemeral, must NOT live in `G`. |
| Tests | **Vitest** | Vite-native; unit-test pure game logic without a browser. |
| Lint/format | ESLint + Prettier | Standard. |

### Key principles

1. **All rules live in pure functions** (`src/game/`), independent of boardgame.io and
   React. boardgame.io moves are thin wrappers that call them. This keeps the spec
   testable in isolation and portable.
2. **Perfect information game** — board and all pieces are public. No `playerView`, no
   secret state, optimistic client updates are always safe.
3. **Color ≠ player.** The engine's `playerID` is a human seat; *colors* are a
   separate concept the game logic owns (see §4, §5). This is the single biggest
   design decision and the source of mode complexity.
4. **Cheat-resistant moves:** clients send `(pieceId, rotation, reflected, x, y)`, and
   the move recomputes the absolute cells from the canonical piece table server-side.
   Clients never send raw cell lists.

---

## 2. Repository layout

```
open-blokus/
├─ GAME_SPEC.md
├─ ARCHITECTURE.md
├─ BUILD_ORDER.md
├─ docs/boardgame.io/            # vendored framework docs (reference)
├─ index.html                    # Vite entry (client)
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ src/
│  ├─ game/                      # PURE game logic (no React, no bgio types leaking in)
│  │  ├─ pieces.ts               # PIECES table (base cells) + orientation generation
│  │  ├─ board.ts                # board helpers: index, neighbors, bounds
│  │  ├─ placement.ts            # isLegalPlacement(), applyPlacement()
│  │  ├─ moves.ts                # generateLegalMoves(), hasAnyMove() (stuck detection)
│  │  ├─ scoring.ts              # basic + advanced scoring, per-player aggregation
│  │  ├─ modes.ts               # mode config: color↔player maps, corners, rotation
│  │  ├─ types.ts                # shared domain types (Color, PieceId, Cell, GameState)
│  │  └─ index.ts
│  ├─ bgio/
│  │  ├─ BlokusGame.ts           # the boardgame.io Game<GameState> object
│  │  ├─ turnOrder.ts            # custom turn order (color-aware)
│  │  └─ setup.ts                # setup() + validateSetupData()
│  ├─ client/
│  │  ├─ App.tsx                 # top-level router: Home → Lobby → Match
│  │  ├─ BlokusClient.ts         # Client({ game, board, multiplayer }) factory
│  │  ├─ board/
│  │  │  ├─ Board.tsx            # 20×20 grid
│  │  │  ├─ Cell.tsx
│  │  │  └─ GhostPiece.tsx       # hover/preview overlay
│  │  ├─ tray/
│  │  │  ├─ PieceTray.tsx        # remaining pieces for each color
│  │  │  └─ PieceThumb.tsx
│  │  ├─ controls/
│  │  │  ├─ Controls.tsx         # rotate / flip / confirm / pass-indicator
│  │  │  └─ ScorePanel.tsx
│  │  ├─ lobby/
│  │  │  ├─ HomeScreen.tsx       # create / join entry
│  │  │  ├─ MatchList.tsx
│  │  │  └─ CreateMatchForm.tsx  # pick mode (2/3/4) + scoring variant
│  │  ├─ hooks/
│  │  │  ├─ useSelection.ts      # selected piece + rotation/flip + hover (UI state)
│  │  │  └─ useLobby.ts          # LobbyClient wrapper
│  │  └─ state/uiContext.tsx
│  ├─ server/
│  │  └─ index.ts                # boardgame.io Server({ games, origins, db })
│  └─ shared/
│     └─ constants.ts            # BOARD_SIZE, COLORS, GAME_NAME
└─ tests/
   ├─ pieces.test.ts
   ├─ placement.test.ts
   ├─ scoring.test.ts
   └─ turnOrder.test.ts
```

`src/game/*` has **no** dependency on `boardgame.io` or `react`. `src/bgio/*` depends
on `src/game/*` and `boardgame.io`. `src/client/*` depends on everything. `src/server`
depends only on `src/bgio`.

---

## 3. The `G` state type

```ts
// src/game/types.ts
export type Color = 'blue' | 'yellow' | 'red' | 'green';
export const COLOR_ORDER: Color[] = ['blue', 'yellow', 'red', 'green'];

export type PieceId =
  | 'I1' | 'I2' | 'I3' | 'V3'
  | 'I4' | 'O4' | 'T4' | 'L4' | 'S4'
  | 'F5' | 'I5' | 'L5' | 'N5' | 'P5' | 'T5'
  | 'U5' | 'V5' | 'W5' | 'X5' | 'Y5' | 'Z5';

export type Cell = { x: number; y: number };

/** A concrete placement request, resolved to absolute cells by the engine. */
export type Placement = {
  pieceId: PieceId;
  rotation: 0 | 1 | 2 | 3;   // number of 90° clockwise rotations
  reflected: boolean;        // mirror before rotating
  x: number;                 // translation of normalized piece origin
  y: number;
};

export type GameMode = 2 | 3 | 4;
export type ScoringVariant = 'basic' | 'advanced';

export interface ColorState {
  /** Pieces not yet placed (the 21 IDs minus placed). */
  remaining: PieceId[];
  /** Last piece placed by this color (for the monomino-last bonus); null until first placement. */
  lastPlaced: PieceId | null;
  /** True once this color has made its first (corner) placement. */
  hasStarted: boolean;
  /** True once this color can no longer make any legal move. */
  stuck: boolean;
}

export interface GameConfig {
  mode: GameMode;
  scoring: ScoringVariant;
  /** color → owning human playerID, or 'shared' for the rotating color (3p). */
  owners: Record<Color, string | 'shared'>;
}

export interface GameState {
  config: GameConfig;

  /** Flat 20×20 board; cell = Color or null. Index = y * 20 + x. */
  board: (Color | null)[];

  /** Per-color piece + status tracking. */
  colors: Record<Color, ColorState>;

  /** Index into COLOR_ORDER of the color whose turn it currently is. */
  activeColorIndex: number;

  /** Whose turn it is to play the shared color next (3p only): index into the
   *  human-player rotation. Advances each time the shared color moves. */
  sharedRotation: number;

  /** Flat board indices of the most recently placed piece (UI highlight only). */
  lastMove: number[];
}
```

Notes:

- `board` is a flat array for cheap immer updates and serialization. Helpers in
  `board.ts` convert `(x,y) ↔ index`.
- The **active color** is `COLOR_ORDER[activeColorIndex]`, derived state kept in `G`
  so the UI and turn order agree without recomputation.
- The current human (`ctx.currentPlayer`) is derived from the active color's owner
  (see §4); for the shared color it is `humanRotationOrder[sharedRotation % numPlayers]`.

---

## 4. boardgame.io turn model (color ↔ player)

The hard part: one human may own two colors (2p) or share one (3p), so
`ctx.currentPlayer` is **not** a simple round-robin. Strategy:

- **One turn = one color's single placement.** Use `turn.minMoves: 1, maxMoves: 1` so
  every turn is exactly one `placePiece`, then auto-ends.
- A **custom turn order** advances through colors and resolves the owning human:

```ts
// src/bgio/turnOrder.ts (sketch)
import type { TurnOrderConfig } from 'boardgame.io';

export const blokusTurnOrder: TurnOrderConfig = {
  // Start at the first non-stuck color's owner.
  first: ({ G }) => ownerSeatIndex(G, G.activeColorIndex),

  // After each turn: advance to the next non-stuck color, update G via onEnd,
  // and return the playOrderPos (human index) for that color.
  next: ({ G, ctx }) => {
    const nextColorIdx = nextLiveColorIndex(G); // skips stuck colors
    if (nextColorIdx === null) return undefined; // no live color → phase/game ends
    return ownerSeatIndex({ ...G, activeColorIndex: nextColorIdx }, nextColorIdx);
  },
};
```

- `ownerSeatIndex(G, colorIdx)` returns the index into `ctx.playOrder` of the human
  who owns that color, consulting `G.config.owners` (and `sharedRotation` for the
  shared color). `playOrder` is the default `['0', …, numPlayers-1]`.
- **Color/rotation bookkeeping happens in `turn.onEnd` / `turn.onBegin`** (where
  mutating `G` is allowed), not inside `next`:
  - `onEnd`: if the color that just played is the shared color, increment
    `G.sharedRotation`; recompute `stuck` flags for any color that now has no moves;
    advance `G.activeColorIndex` to the next live color.
  - `onBegin`: (optional) assertion that `activeColorIndex` is a live color.
- **Stuck colors are skipped** by `nextLiveColorIndex`. No explicit "pass" move is
  needed: the engine never lands a turn on a color that cannot move.
- **Game over** via top-level `endIf`:

```ts
endIf: ({ G }) =>
  COLOR_ORDER.every((c) => G.colors[c].stuck)
    ? { scores: finalScores(G), winners: winnersOf(G) }
    : undefined,
```

`ctx.gameover` then carries scores + winners for the game-over UI.

### Mode → owners mapping (`src/game/modes.ts`)

| Mode | `owners` |
|------|----------|
| 4p | `{ blue:'0', yellow:'1', red:'2', green:'3' }` |
| 2p | `{ blue:'0', yellow:'1', red:'0', green:'1' }` |
| 3p | `{ blue:'0', yellow:'1', red:'2', green:'shared' }` |

Built in `setup()` from `setupData.mode` (§7).

---

## 5. Moves interface

```ts
// src/bgio/BlokusGame.ts (moves section, sketch)
import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { GameState, Placement } from '../game/types';

interface Moves {
  placePiece: (placement: Placement) => void;
}

const placePiece: Move<GameState> = ({ G, ctx, playerID }, placement: Placement) => {
  const color = COLOR_ORDER[G.activeColorIndex];

  // 1. Authorization: the sender must own the active color this turn.
  if (playerID !== ownerHumanId(G, color, ctx)) return INVALID_MOVE;

  // 2. Resolve absolute cells from the canonical piece table (anti-cheat).
  const cells = resolveCells(placement); // pieces.ts + transform

  // 3. Validate against all spec §4 rules (pure function).
  if (!isLegalPlacement(G, color, placement.pieceId, cells)) return INVALID_MOVE;

  // 4. Apply (mutates draft G via immer).
  applyPlacement(G, color, placement.pieceId, cells);
  // applyPlacement: paint board cells, remove pieceId from remaining,
  // set lastPlaced = pieceId and hasStarted = true.
};
```

- **Only one move:** `placePiece`. Passing is implicit (the turn order skips stuck
  colors), so there is no `pass` move to expose or abuse.
- `maxMoves: 1` ends the turn automatically after a legal placement.
- `resolveCells` and `isLegalPlacement` come straight from `src/game/`, so the exact
  same code powers move generation, the AI-less stuck check, and tests.

### Undo

Set **`disableUndo: true`**. Rationale: placement is committed only after a local
*confirm* step in the UI (select → preview → rotate/flip → confirm), so there is
nothing to undo mid-turn, and disabling undo avoids multiplayer desync confusion.

---

## 6. Component tree

```
<App>                                  // routes on app state: 'home' | 'lobby' | 'match'
├─ <HomeScreen>                        // create or join
├─ <Lobby>                             // match list + create form (uses LobbyClient)
│  ├─ <MatchList>
│  └─ <CreateMatchForm>                // mode (2/3/4) + scoring variant → setupData
└─ <MatchScreen matchID playerID credentials>
   └─ <BlokusClient>                   // boardgame.io Client(...) instance
      └─ <BlokusBoardView> (BoardProps<GameState>)
         ├─ <Board>                    // 20×20 CSS grid
         │  ├─ <Cell> × 400
         │  └─ <GhostPiece>            // preview at hovered anchor, valid/invalid tint
         ├─ <PieceTray>                // one section per color
         │  └─ <PieceThumb>            // click to select; greyed when placed
         ├─ <Controls>                 // rotate ⟳, flip ⇄, confirm, "you're stuck"
         ├─ <ScorePanel>               // live remaining-square counts per color/player
         └─ <GameOverModal>            // shown when ctx.gameover set
```

### UI-only state (never in `G`)

Managed by `useSelection` / `uiContext`:

- `selectedPieceId`, `rotation`, `reflected` — the piece being composed.
- `hoverCell` — where the ghost previews.
- Derived: `previewCells` + `previewIsLegal` (calls the same `isLegalPlacement`).

Confirming dispatches `moves.placePiece({ pieceId, rotation, reflected, x, y })`.

The board view reads authoritative data from props: `G` (board, colors), `ctx`
(currentPlayer, gameover), and `playerID` (which seat this browser is). It disables
input when `ctx.currentPlayer`'s color isn't owned by this `playerID`.

---

## 7. Room / lobby system

Uses boardgame.io's built-in Lobby REST API + `LobbyClient`; no custom matchmaking
backend.

### Server

```ts
// src/server/index.ts
import { Server, Origins } from 'boardgame.io/server';
import { BlokusGame } from '../bgio/BlokusGame';

const server = Server({
  games: [BlokusGame],                 // BlokusGame.name = 'open-blokus'
  origins: [Origins.LOCALHOST_IN_DEVELOPMENT, /* prod domain */],
});
server.run(Number(process.env.PORT) || 8000);
```

### Match lifecycle

1. **Create** — `CreateMatchForm` calls
   `lobbyClient.createMatch('open-blokus', { numPlayers, setupData })`
   where `setupData = { mode, scoring }` and `numPlayers ∈ {2,3,4}` matches `mode`.
   Returns `matchID`.
2. **Validate** — the game's `validateSetupData(setupData, numPlayers)` rejects
   mismatches (e.g. `mode === 3` but `numPlayers !== 3`) before the match is created.
3. **Join** — each player calls `lobbyClient.joinMatch('open-blokus', matchID,
   { playerID?, playerName })` and receives `{ playerID, playerCredentials }`. Store
   `playerID` + credentials in `localStorage` keyed by `matchID` (survive refresh).
4. **Play** — `MatchScreen` mounts `<BlokusClient matchID playerID credentials
   multiplayer={SocketIO({ server })} />`. Missing `playerID` ⇒ spectator.
5. **Game over** — `GameOverModal` offers `lobbyClient.playAgain(...)` → `nextMatchID`.
6. **Leave** — `lobbyClient.leaveMatch(...)` on exit.

### setup & validation

```ts
// src/bgio/setup.ts (sketch)
export const setup = ({ ctx }, setupData?: { mode: GameMode; scoring: ScoringVariant }) => {
  const mode = setupData?.mode ?? (ctx.numPlayers as GameMode);
  const scoring = setupData?.scoring ?? 'basic';
  return initialGameState(mode, scoring); // builds board, colors, owners, indices
};

export const validateSetupData = (
  data: { mode?: GameMode; scoring?: ScoringVariant } | undefined,
  numPlayers: number,
) => {
  const mode = data?.mode ?? numPlayers;
  if (![2, 3, 4].includes(mode)) return 'mode must be 2, 3, or 4';
  if (mode !== numPlayers) return 'mode must equal numPlayers';
  if (data?.scoring && !['basic', 'advanced'].includes(data.scoring))
    return 'invalid scoring variant';
};
```

### Storage progression

- **MVP:** default in-memory (state lost on restart — fine for dev).
- **Next:** flatfile connector (`bgio-storage`-style) for cheap persistence.
- **Prod:** a DB connector (e.g. Postgres) per [docs/boardgame.io/storage.md](docs/boardgame.io/storage.md).

### Dev vs. remote master

- `multiplayer: Local()` — pass-and-play and component dev; render 2–4 `<BlokusClient>`
  with different `playerID`s on one page, no server.
- `multiplayer: SocketIO({ server })` — real networked play against `src/server`.

Same `BlokusGame` and board component for both; only the `multiplayer` option changes.

---

## 8. Key implementation decisions (summary)

1. **Pure rules core** in `src/game/`, framework-agnostic and fully unit-tested.
2. **Colors are first-class**, decoupled from boardgame.io `playerID`; a custom
   color-aware turn order + `owners` map handles all of 2p/3p/4p.
3. **Single `placePiece` move**; passing is implicit via skip-stuck turn order.
4. **Moves carry `(pieceId, rotation, reflected, x, y)`**, cells recomputed
   server-side — clients can't fabricate shapes.
5. **No hidden state** ⇒ no `playerView`; optimistic updates always valid.
6. **`disableUndo` + confirm-to-commit UX** keeps multiplayer state unambiguous.
7. **Built-in Lobby** for rooms; `setupData = { mode, scoring }`, guarded by
   `validateSetupData`.
8. **Orientations precomputed** from base shapes via D4 at load (see GAME_SPEC §2).
