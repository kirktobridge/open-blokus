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
| Game engine | **boardgame.io 0.50.2** | Authoritative move validation, lockstep multiplayer, lobby REST API, undo/log — all free. Pulled docs in [boardgame.io/](boardgame.io/). |
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
├─ docs/
│  ├─ GAME_SPEC.md
│  ├─ ARCHITECTURE.md
│  ├─ BUILD_ORDER.md
│  └─ boardgame.io/              # vendored framework docs (reference)
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
│  │  ├─ ai/heuristic.ts         # bot scoring + chooseMove (pure)
│  │  └─ index.ts
│  ├─ bgio/
│  │  ├─ BlokusGame.ts           # the boardgame.io Game<GameState> object (+ ai.enumerate)
│  │  ├─ turnOrder.ts            # custom turn order (color-aware)
│  │  ├─ setup.ts                # setup() + validateSetupData()
│  │  └─ bots/HeuristicBot.ts    # boardgame.io Bot driven by the heuristic
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
│  │  │  ├─ HomeScreen.tsx       # create / join entry (+ Play vs AI)
│  │  │  ├─ MatchList.tsx
│  │  │  └─ CreateMatchForm.tsx  # pick mode (2/3/4) + scoring variant
│  │  ├─ ai/                     # offline vs-AI: LocalAIGame.tsx + useBotRunner.ts
│  │  ├─ tutorial/               # P4 interactive how-to-play (Tutorial.tsx + scenarios)
│  │  ├─ advisor/                # opt-in coaching surfaces (highlight, room meter);
│  │  │                          # one shared frontier so no two surfaces disagree
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
// Any color any variant can deal; a game holds only its variant's subset
// (Classic's four, or Duo's black/white) — read it via playColorsOf(G).
export type Color = 'blue' | 'yellow' | 'red' | 'green' | 'black' | 'white';
export const COLOR_ORDER: readonly Color[] = ['blue', 'yellow', 'red', 'green'];

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

  /** Index into playColorsOf(G) of the color whose turn it currently is. */
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
- **A variant is a table entry, not a fork of the engine** (P20 M2a/M2b). `GameConfig`
  carries `variant`, `playColors` and board size *optionally*, and everything reads them
  through accessors (`variantOf` / `playColorsOf` / `boardSizeOf` / `startCellOf` in
  `modes.ts`) that fall back to Classic — which is what keeps states persisted before
  variants existed readable. The per-variant facts (colors, size, start cells, forced
  scoring, seat counts) live in one `VARIANTS` table so adding a variant is a row, not
  a scatter of conditionals. "Corner" is called **start cell** throughout the core
  because Duo's are interior.
- **`size` is a required argument** of the `board.ts` helpers (`idx`/`xy`/`inBounds`)
  and the bitboard. It defaulted to Classic through M2a, and that default was the whole
  bug class: a variant-aware caller that omitted it indexed a 196-cell board as 400,
  read `undefined`, and `undefined !== null` made out-of-range cells read as *occupied* —
  silent corruption with vitest, typecheck and lint all green. Requiring it converts
  that class into a typecheck error. Don't reintroduce a default.
- The **active color** is `playColorsOf(G)[activeColorIndex]`, derived state kept in `G`
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
└─ <MatchScreen matchID playerID credentials>   // (SettingsPanel/ControlsHelp float here too)
   └─ <BlokusClient>                   // boardgame.io Client(...) instance
      └─ <BlokusBoardView> (BoardProps<GameState>)   // "study table": 3 centered columns
         ├─ <PlayerCard> × 4           // per-seat: state tag, count, micro-inventory
         ├─ <Board>                    // 20×20 CSS grid, framed in walnut + mat
         │  ├─ <MatLayer>              // SVG molded board: lattice, wells, studs (P5)
         │  ├─ <Cell> × 400            // transparent; hit target + hover/staged tint
         │  └─ <PlacedLayer>           // SVG molded pieces + last-move ring (see §8)
         ├─ <Controls>                 // action dock: in-hand · PLAY MOVE · ⟲ ⟳ ⇄ · Cancel
         ├─ <RailPanel> × n            // wraps each rail section: header + fold (P48)
         │  ├─ <HandTray>/<PieceThumb> // your hand, grouped by size, spending width sideways
         │  └─ <Standings>             // remaining-squares chips
         └─ <GameOverModal>            // shown when ctx.gameover set
```

The offline table (`LocalAIGame`) mounts the same `<BlokusBoardView>` and docks
`SettingsPanel`/`ControlsHelp` into a top bar (both bgio clients run `debug:false`).
That bar is `<TableShell>` — shared, because a full-screen view is reachable by two
routes (in-game and standalone review from Your stats), and chrome owned by one route
silently disappears on the other (P53).

### UI-only state (never in `G`)

Managed by `useSelection` / `uiContext`:

- `selectedPieceId`, `rotation`, `reflected` — the piece being composed.
- `hoverCell` — where the ghost previews.
- Derived: `previewCells` + `previewIsLegal` (calls the same `isLegalPlacement`).

Confirming dispatches `moves.placePiece({ pieceId, rotation, reflected, x, y })`.

The board view reads authoritative data from props: `G` (board, colors), `ctx`
(currentPlayer, gameover), and `playerID` (which seat this browser is). It disables
input when `ctx.currentPlayer`'s color isn't owned by this `playerID`.

**View orientation is a render-time re-index, not a coordinate space.** `Board` takes
the number of quarter-turns and re-indexes what it draws into an upright grid, so
everything crossing its interface — the board array, hints, cut marks, the `(x, y)` it
reports from hover/click — stays in **board coordinates**. There is one pointer space,
and grid-riding overlays cannot lag behind in a stale rotated frame. The visible spin is
a transient transform on a wrapper *outside* `BoardFrame` (so frame and grid turn as one
rigid object); when it ends the turn commits to the data and the transform snaps back to
identity. A 20×20 grid is rotationally symmetric, which is what makes that swap
invisible — the only thing that ends up reoriented is the pieces. Corollary for any
one-shot visual keyed off geometry: key it on board-space identity, not on the drawn
cell list, which a view turn changes.

### Derived events (the drama layer)

The moments the app notices out loud — *cut*, *cramped*, *endgame*, *out-of-moves* — are
**derived, never rules concepts**: detectors in `src/client/drama.ts` are pure functions of
`(prev, cur)` game states and touch `G` not at all. They fire on the ply a condition
*becomes* true (a crossing, not a state machine), which is what makes them **replay-safe** —
a recap can run the same detectors over a logged game and get exactly the beats a live
player saw, so live play and review can't disagree. Anti-spam is structural (one beat per
color per ply) rather than timer-based, for the same reason.

The vocabulary is a **maintained registry**: [EVENTS.md](EVENTS.md) is its single source of
truth (ids, triggers, thresholds, consumers) and `tests/events-registry.test.ts` holds doc
and code together in both directions, so an undocumented event — or a threshold that drifts
from the code — fails CI. Presentation rides one seam (`useGameEvents` → `EventBeats`, plus
the board's cut marks); further consumers (recap moments, mobility surfaces) key off the
event id.

**Sound is the seam's second consumer, and the proof it holds.** `src/client/sound/` maps
cues onto event ids 1:1 and subscribes to the *same* beat stream the banners do, so a cue
and its banner are one moment by construction and the anti-spam above is inherited rather
than re-derived — no second, timer-based notion of "too much" to keep in sync. Cues are
**synthesised** (Web Audio, no assets): the palette stays tunable in code and the bundle
gains nothing. Audibility is a property the count of scheduled cues can't express, so the
e2e renders the graph through an `OfflineAudioContext` and asserts on the waveform.

### Appearance & preferences (client-only)

**One token vocabulary, one store.** Every appearance value — fonts, surfaces, board,
accents, *and the piece colors* (`--piece-blue` &c., one per member of the `Color`
union) — is a CSS custom property on `<html>`, so the whole app retints with **no React
re-render** and there is no second (JS-prop) rail for colors: components paint with
`PIECE_VAR[color]`.

**The finish tokens fork by value class, because they are relative.** `--tile-hi`,
`--tile-lo`, `--tile-ao`, `--tile-dye-mix` &c. describe *modulations of the body color*,
not absolute values, so a single setting can only be right for a band of bodies —
Duo's near-black and near-white clip at opposite ends and the tile flattens. Hence
`-dark` / `-light` variants resolved through a `var()` fallback chain
(`var(--tile-hi-dark, var(--tile-hi))`): a theme writes an override *only* where the
base genuinely fails at that end, so the delta is the documentation, and Classic bodies
never leave the base path. The corollary for SVG: a `<pattern>` inherits custom
properties from the `<defs>` it lives in, not from the element referencing it, so
class-varying finishes need one emitted def **per value class present**, not one def
plus an override at the use site.

A **theme** is a complete assignment of that vocabulary. The three built-ins are the
`[data-theme]` blocks in `theme.css` (this keeps the no-flash boot and the
`prefers-color-scheme` default). A **user theme** is a *sparse fork of a built-in*:
`{ base, overrides }`. `appearance.ts` is the only place values compose —
`effective(token) = activeTheme?.overrides[token] ?? builtin(base)[token]` — applied by
setting `data-theme` to the base and writing **only the active theme's overrides** as
inline vars (clearing all others). Precedence is therefore correct by construction rather
than an accident of the cascade: an override cannot survive a theme switch, and a built-in
is pristine no matter how much you tinker.

Editing any token while a built-in is active **forks it** ("Linen (custom)"), which is
also what "custom palettes" now are. State: one store, one key (`openblokus-appearance`);
it migrates the four pre-unification keys on first load. Behavioral preferences
(inventory display) are *not* appearance — they live in `settings.ts` /
`openblokus-settings`. This is why display concerns stay out of `G`.

`settings.ts` publishes an **effective** snapshot, not the stored one: a *context* (a
fully-bot watch game, P47) can narrow a pref without being written to storage, so
leaving the situation restores the user's own setting with nothing to undo, and an
explicit choice in the panel outranks the context. Consumers read the effective value;
only user actions ever commit.

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
- **Prod:** a DB connector (e.g. Postgres) per [boardgame.io/storage.md](boardgame.io/storage.md).

### Admin panel

Optional server-side ops UI at **`GET /admin`** (served by the game server on `:8000`,
`src/server/admin.ts` + `adminPage.ts`). Self-contained HTML/JS page — no Vite build, same
origin as its API. **Disabled by default**: routes are only mounted when both
`OBK_ADMIN_USER` and `OBK_ADMIN_PASS` are set, and every route is gated by HTTP Basic auth.

- `GET /admin` — the panel (list of matches + health header).
- `GET /admin/api/health` — uptime, memory, match count, storage mode.
- `GET /admin/api/matches` — all matches (credentials stripped); `:id` returns a state peek.
- `DELETE /admin/api/matches/:id` — kill/delete a match (`db.wipe`).
- `POST /admin/api/matches/:id/boot/:seat` — free a seat (clears name + credentials).

Backed entirely by the boardgame.io `StorageAPI` (`db.listMatches / fetch / wipe / setMetadata`),
so it works with both the in-memory and flatfile stores.

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
9. **AI is offline/client-side** (heuristic bot); `ai.enumerate` reuses `generateLegalMoves` (see §9).

---

## 9. AI / bots

AI is an **offline, client-side** feature: bots run in the browser on a local boardgame.io
client. Networked rooms stay human-only.

- **Move source — `BlokusGame.ai.enumerate`** ([src/bgio/BlokusGame.ts](../src/bgio/BlokusGame.ts)): returns every legal
  placement for the active color as `placePiece` moves by **reusing `generateLegalMoves`**, so a
  bot can never consider an illegal move. Non-empty until game over (stuck colors auto-skip).
- **HeuristicBot** ([src/bgio/bots/HeuristicBot.ts](../src/bgio/bots/HeuristicBot.ts), extends `Bot` from `boardgame.io/ai`):
  ranks the enumerated candidates with a pure scorer, plays the best, seeded tie-break.
- **Heuristic** ([src/game/ai/heuristic.ts](../src/game/ai/heuristic.ts), pure + unit-tested):
  `score = size·10 + newFrontier·3 + center·1 + opponentCornersDenied·2` (tunable `WEIGHTS`) —
  play big early, keep mobility (open corners), drift to center, lightly block.
- **Offline play path** ([src/client/ai/LocalAIGame.tsx](../src/client/ai/LocalAIGame.tsx) + `useBotRunner.ts`): a vanilla
  `Client` (no networking). Human seats are the first `mode − aiCount`; the rest are bot seats
  driven by `Step(client, bot)` after a delay (`VITE_BOT_DELAY`, 0 in e2e) with a "thinking"
  indicator. `aiCount === mode` ⇒ an all-AI game you watch. Reuses `BlokusBoardView` via a small
  props adapter. Difficulty is **per bot seat** (playerID), not global: each bot seat has its own
  `Bot` + (for MCTS) its own worker, so opponents can be mixed easy/medium/hard/extreme. Keying by
  seat (not color) keeps each seat's colors — incl. the 3p shared color a seat plays — on one tier,
  and gives each MCTS seat its own worker so per-color search trees never cross tiers.
- **Game logging** ([src/client/log/](../src/client/log/), product P1): finished offline vs-AI
  games are captured as **one replayable record = game header (mode, scoring, seat labels) + the
  move list**, and nothing else — every position, score and eval is *derivable by replay* through
  the pure rules core, so storing them would be redundant. Rather than invent a schema, this
  **reuses the self-play `GameRecord`** ([src/game/ai/selfplay.ts](../src/game/ai/selfplay.ts),
  bumped to `v2` with the header; `v1` reads back as 4p/basic). Capture reads accepted `placePiece`
  moves off the boardgame.io client log and, on game-over, replay-validates + cross-checks against
  the live final scores before persisting — a corrupt line can't reach the log. The sink is **plain
  JSONL on disk** (`.data/games/vs-ai.jsonl`, via a Vite dev-server endpoint) because that's the
  form research + tooling browse and replay (`scripts/games.ts`); localStorage is only a fallback
  when the endpoint is unreachable. Online-match capture is deferred.
  That endpoint **only exists under the Vite dev server**, so it can't be what a real player's
  history rests on. Product P15 M2 therefore adds a *second, independent* sink from the same
  recorder: a capped localStorage list of records for the player-facing game history
  ([src/client/log/history.ts](../src/client/log/history.ts)), written synchronously and never
  gated on the POST. Same `GameRecord` shape, two audiences — research reads the disk JSONL, the
  player reads their own browser. A record that won't parse is skipped, not fatal to the list.
  **A record names its variant** (product P56, serialized `v3`; `v1`/`v2` read back as Classic):
  seats, scores, winners and moves are keyed by the variant's play-color list rather than by
  `COLOR_ORDER` position, and every reconstruction path (`replayGame`, `buildRecap`, the
  recorder's replay cross-check) rebuilds the right board from it. The reason it had to land
  *with* playable Duo: both the recorder's catch-and-warn and history's drop-on-read were built
  for legacy corruption and swallow structurally-new data identically, so an unlabelled Duo game
  would simply vanish — no log line, no history row, no recap — with the suite green. For the
  same reason the P15 progression store keys `perTier`, `bestScores` and the milestone unlocks
  per variant instead of blending two different games into one bucket.

**Recorded decisions (do not silently change — see [GAME_SPEC §10](GAME_SPEC.md)):**
- Bots are **client-side / offline only**. Networked bot-fill (bots in SocketIO rooms via a
  bot-runner) is **deferred**.
- **Four-tier ladder shipped** (easy = heuristic; medium/hard = time-budget MCTS; extreme =
  fixed-iteration MCTS — [difficulty.ts](../src/client/ai/difficulty.ts)), tuned via research
  (F6 breaks the heuristic ceiling, F8 per-tier beam) with rank-normalized reward shaping so
  a losing bot still fights for placement (F15, `rankRewardWeight`). Tuning lives in research.
- `ai.enumerate` must always mirror `generateLegalMoves`.
