# Event vocabulary

The **single source of truth for the game's dramatic verbs** — the moments the app is
allowed to notice out loud. Detectors live in [`src/client/drama.ts`](../src/client/drama.ts);
this table names them, defines their triggers in plain English, and records their
thresholds. [`tests/events-registry.test.ts`](../tests/events-registry.test.ts) asserts
doc ↔ code alignment **both ways** — an event with no row (or a row with no event, or a
threshold that disagrees with `EVENT_THRESHOLDS`) fails CI. So this file cannot drift.

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
evaluates with, so "room" means the same thing to the bots and to the drama layer.

## Consumers

| consumer | how it reads events |
|----------|---------------------|
| beats (shipped) | [`useGameEvents`](../src/client/hooks/useGameEvents.ts) diffs `prev → cur` and gives each event a TTL; [`EventBeats`](../src/client/controls/EventBeats.tsx) renders it as a pill banner with `data-kind` = the id. |
| event feed (shipped, P43) | the same `useGameEvents` seam also exposes an append-only `log` (no TTL); [`EventFeed`](../src/client/controls/EventFeed.tsx) renders it as a persistent, scrollable game-log panel beside the board. Toggle in Settings → Gameplay, default on. |
| cut highlight (shipped) | the `cut` event carries `lostCells` — the victim's destroyed attach-points — which the board briefly marks. |
| sound (shipped) | one synthesised cue per event id — [`CUES`](../src/client/sound/cues.ts) — fired off the same beat stream by [`useGameSound`](../src/client/sound/useGameSound.ts), so a cue and its banner are one moment and P32's anti-spam is inherited for free. [tests/sound-cues.test.ts](../tests/sound-cues.test.ts) fails CI if an event has no cue, so sound coverage can't silently lag the vocabulary. |
| P2 R1 recap | replays detectors over a logged game to pick out key moments. Not built yet. |
| P34 mobility surfaces | reuse `attachCells` (the same frontier metric) for charts/meters. Not built yet. |
