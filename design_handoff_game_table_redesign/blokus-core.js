// blokus-core.js — engine-mirror helpers ported from open-blokus (src/game/*) plus
// presentation helpers (region path building, skeuomorphic SVG finish) used by the
// design docs. Rules match GAME_SPEC.md exactly so generated boards are legal.

export const BOARD_SIZE = 20;
export const COLOR_ORDER = ['blue', 'yellow', 'red', 'green'];
export const CORNERS = {
  blue: { x: 0, y: 0 },
  yellow: { x: 19, y: 0 },
  red: { x: 19, y: 19 },
  green: { x: 0, y: 19 },
};

// Base cells, verbatim from src/game/pieces.ts (canonical order).
export const PIECES = {
  I1: [[0, 0]],
  I2: [[0, 0], [1, 0]],
  I3: [[0, 0], [1, 0], [2, 0]],
  V3: [[0, 0], [0, 1], [1, 1]],
  I4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T4: [[0, 0], [1, 0], [2, 0], [1, 1]],
  L4: [[0, 0], [0, 1], [0, 2], [1, 2]],
  S4: [[1, 0], [2, 0], [0, 1], [1, 1]],
  F5: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  I5: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  L5: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
  N5: [[1, 0], [0, 1], [1, 1], [0, 2], [0, 3]],
  P5: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
  T5: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
  U5: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  V5: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  W5: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
  X5: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  Y5: [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
  Z5: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
};
export const PIECE_IDS = Object.keys(PIECES);

export const pieceSize = (id) => PIECES[id].length;
export const idx = (x, y) => y * BOARD_SIZE + x;
export const inBounds = (x, y) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

const normalize = (cells) => {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
};
const rotate90 = (cells) => cells.map(([x, y]) => [-y, x]);
const reflect = (cells) => cells.map(([x, y]) => [-x, y]);
const key = (cells) =>
  cells
    .slice()
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map((c) => c.join(','))
    .join('|');

const orientCache = new Map();
export function getOrientations(id) {
  if (orientCache.has(id)) return orientCache.get(id);
  const seen = new Map();
  for (const start of [PIECES[id], reflect(PIECES[id])]) {
    let cells = start;
    for (let r = 0; r < 4; r++) {
      const norm = normalize(cells);
      seen.set(key(norm), norm);
      cells = rotate90(cells);
    }
  }
  const out = [...seen.values()];
  orientCache.set(id, out);
  return out;
}

/** Resolve {pieceId, rotation, reflected, x, y} to absolute [x,y] cells. */
export function resolveCells(p) {
  let cells = PIECES[p.pieceId];
  if (p.reflected) cells = reflect(cells);
  for (let r = 0; r < p.rotation; r++) cells = rotate90(cells);
  return normalize(cells).map(([x, y]) => [x + p.x, y + p.y]);
}

export function freshState() {
  const colors = {};
  for (const c of COLOR_ORDER)
    colors[c] = { remaining: [...PIECE_IDS], lastPlaced: null, hasStarted: false, stuck: false };
  return {
    board: Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null),
    colors,
    lastMove: [],
  };
}

/** GAME_SPEC §4 legality (piece availability checked by callers' iteration). */
export function isLegalCells(state, color, cells) {
  const cs = state.colors[color];
  for (const [x, y] of cells) {
    if (!inBounds(x, y)) return false;
    if (state.board[idx(x, y)] !== null) return false;
  }
  for (const [x, y] of cells) {
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (inBounds(nx, ny) && state.board[idx(nx, ny)] === color) return false;
    }
  }
  if (!cs.hasStarted) {
    const k = CORNERS[color];
    return cells.some(([x, y]) => x === k.x && y === k.y);
  }
  for (const [x, y] of cells) {
    for (const [nx, ny] of [[x + 1, y + 1], [x + 1, y - 1], [x - 1, y + 1], [x - 1, y - 1]]) {
      if (inBounds(nx, ny) && state.board[idx(nx, ny)] === color) return true;
    }
  }
  return false;
}

/** All legal moves for a color: [{pieceId, cells}] (anchor-based, deduped). */
export function enumerateMoves(state, color) {
  const cs = state.colors[color];
  const anchors = [];
  if (!cs.hasStarted) {
    anchors.push([CORNERS[color].x, CORNERS[color].y]);
  } else {
    for (let y = 0; y < BOARD_SIZE; y++)
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (state.board[idx(x, y)] !== null) continue;
        let diag = false;
        for (const [nx, ny] of [[x + 1, y + 1], [x + 1, y - 1], [x - 1, y + 1], [x - 1, y - 1]])
          if (inBounds(nx, ny) && state.board[idx(nx, ny)] === color) diag = true;
        if (diag) anchors.push([x, y]);
      }
  }
  const out = [];
  const seen = new Set();
  for (const pieceId of cs.remaining) {
    for (const orient of getOrientations(pieceId)) {
      for (const [ax, ay] of anchors) {
        for (const [cx, cy] of orient) {
          const ox = ax - cx;
          const oy = ay - cy;
          const cells = orient.map(([x, y]) => [x + ox, y + oy]);
          const k = pieceId + ':' + key(cells);
          if (seen.has(k)) continue;
          seen.add(k);
          if (isLegalCells(state, color, cells)) out.push({ pieceId, cells });
        }
      }
    }
  }
  return out;
}

export function applyMove(state, color, pieceId, cells) {
  const indices = cells.map(([x, y]) => idx(x, y));
  for (const i of indices) state.board[i] = color;
  state.lastMove = indices;
  const cs = state.colors[color];
  cs.remaining = cs.remaining.filter((p) => p !== pieceId);
  cs.lastPlaced = pieceId;
  cs.hasStarted = true;
}

export function remainingSquares(state, color) {
  return state.colors[color].remaining.reduce((s, p) => s + pieceSize(p), 0);
}

/** Deterministic PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Play `totalMoves` greedy moves (big pieces, march toward center) so design docs
 * show a realistic, fully legal mid-game position. Deterministic per seed.
 */
export function generateMidgame(seed, totalMoves) {
  const state = freshState();
  const rng = mulberry32(seed);
  const cx = (BOARD_SIZE - 1) / 2;
  let made = 0;
  let ci = 0;
  let guard = 0;
  while (made < totalMoves && guard++ < 200) {
    const color = COLOR_ORDER[ci % 4];
    ci++;
    if (state.colors[color].stuck) {
      if (COLOR_ORDER.every((c) => state.colors[c].stuck)) break;
      continue;
    }
    const moves = enumerateMoves(state, color);
    if (moves.length === 0) {
      state.colors[color].stuck = true;
      continue;
    }
    let best = null;
    let bestScore = -Infinity;
    for (const m of moves) {
      const mx = m.cells.reduce((s, c) => s + c[0], 0) / m.cells.length;
      const my = m.cells.reduce((s, c) => s + c[1], 0) / m.cells.length;
      const d = Math.hypot(mx - cx, my - cx);
      const score = m.cells.length * 100 - d * 7 + rng() * 46;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    applyMove(state, color, best.pieceId, best.cells);
    made++;
  }
  state.turn = made + 1;
  return state;
}

/* ---------------- presentation helpers ---------------- */

/** Silhouette paths for an arbitrary cell set at cell size C (px). */
export function regionPaths(cells, C) {
  const set = new Set(cells.map((c) => c[0] + ',' + c[1]));
  const has = (x, y) => set.has(x + ',' + y);
  let fillD = '';
  let highlightD = '';
  let shadowD = '';
  for (const [x, y] of cells) {
    const px = x * C;
    const py = y * C;
    fillD += `M${px} ${py}h${C}v${C}h${-C}z`;
    if (!has(x, y - 1)) highlightD += `M${px} ${py}h${C}`;
    if (!has(x - 1, y)) highlightD += `M${px} ${py}v${C}`;
    if (!has(x, y + 1)) shadowD += `M${px} ${py + C}h${C}`;
    if (!has(x + 1, y)) shadowD += `M${px + C} ${py}v${C}`;
  }
  return { fillD, highlightD, shadowD, outlineD: highlightD + shadowD };
}

/** Connected same-color components → one region per placed piece (port of PlacedLayer). */
export function buildRegions(board, C, hexOf) {
  const n = BOARD_SIZE;
  const colorAt = (i) => (i >= 0 && i < board.length ? board[i] : null);
  const visited = new Uint8Array(board.length);
  const regions = [];
  for (let i = 0; i < board.length; i++) {
    const color = colorAt(i);
    if (!color || visited[i]) continue;
    const cells = [];
    const stack = [i];
    visited[i] = 1;
    while (stack.length) {
      const c = stack.pop();
      cells.push([c % n, (c / n) | 0]);
      const x = c % n;
      const y = (c / n) | 0;
      const nbrs = [];
      if (x > 0) nbrs.push(c - 1);
      if (x < n - 1) nbrs.push(c + 1);
      if (y > 0) nbrs.push(c - n);
      if (y < n - 1) nbrs.push(c + n);
      for (const m of nbrs)
        if (!visited[m] && colorAt(m) === color) {
          visited[m] = 1;
          stack.push(m);
        }
    }
    const paths = regionPaths(cells, C);
    regions.push({ color, hex: hexOf ? hexOf(color) : undefined, ...paths });
  }
  return regions;
}

/**
 * Skeuomorphic placed-piece finish as a React SVG element (translucent fill, contact
 * shadow, top-down volume, per-piece bevel, gloss, grain — evolved from the repo's
 * PlacedLayer). Generated art layer; surfaces around it stay editable.
 * cfg: {React, C, size, suffix, regions, overlay, base:{matStyle, gridD, gridStyle,
 *       borderStyle}, ghost:{fillD, outlineD, hex}, lastRects:[{x,y,w}], lastStroke}
 */
export function buildFinishElement(cfg) {
  const { React, size, suffix: S, regions } = cfg;
  const h = React.createElement;
  const defs = h(
    'defs',
    { key: 'defs' },
    h(
      'linearGradient',
      { key: 'vol', id: `vol-${S}`, x1: 0, y1: 0, x2: 0, y2: size, gradientUnits: 'userSpaceOnUse' },
      h('stop', { key: 1, offset: 0, stopColor: '#ffffff', stopOpacity: 0.3 }),
      h('stop', { key: 2, offset: 0.45, stopColor: '#ffffff', stopOpacity: 0 }),
      h('stop', { key: 3, offset: 1, stopColor: '#000000', stopOpacity: 0.14 }),
    ),
    h(
      'filter',
      { key: 'sh', id: `sh-${S}`, x: '-5%', y: '-5%', width: '110%', height: '110%' },
      h('feDropShadow', { dx: 0, dy: 0.8, stdDeviation: 1.1, floodColor: '#000000', floodOpacity: 0.35 }),
    ),
    h(
      'filter',
      { key: 'gr', id: `gr-${S}`, x: '0', y: '0', width: '100%', height: '100%' },
      h('feTurbulence', {
        key: 1, type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, stitchTiles: 'stitch', result: 'noise',
      }),
      h('feColorMatrix', { key: 2, in: 'noise', type: 'saturate', values: '0' }),
    ),
    h(
      'filter',
      { key: 'gl', id: `gl-${S}`, x: '-10%', y: '-10%', width: '120%', height: '120%' },
      h('feGaussianBlur', { key: 1, in: 'SourceAlpha', stdDeviation: 2.5, result: 'glossBlur' }),
      h(
        'feSpecularLighting',
        {
          key: 2, in: 'glossBlur', surfaceScale: 4, specularConstant: 0.75, specularExponent: 16,
          lightingColor: '#ffffff', result: 'glossSpec',
        },
        h('feDistantLight', { azimuth: 235, elevation: 62 }),
      ),
      h('feComposite', { key: 3, in: 'glossSpec', in2: 'SourceAlpha', operator: 'in' }),
    ),
    h('clipPath', { key: 'all', id: `all-${S}` }, h('path', { d: cfg.allD })),
    ...regions.map((r, i) => h('clipPath', { key: 'c' + i, id: `r-${S}-${i}` }, h('path', { d: r.fillD }))),
  );

  const kids = [defs];
  if (cfg.base) {
    kids.push(h('rect', { key: 'mat', width: size, height: size, style: cfg.base.matStyle }));
    if (cfg.base.gridD)
      kids.push(h('path', { key: 'grid', d: cfg.base.gridD, fill: 'none', strokeWidth: 1, style: cfg.base.gridStyle }));
    if (cfg.base.borderStyle)
      kids.push(h('rect', {
        key: 'gb', x: 0.5, y: 0.5, width: size - 1, height: size - 1, fill: 'none', strokeWidth: 1, style: cfg.base.borderStyle,
      }));
  }
  kids.push(
    h('g', { key: 'fills', filter: `url(#sh-${S})` },
      regions.map((r, i) => h('path', { key: i, d: r.fillD, fill: r.hex, fillOpacity: 0.93 }))),
    h('rect', { key: 'vol', width: size, height: size, fill: `url(#vol-${S})`, clipPath: `url(#all-${S})` }),
    ...regions.map((r, i) =>
      h('g', { key: 'bv' + i, clipPath: `url(#r-${S}-${i})` },
        h('path', { key: 1, d: r.highlightD, fill: 'none', stroke: '#ffffff', strokeOpacity: 0.55, strokeWidth: 3 }),
        h('path', { key: 2, d: r.shadowD, fill: 'none', stroke: '#000000', strokeOpacity: 0.35, strokeWidth: 3 }),
        h('path', { key: 3, d: r.highlightD + r.shadowD, fill: 'none', stroke: '#ffffff', strokeOpacity: 0.22, strokeWidth: 1.2 }),
      )),
    h('path', { key: 'gloss', d: cfg.allD, fill: '#000000', filter: `url(#gl-${S})`, opacity: 0.85 }),
    h('rect', { key: 'grain', width: size, height: size, filter: `url(#gr-${S})`, clipPath: `url(#all-${S})`, opacity: 0.055 }),
  );
  if (cfg.lastRects)
    kids.push(...cfg.lastRects.map((r, i) =>
      h('rect', {
        key: 'lm' + i, x: r.x, y: r.y, width: r.w, height: r.w, fill: 'none', strokeWidth: 3,
        style: { stroke: cfg.lastStroke },
      })));
  if (cfg.ghost)
    kids.push(
      h('g', { key: 'ghost' },
        h('path', { key: 1, d: cfg.ghost.fillD, fill: cfg.ghost.hex, fillOpacity: 0.38 }),
        h('path', {
          key: 2, d: cfg.ghost.outlineD, fill: 'none', stroke: cfg.ghost.hex, strokeWidth: 2.5,
          strokeDasharray: '7 5', strokeLinecap: 'round',
        }),
      ));

  return h('svg', {
    width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': true,
    style: cfg.overlay ? { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' } : { display: 'block' },
  }, kids);
}

/** Inner grid lines path for an n×n board at cell size C. */
export function gridPathD(C, n = BOARD_SIZE) {
  let d = '';
  const size = n * C;
  for (let i = 1; i < n; i++) d += `M${i * C} 0V${size}M0 ${i * C}H${size}`;
  return d;
}

/** Flat board indices → last-move ring rects at cell size C. */
export function lastMoveRects(lastMove, C) {
  return (lastMove || []).map((i) => ({
    x: (i % BOARD_SIZE) * C + 1.5,
    y: ((i / BOARD_SIZE) | 0) * C + 1.5,
    w: C - 3,
  }));
}

/** Base-shape thumbnail data for a piece: {w, h, cells:[{on}]} row-major. */
export function thumbGrid(id) {
  const cells = PIECES[id];
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const hgt = Math.max(...cells.map((c) => c[1])) + 1;
  const on = new Set(cells.map((c) => c[0] + ',' + c[1]));
  const out = [];
  for (let y = 0; y < hgt; y++)
    for (let x = 0; x < w; x++) out.push({ on: on.has(x + ',' + y) });
  return { w, h: hgt, cells: out };
}
