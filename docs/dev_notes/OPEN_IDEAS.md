# possible implementation ideas

these are ideas from the human developer and should not be considered official documentation or directives. these ideas may be implemented already, deferred, cancelled, etc. and this document will not be updated or maintained as a source of truth. treat it accordingly.

## advisor features (deferred to later release)

### pre-game tutorial

- some kind of optional tutorial explaining how to play the game + tips
- keep it short and interactive rather than text-heavy.
- teach only four things: corner-touch rule, no edge-touch with your own pieces, first move from your starting corner, and why preserving expansion lanes matters.

  structure:
  - Step 1: Place one simple legal piece.

  - Step 2: Try an illegal edge-touch move and show why it fails.

  - Step 3: Show multiple legal corner-touch options.

  - Step 4: Demonstrate a “bad but legal” move versus a “better for growth” move.

### mid-game advisor overlay (save this for when UI/style is finalized as it would be pretty complicated)

- optional walkthrough of what to prioritize

- highlight legal and/or optimal plays

- heatmaps

- priorities

- staged move scorer/evaluator

- state-of-game evaluator (how well am I doing right now?)

- win probability

- possible milestones:

  - Release 1: “Show legal placements” only.

  - Release 2: “Suggest 2–3 candidate moves” with plain-English reasons.

  - Release 3: stronger advisor overlay with board heatmaps or strategic priorities.

### postgame recap (consider how this and mid-game advisor can use the same assets)

- play-by-play analysis
- highlighting key moments like "good plays" or "blunders"
- possible recap messages. we should provide these based on the same signals/calc that the best intelligence we have (currently MCTS) would see. -- note: what kind of logging will be needed to implement this? will it be as simple as running MCTS judging how it would move given your current position?
  - “Turn 6: You closed your own corridor.”

  - “Turn 9: Large piece played too late.”

  - “Turn 11: Opponent gained uncontested corner access.”

  - “Turn 14: Strong containment move.”

  - One day, maybe this could be done by local LLM. Prepare a data report and give it instructions or guideliness on how to judge or just report these events. 

## UI

### Game UI

#### Overall Theming Principles

- playful skeumorphism with abstract strategy theming, using the four classic colors as accents

- territorial, almost mosaic-like identity, where the shapes themselves are the star

- hyperrealistic replications of plastic for the Blokus game board, translucent plastic pieces for the polyminoes.

- eventually, sounds that are fun and nostalgic of 90s/2000s internet, and maybe MIDI/Flash-era-esque/nostalgic sounds for placing pieces

#### Board

- Center the board?

  - Or maybe it could take up the left half of the screen. And put the polyominoes

- Player's corner should always be bottom right or bottom left to start, player should have button that lets them rotate their view of the board

- skeumorphic textures and pieces: for translucent plastic mimicking the look and feel of the actual game. could generate SVGs or something with AI?

##### Board Navigation

- placement hover/viz: WASD or mouse cursor

- Rotation: scroll mouse or use arrow keys

- actual placement: Space and click

- submitting move: add clickable button, also allow Enter

  - WASDstrafes, scroll rotates, space and click can both place, enter submits