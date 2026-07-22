# Event vocabulary

The **single source of truth for the game's dramatic verbs** — the moments the app is
allowed to notice out loud. Detectors live in [`src/client/drama.ts`](../src/client/drama.ts);
this table names them, defines their triggers in plain English, and records their
thresholds. [`tests/events-registry.test.ts`](../tests/events-registry.test.ts) asserts
doc ↔ code alignment **both ways** — an event with no row (or a row with no event, or a
threshold that disagrees with `EVENT_THRESHOLDS`) fails CI. So this file cannot drift.

The same test covers two more tables that arrived with the Duo variant (P55):
[**Standing signals**](#standing-signals), the quiet overlays that are pointedly *not*
events, and [**Variant deltas**](#variant-deltas), where either registry records the
bars a non-Classic variant moves. A threshold anywhere in the signal layer has a row in
one of the three.

**What an event is.** A *derived* signal, never a rules concept: detectors read
`(prev: GameState, cur: GameState)` and are **pure, stateless, and side-effect-free**.
An event fires on the ply where its condition *becomes* true (a crossing, not a state
machine), which is what makes them replay-safe — a recap (P2 R1) can run the same
functions over a logged game, ply by ply, and get exactly the beats a live player saw.
Nothing here touches `G`.

**Anti-spam is structural, not timers.** At most **one beat per color per ply**
(priority: `out-of-moves` > `cut` > `cramped`) and at most **one `cut` per placement**
(the worst-hit victim). Thresholds are feel-tuned, not research-derived; retune them in
`EVENT_THRESHOLDS` and this table follows (or CI fails).

**Why these numbers.** Measured over 20 heuristic self-play games (1436 plies): one
placement can bury at most **3** of a color's attach points (never more — a piece just
can't cover more of one color's scattered corners), and a live color's frontier runs ~13
wide (p10 7, p90 18). So a 3-point bar was the ceiling, not a bar — it fired once every
*20 games*. The values above put the vocabulary at roughly **2.8 cuts, 1 cramped, 1
endgame and 4 out-of-moves per game** — frequent enough to be a language, rare enough
that a cut still means something. Retune by feel; re-measure the rate before you commit
to a number, because the distribution is not what intuition suggests.

**Adding an event.** The row and its detector land together, in the same change — add the
id to `EVENT_IDS`, the detector to `detectEvents`, the row here. Consumers key off the
id, so an id is a small contract: don't rename one without updating its consumers.

## The vocabulary

| id | beat text | trigger (plain English) | thresholds | consumers |
|----|-----------|--------------------------|------------|-----------|
| `out-of-moves` | "Blue is out of moves" | a color that had legal moves has none left — it crossed to `stuck` this ply | — | beats, sound cue, P2 recap |
| `cut` | "Red cut off Blue" | an opponent's placement buries a large share of a color's *frontier* (its open corner attach-points) — the victim with the biggest loss, one per placement | `CUT_MIN_LOSS=2` (attach points buried) and `CUT_MIN_SHARE=0.15` (of the frontier it had) | beats, cut highlight, sound cue, P2 recap |
| `cramped` | "Blue is running out of room" | a started, unstuck color's frontier falls to a handful of attach-points — fires on the crossing, not while it sits there | `CRAMPED_MAX=5` (attach points at or below = cramped) | beats, sound cue, P34 mobility surfaces |
| `endgame` | "Final rounds" | every color still in the game is down to its last few pieces; once per game, no subject color | `ENDGAME_PIECES_LEFT=5` (pieces left per live color) | beats, sound cue, P2 recap |

**Frontier** = `attachCells(G, color)` ([`src/game/ai/alphabeta.ts`](../src/game/ai/alphabeta.ts)):
empty cells diagonally adjacent to the color and not orthogonally adjacent to it — i.e.
where the color could still legally attach. It's the same cheap mobility proxy the AI
evaluates with, so "room" means the same thing to the bots and to the drama layer. It is
board-size aware, so the *definition* is variant-independent — but the **magnitudes are
not**, which is what the [variant deltas](#variant-deltas) below are about.

## Standing signals

The other half of the signal layer, registered here since P55. A **standing signal** is a
pure predicate over *one* `GameState` — recomputed every turn, rendered as a quiet
overlay, no crossing, no TTL, no sound cue. That is exactly why it is **not** an event
(P44): an event is a `(prev, cur)` transition the app announces once. They share this file
because they share the failure mode — a feel-tuned magnitude that silently means something
different on another board.

| id | what it reads | thresholds | consumers |
|----|---------------|------------|-----------|
| `incursion` | your open corners (`expansionAnchors`) that some *opponent* could legally cover next turn with a real piece — the defensive read beginners miss. Stuck opponents and your own teammate colour (2p multi-colour) threaten nothing. | `INCURSION_MIN_PIECE=3` (squares in the threatening piece) | incursion overlay (shipped, P44) via the `LegalMoveHints` seam |

Detectors live in [`src/client/advisor/`](../src/client/advisor/); thresholds in
[`SIGNAL_THRESHOLDS`](../src/client/signals.ts). Same both-ways test as the vocabulary.

## Variant deltas

Both registries above state their **Classic** values. A variant records only what it
changes — the delta discipline of [GAME_SPEC_DUO.md](GAME_SPEC_DUO.md), applied to
magnitudes instead of rules. Live in `EVENT_THRESHOLD_DELTAS` and
`SIGNAL_THRESHOLD_DELTAS` ([`tuning.ts`](../src/client/tuning.ts) holds the shared axis);
the registry test holds doc and code to each other in both directions, so an
**empty** delta table below is a claim that the Classic bars were checked against that
variant — not that nobody looked.

| registry | id | threshold | Classic | delta | why |
|----------|----|-----------|---------|-------|-----|
| event | `cut` | `CUT_MIN_LOSS` | 2 | `DUO_CUT_MIN_LOSS=3` | Duo's frontier runs ~11 wide against Classic's ~13, so the same 2-cell loss clears `CUT_MIN_SHARE` where a Classic frontier would have absorbed it. With one opponent instead of three on half the area, colors interlock far more: at the Classic bars, cuts fired **7.4 per Duo game** against Classic's 3.5, in games *half as long*. Requiring 3 brings it to **2.7** — back at the ~2.8 the vocabulary was tuned for. |

**Deliberately undelta'd.** `CRAMPED_MAX` sits at the 10th percentile of the frontier in
both variants and fires ~0.4 times per game either way. `ENDGAME_PIECES_LEFT` counts
pieces, and every variant deals the same 21. `INCURSION_MIN_PIECE` counts squares in a
*piece*, so unlike `CUT_MIN_LOSS` — which counts frontier cells and therefore scales with
the board — it doesn't move when the board does. Event bars re-measured over 20 heuristic
self-play games per variant (P54); re-measure before retuning, on the variant you mean.

## Consumers

| consumer | how it reads events |
|----------|---------------------|
| beats (shipped) | [`useGameEvents`](../src/client/hooks/useGameEvents.ts) diffs `prev → cur` and gives each event a TTL; [`EventBeats`](../src/client/controls/EventBeats.tsx) renders it as a pill banner with `data-kind` = the id. |
| event feed (shipped, P43) | the same `useGameEvents` seam also exposes an append-only `log` (no TTL); [`EventFeed`](../src/client/controls/EventFeed.tsx) renders it as a persistent, scrollable game-log panel beside the board. Toggle in Settings → Gameplay, default on. |
| cut highlight (shipped) | the `cut` event carries `lostCells` — the victim's destroyed attach-points — which the board briefly marks. |
| sound (shipped) | one synthesised cue per event id — [`CUES`](../src/client/sound/cues.ts) — fired off the same beat stream by [`useGameSound`](../src/client/sound/useGameSound.ts), so a cue and its banner are one moment and P32's anti-spam is inherited for free. [tests/sound-cues.test.ts](../tests/sound-cues.test.ts) fails CI if an event has no cue, so sound coverage can't silently lag the vocabulary. |
| P2 R1 recap | replays detectors over a logged game to pick out key moments. Not built yet. |
| P34 mobility surfaces | reuse `attachCells` (the same frontier metric) for charts/meters. Not built yet. |
