/**
 * AE4 Stage B: train the tiny value net on a self-play dump and run the
 * pre-registered offline gate.
 *
 *   npx vite-node scripts/train-valuenet.ts <games.jsonl> [--hidden=32]
 *     [--epochs=5] [--lr=1e-3] [--out=.data/selfplay/valuenet-weights.json]
 *
 * Gate (pre-registered in backlog AE4): on held-out games (game index %10 == 9),
 * mid-game positions (plies 20–50), the net's argmax winner-prediction must beat
 * the shipped alpha-beta state eval (placed·1 + attach·0.5, territory off) used
 * the same way. Prints Wilson-CI-ready counts for stats.py.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { COLOR_ORDER } from '../src/game/types';
import { mulberry32 } from '../src/game/ai/arena';
import { deserializeRecord, replayGame } from '../src/game/ai/selfplay';
import type { SerializedRecord } from '../src/game/ai/selfplay';
import {
  extractFeatures,
  colorInput,
  boardFill,
  FEATURES_PER_COLOR,
  INPUT_SIZE,
  type ValueNetWeights,
} from '../src/game/ai/valuenet';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (name: string, dflt: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt;

const dataPath = args[0] ?? '.data/selfplay/heur-e10-10k.jsonl';
const HIDDEN = Number(flag('hidden', '32'));
const EPOCHS = Number(flag('epochs', '5'));
const LR = Number(flag('lr', '1e-3'));
const outPath = flag('out', '.data/selfplay/valuenet-weights.json');
const BATCH = 256;
const MID_LO = 20;
const MID_HI = 50;
const NC = COLOR_ORDER.length;
const F = FEATURES_PER_COLOR;

// --- load + featurize --------------------------------------------------------

interface Sample {
  /** 4 feature rows (4×F) as produced by extractFeatures. */
  rows: Float32Array;
  fill: number;
  /** Winner distribution over colors (ties split). */
  label: Float32Array;
  ply: number;
}

console.log(`loading ${dataPath} ...`);
const t0 = Date.now();
const lines = readFileSync(dataPath, 'utf8').split('\n').filter(Boolean);
const train: Sample[] = [];
const test: Sample[] = [];

lines.forEach((line, gameIdx) => {
  const record = deserializeRecord(JSON.parse(line) as SerializedRecord);
  if (record.winners.length === 0) return;
  const label = new Float32Array(NC);
  for (const c of record.winners) label[COLOR_ORDER.indexOf(c)] = 1 / record.winners.length;
  const sink = gameIdx % 10 === 9 ? test : train;
  replayGame(record.moves, (G, next, ply) => {
    sink.push({
      rows: Float32Array.from(extractFeatures(G, next.color)),
      fill: boardFill(G),
      label,
      ply,
    });
  });
});
console.log(
  `featurized ${lines.length} games → train ${train.length} / test ${test.length} positions ` +
    `in ${((Date.now() - t0) / 1000).toFixed(0)}s`,
);

// --- model -------------------------------------------------------------------

const rng = mulberry32(1234);
const gauss = () => {
  // Box–Muller
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
};

const w1 = new Float64Array(HIDDEN * INPUT_SIZE).map(() => gauss() * Math.sqrt(2 / INPUT_SIZE));
const b1 = new Float64Array(HIDDEN);
const w2 = new Float64Array(HIDDEN).map(() => gauss() * Math.sqrt(2 / HIDDEN));
let b2 = 0;

// Adam state
const mkAdam = (n: number) => ({ m: new Float64Array(n), v: new Float64Array(n) });
const aW1 = mkAdam(w1.length);
const aB1 = mkAdam(b1.length);
const aW2 = mkAdam(w2.length);
const aB2 = { m: 0, v: 0 };
const B1 = 0.9;
const B2 = 0.999;
const EPSA = 1e-8;
let step = 0;

function forward(x: Float64Array, act: Float64Array): number {
  let out = b2;
  for (let h = 0; h < HIDDEN; h++) {
    let a = b1[h];
    const row = h * INPUT_SIZE;
    for (let i = 0; i < INPUT_SIZE; i++) a += w1[row + i] * x[i];
    act[h] = a > 0 ? a : 0;
    if (a > 0) out += w2[h] * a;
  }
  return out;
}

/** Per-color inputs for a sample (built on the fly — cheap copies). */
function inputsOf(s: Sample): Float64Array[] {
  const rows = Float64Array.from(s.rows);
  return COLOR_ORDER.map((_, i) => colorInput(rows, i, s.fill));
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// --- training ----------------------------------------------------------------

const gW1 = new Float64Array(w1.length);
const gB1 = new Float64Array(b1.length);
const gW2 = new Float64Array(w2.length);
let gB2 = 0;
const acts = COLOR_ORDER.map(() => new Float64Array(HIDDEN));

function adamStep(p: Float64Array, g: Float64Array, s2: { m: Float64Array; v: Float64Array }) {
  const bc1 = 1 - Math.pow(B1, step);
  const bc2 = 1 - Math.pow(B2, step);
  for (let i = 0; i < p.length; i++) {
    s2.m[i] = B1 * s2.m[i] + (1 - B1) * g[i];
    s2.v[i] = B2 * s2.v[i] + (1 - B2) * g[i] * g[i];
    p[i] -= (LR * (s2.m[i] / bc1)) / (Math.sqrt(s2.v[i] / bc2) + EPSA);
  }
}

const order = train.map((_, i) => i);
for (let epoch = 1; epoch <= EPOCHS; epoch++) {
  const tE = Date.now();
  // Fisher–Yates shuffle, seeded
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let loss = 0;
  for (let start = 0; start < order.length; start += BATCH) {
    const end = Math.min(start + BATCH, order.length);
    gW1.fill(0);
    gB1.fill(0);
    gW2.fill(0);
    gB2 = 0;
    for (let k = start; k < end; k++) {
      const s = train[order[k]];
      const xs = inputsOf(s);
      const logits = xs.map((x, ci) => forward(x, acts[ci]));
      const p = softmax(logits);
      for (let ci = 0; ci < NC; ci++) {
        if (s.label[ci] > 0) loss -= s.label[ci] * Math.log(Math.max(p[ci], 1e-12));
        const dl = p[ci] - s.label[ci]; // dLoss/dlogit_ci
        const x = xs[ci];
        const act = acts[ci];
        gB2 += dl;
        for (let h = 0; h < HIDDEN; h++) {
          if (act[h] <= 0) continue;
          gW2[h] += dl * act[h];
          const dh = dl * w2[h];
          gB1[h] += dh;
          const row = h * INPUT_SIZE;
          for (let i = 0; i < INPUT_SIZE; i++) gW1[row + i] += dh * x[i];
        }
      }
    }
    const n = end - start;
    for (let i = 0; i < gW1.length; i++) gW1[i] /= n;
    for (let i = 0; i < gB1.length; i++) gB1[i] /= n;
    for (let i = 0; i < gW2.length; i++) gW2[i] /= n;
    gB2 /= n;
    step++;
    adamStep(w1, gW1, aW1);
    adamStep(b1, gB1, aB1);
    adamStep(w2, gW2, aW2);
    aB2.m = B1 * aB2.m + (1 - B1) * gB2;
    aB2.v = B2 * aB2.v + (1 - B2) * gB2 * gB2;
    b2 -= (LR * (aB2.m / (1 - Math.pow(B1, step)))) / (Math.sqrt(aB2.v / (1 - Math.pow(B2, step))) + EPSA);
  }
  console.log(
    `epoch ${epoch}/${EPOCHS}: train CE ${(loss / order.length).toFixed(4)} ` +
      `(${((Date.now() - tE) / 1000).toFixed(0)}s)`,
  );
}

// --- gate evaluation ----------------------------------------------------------

/** Shipped alpha-beta state eval as a predictor: placed·1 + attach·0.5. */
function baselinePick(s: Sample): number {
  let best = -Infinity;
  let bi = 0;
  for (let ci = 0; ci < NC; ci++) {
    const v = s.rows[ci * F] * 89 * 1 + s.rows[ci * F + 1] * 40 * 0.5;
    if (v > best) {
      best = v;
      bi = ci;
    }
  }
  return bi;
}

function netPick(s: Sample): number {
  const xs = inputsOf(s);
  const scratch = new Float64Array(HIDDEN);
  let best = -Infinity;
  let bi = 0;
  for (let ci = 0; ci < NC; ci++) {
    const l = forward(xs[ci], scratch);
    if (l > best) {
      best = l;
      bi = ci;
    }
  }
  return bi;
}

function evalSet(samples: Sample[], label: string) {
  let n = 0;
  let netOk = 0;
  let baseOk = 0;
  let netOnlyOk = 0;
  let baseOnlyOk = 0;
  for (const s of samples) {
    if (s.ply < MID_LO || s.ply > MID_HI) continue;
    n++;
    const nOk = s.label[netPick(s)] > 0;
    const bOk = s.label[baselinePick(s)] > 0;
    if (nOk) netOk++;
    if (bOk) baseOk++;
    if (nOk && !bOk) netOnlyOk++;
    if (bOk && !nOk) baseOnlyOk++;
  }
  console.log(`\n${label} (plies ${MID_LO}–${MID_HI}, n=${n}):`);
  console.log(`  net      ${netOk}/${n} = ${((100 * netOk) / n).toFixed(2)}%`);
  console.log(`  baseline ${baseOk}/${n} = ${((100 * baseOk) / n).toFixed(2)}%`);
  console.log(`  discordant pairs: net-only ${netOnlyOk}, baseline-only ${baseOnlyOk}`);
  console.log(`  stats.py: python3 .claude/skills/research/stats.py ${netOk} ${n}`);
}

evalSet(test, 'HELD-OUT gate');
evalSet(train, 'train (sanity)');

// --- save ----------------------------------------------------------------------

const weights: ValueNetWeights = {
  hidden: HIDDEN,
  w1: [...w1],
  b1: [...b1],
  w2: [...w2],
  b2,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(weights));
console.log(`\nweights → ${outPath} (${w1.length + b1.length + w2.length + 1} params)`);
