---
name: verify
description: Drive the real running app to observe a change working end-to-end — launch the servers, exercise the affected flow with a throwaway Playwright script, and report what was actually observed. Use after any nontrivial product-code change ("verify this", "does it actually work", /verify), and as the launch recipe when asked to run or screenshot the app (/run). Not a substitute for npm test — it observes behavior the suite doesn't assert.
context: fork
---

# Verify — observe the change working in the real app

`npm test` proves the assertions we already wrote; this skill proves the change
actually behaves as intended, by driving the affected flow in the running app and
observing the result (DOM state, screenshots, console, server log). Runs
**forked** — derive what changed from `git diff`/`git log` (don't rely on
conversation state) and end with a compact report: what flow you drove, what you
observed, screenshots taken, and any console/server errors verbatim.

Skip (say so, don't fake it) when the diff touches only tests, docs, or config
with no runtime surface. Anything under `src/` has one.

## Launch recipe

- **App:** `npm run dev -- --port 5173 --strictPort` → http://localhost:5173.
  `--strictPort` matters: a stale dev server already on 5173 serves *old* code —
  if the port is taken, find and kill it, don't fall back to another port.
- **Game server** (only for multiplayer/lobby/persistence flows; solo-vs-AI is
  fully client-side): `npm run serve` → :8000, ready when
  `curl -s http://localhost:8000/games` answers. Admin-panel flows need their own
  instance: `PORT=8001 OBK_ADMIN_USER=admin OBK_ADMIN_PASS=test-pass npm run serve`.
- Run both in the background, capture their logs to the scratchpad, and check the
  logs at the end — a clean-looking UI with a stack trace in the server log is
  not verified.
- **Instant bots:** append `?botDelay=0` to the URL (or set `VITE_BOT_DELAY=0`).
  Omit it when the change *is* about thinking-time UI (indicator, blitz clock).
- Teardown: kill both processes when done; leave a pre-existing user-started
  server (:8000) alone.

## Driving the app

WSL2, no display — drive with a **throwaway headless Playwright script in the
scratchpad** (never a committed spec; a flow worth keeping becomes a real spec in
`e2e/` via the normal build flow). Screenshot before/after the key action and
attach the decisive one to the report. Capture `page.on('console')` and
`page.on('pageerror')` — zero errors is part of the bar.

Canonical flows (testids are current as of P34; if one 404s, read the matching
spec in `e2e/` — the specs are the living selector reference):

- **Solo vs AI** (cheapest, the default): `goto('/?botDelay=0')` →
  `quick-play` → you are blue and up first. Custom seats: `open-custom` →
  `ai-mode-select` (players) + `ai-count-select` → `start-ai`.
- **Making a move:** `piece-blue-I2` → `cell-0-0` (stage) → `submit-move`
  (commit). Blue opens at (0,0), yellow (19,0), red (19,19), green (0,19).
  Confirm via `cell-x-y`'s `data-value` attr and the `active <color>` text.
- **Two-client multiplayer** (needs :8000): two browser contexts;
  A: `open-friends` → `mode-select` → `create-match`, read the id from
  `match-id`; B: `open-friends` → `join-id-input` → `join-id-submit`. Assert A's
  move appears on B's board, not just A's.

## What "verified" means

Report **observed** facts only: the new behavior visibly happened (screenshot or
asserted DOM state), the old behavior is gone if the change removed one, and
console + server log are clean. "Typecheck passes and the suite is green" is not
a verify result. If the flow can't be driven (feature is behind unmerged state,
server won't start), report that as *not verified* with the blocker — never
downgrade to "tests pass, looks fine".

## Not this skill

- Running the suite / typecheck / lint → that's /implement step 4's first bullet;
  do not duplicate it here.
- Judging code quality → **/code-review**, **/simplify**.
- Merging or doc flips → **/land**, **/ship**.
- Benchmarking AI strength → **/research** (`npm run arena`).
