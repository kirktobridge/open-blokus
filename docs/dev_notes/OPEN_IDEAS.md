# possible implementation ideas

these are ideas from the human developer and should not be considered official documentation or directives. these ideas may be implemented already, deferred, cancelled, etc. and this document will not be updated or maintained as a source of truth. treat it accordingly.

## advisor features (deferred to later release)

### pre-game tutorial

- some kind of optional tutorial explaining how to play the game + tips

### mid-game advisor overlay

- optional walkthrough of what to prioritize (save this for when UI/style is finalized)

- highlight optimal plays

### postgame recap

- play-by-play analysis
- highlighting key moments like "good plays" or "blunders"

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