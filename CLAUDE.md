# OpenBlokus

Browser-based multiplayer Blokus clone. **Phases 0–9 shipped** — fully playable with
real-time multiplayer, lobby, and persistence. See [docs/BUILD_ORDER.md](docs/BUILD_ORDER.md).

**Run:** `npm run serve` (game server :8000) + `npm run dev` (app :5173). `npm test`
runs unit (vitest) + e2e (Playwright). `npm run typecheck` / `npm run lint` for checks.

## Canonical docs — read before working

| Doc | What it is |
|-----|------------|
| [docs/GAME_SPEC.md](docs/GAME_SPEC.md) | **Source of truth for rules.** 21 pieces + coords, corners, placement rules, scoring, 2/3/4-player modes, `G` field reference (§9). Specifies **Classic** (20×20, 4 colors). |
| [docs/GAME_SPEC_DUO.md](docs/GAME_SPEC_DUO.md) | **Source of truth for the Duo variant** (14×14, 2 colors, interior start cells), from Mattel FWG43. A **delta doc**: it states only what Duo changes and defers everything else to GAME_SPEC.md — never restate a shared rule here. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, folder layout, `GameState` type, moves, turn model, components, lobby/rooms. |
| [docs/BUILD_ORDER.md](docs/BUILD_ORDER.md) | Phased build plan (all phases shipped); each phase has a verify checklist. |
| [docs/product/BACKLOG.md](docs/product/BACKLOG.md) | **Product/feature backlog** — pool of shippable features + UX (advisor, UI, sound). Curated counterpart to [docs/dev_notes/](docs/dev_notes/); distinct from research experiments and from the BUILD_ORDER *plan*. |

`GAME_SPEC.md` and `ARCHITECTURE.md` are kept consistent — if you change game state,
moves, or rules in one, update the other. `GAME_SPEC_DUO.md` overrides `GAME_SPEC.md`
only where it explicitly says so; if a fact appears in both, `GAME_SPEC.md` wins.

## Doc discipline (avoid the re-align treadmill)

- **Single source of truth per fact:** rules → GAME_SPEC, structure/why → ARCHITECTURE,
  plan → BUILD_ORDER, AI/engine **research** (measurable experiments) → `docs/research/`
  (see below), **product features** (UX/UI, "usability" not a metric) → `docs/product/BACKLOG.md`.
  Once code exists, **code + tests own the *what*; docs keep the *why*.**
- **ARCHITECTURE code blocks are illustrative sketches** — when they diverge from `src/`,
  `src/` wins; don't sync every signature back into the doc.
- **Let tests enforce the spec** (e.g. GAME_SPEC §2/§8 piece invariants check `pieces.ts`
  automatically) so alignment is mechanical, not manual. BUILD_ORDER is disposable —
  tick off / delete phases as they ship.

## Research (AI/engine experiments) — [docs/research/](docs/research/)

Where AI-strategy + engine tuning is tracked. **Read
[FRAMEWORK.md](docs/research/FRAMEWORK.md) before running or recording an experiment** —
it owns the process. SoT split (each a separate file/role):

| Need | Go to |
|------|-------|
| Curated insights / lessons ("so what") | [FINDINGS.md](docs/research/FINDINGS.md) (findings F#, method lessons M#) |
| Raw runs, **append-only — never rewrite** | [log/](docs/research/log/) |
| Planned/deferred experiments, one framework block each | [backlog/](docs/research/backlog/) (AE# = ai-engine, AD# = advisor) |
| The template + stats discipline + status vocab | [FRAMEWORK.md](docs/research/FRAMEWORK.md) |
| **Registry of the game's dramatic verbs** (cut, cramped, endgame, out-of-moves) — ids, triggers, thresholds, consumers. A test holds doc ↔ detector in sync both ways. Read before adding an event or retuning a threshold. | [docs/EVENTS.md](docs/EVENTS.md) |


**Maintenance loop when you do research work:** pick a backlog entry → follow its
Method (benchmark via `npm run arena`) → **append** a record to `log/` → distil the
durable claim into `FINDINGS.md` → flip the backlog entry's `Status`. Synthesis lives
in FINDINGS, not the log; the log is history and stays append-only.

- **Finish layers are theme-driven, not hardcoded.** In `MatLayer` / `PlacedLayer`,
  every alpha, radius, and tint comes from a `--tile-*` / `--mat-*` token, never a
  literal. A constant tuned against a pale mat vanishes on a dark one while vitest,
  typecheck, and lint all stay green — the only detector is looking at each theme.

## Stack

Vite + TypeScript + React • [boardgame.io](https://boardgame.io) `0.50.2` (game engine,
multiplayer, lobby) • Vitest. Vendored framework docs: [docs/boardgame.io/](docs/boardgame.io/).

## Invariants (easy to get wrong)

- **`G` must be plain JSON** — no `Set`/`Map` in game state (they serialize to `{}`).
  Use arrays + plain objects.
- **Color ≠ player.** `numPlayers` = humans; colors are owned via a map + custom
  turn order (handles 2p multi-color and 3p shared color). See ARCHITECTURE §4.
- **One move: `placePiece`.** No pass move — stuck colors auto-skip by advancing
  `activeColorIndex` inside the move. See GAME_SPEC §5, §9.
- **Cheat-resistant moves** carry `(pieceId, rotation, reflected, x, y)`; the engine
  recomputes cells from the canonical piece table.
- **Pure rules core** lives in `src/game/` (no React, no boardgame.io imports) and is
  unit-tested independently; the boardgame.io `Game` def wrapping it lives in
  `src/bgio/BlokusGame.ts`.
- **AI bots run client-side (offline) only** — heuristic in `src/game/ai/` (pure);
  `ai.enumerate` mirrors `generateLegalMoves`. Difficulty tiers shipped (easy =
  heuristic, medium/hard = time-budget MCTS, extreme = no-time-budget MCTS,
  [difficulty.ts](src/client/ai/difficulty.ts); per-tier beam, F8);
  **networked bot-fill deferred**. See ARCHITECTURE §9. Tuning/research → Research section above.

## Conventions

- Coordinates are `(x, y)`: `x` = column 0–19 (left→right), `y` = row 0–19 (top→bottom).
  Top-left `(0,0)`.
- Board index = `y * 20 + x`.


