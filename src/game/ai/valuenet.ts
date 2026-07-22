/**
 * Tiny value net for AE4: per-color win probability from hand-crafted state
 * features. Pure TS — the forward pass runs client-side in the bot with weights
 * as plain JSON (no runtime deps). Training lives in scripts/train-valuenet.ts.
 *
 * Architecture: a shared MLP scores each color from [own features, opponent
 * means, board fill]; the four logits softmax into win probabilities. Shared
 * weights keep it color-symmetric; "is to move" carries the turn information.
 */
/* eslint-disable no-restricted-imports -- Classic by design (P55): the feature
   vector is a fixed 4-color layout (INPUT_SIZE below), so a trained net is bound to
   Classic. A Duo net is a different input shape, i.e. a different model. */
import { COLOR_ORDER } from '../types';
import type { Color, GameState } from '../types';
import { colorStateOf } from '../modes';
import { pieceSize } from '../pieces';
import { placedSquares, attachPoints, territoryControl } from './alphabeta';

export const FEATURES_PER_COLOR = 8;
/** own(8) + opponent-mean(8) + board fill */
export const INPUT_SIZE = FEATURES_PER_COLOR * 2 + 1;

/**
 * Per-color feature rows (COLOR_ORDER order), each FEATURES_PER_COLOR wide,
 * roughly normalized to [0, 1]:
 *   [placed, attach, territory, remainingPieces, largestRemaining,
 *    holdsMonomino, hasStarted, isToMove]
 */
export function extractFeatures(G: GameState, toMove: Color): Float64Array {
  const terr = territoryControl(G);
  const out = new Float64Array(COLOR_ORDER.length * FEATURES_PER_COLOR);
  COLOR_ORDER.forEach((c, i) => {
    const cs = colorStateOf(G, c);
    let maxRem = 0;
    for (const p of cs.remaining) maxRem = Math.max(maxRem, pieceSize(p));
    const o = i * FEATURES_PER_COLOR;
    out[o] = placedSquares(cs) / 89;
    out[o + 1] = attachPoints(G, c) / 40;
    out[o + 2] = terr[i] / 400;
    out[o + 3] = cs.remaining.length / 21;
    out[o + 4] = maxRem / 5;
    out[o + 5] = cs.remaining.includes('I1') ? 1 : 0;
    out[o + 6] = cs.hasStarted ? 1 : 0;
    out[o + 7] = c === toMove ? 1 : 0;
  });
  return out;
}

export interface ValueNetWeights {
  hidden: number;
  /** hidden × INPUT_SIZE, row-major. */
  w1: number[];
  b1: number[];
  w2: number[];
  b2: number;
}

/**
 * Build the net input for one color from the feature rows: own features,
 * mean of the three opponents', and board fill.
 */
export function colorInput(features: Float64Array, colorIdx: number, fill: number): Float64Array {
  const F = FEATURES_PER_COLOR;
  const x = new Float64Array(INPUT_SIZE);
  for (let f = 0; f < F; f++) {
    x[f] = features[colorIdx * F + f];
    let sum = 0;
    for (let j = 0; j < COLOR_ORDER.length; j++) {
      if (j !== colorIdx) sum += features[j * F + f];
    }
    x[F + f] = sum / (COLOR_ORDER.length - 1);
  }
  x[2 * F] = fill;
  return x;
}

/** One color's logit: ReLU MLP forward pass. */
export function colorLogit(w: ValueNetWeights, x: Float64Array): number {
  let out = w.b2;
  for (let h = 0; h < w.hidden; h++) {
    let a = w.b1[h];
    const row = h * INPUT_SIZE;
    for (let i = 0; i < INPUT_SIZE; i++) a += w.w1[row + i] * x[i];
    if (a > 0) out += w.w2[h] * a;
  }
  return out;
}

/** Board fill fraction (placed cells / 400). */
export function boardFill(G: GameState): number {
  let placed = 0;
  for (let i = 0; i < G.board.length; i++) if (G.board[i] !== null) placed++;
  return placed / G.board.length;
}

/** Per-color win probabilities (softmax over the four shared-net logits). */
export function valueNetProbs(G: GameState, toMove: Color, w: ValueNetWeights): number[] {
  const features = extractFeatures(G, toMove);
  const fill = boardFill(G);
  const logits = COLOR_ORDER.map((_, i) => colorLogit(w, colorInput(features, i, fill)));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
