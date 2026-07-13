/**
 * Shape of the precomputed games the front door's ambient board replays (P29 M2).
 *
 * Lives in `shared/` because it's the contract between two sides that must never
 * import each other: the offline generator (engine-side, `game/ai/ambient.ts`) writes
 * it, and the client (`lobby/AmbientBoard.tsx`) reads it. Moves carry resolved *cells*
 * rather than placements, so replaying one needs no piece table and no move generator
 * — the board plays itself with no engine in the bundle.
 */

/** One placement: the color's index in COLORS, and the board indices it filled. */
export type AmbientMove = [colorIndex: number, cells: number[]];

export interface AmbientGame {
  /** The seed that produced it — lets a test regenerate and compare. */
  seed: number;
  moves: AmbientMove[];
}
