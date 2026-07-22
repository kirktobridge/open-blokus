/**
 * Async arena that pits our strategies against Pentobi over GTP (AE19).
 *
 * Separate from the standing synchronous arena (`../arena.ts`, a frozen baseline)
 * because talking to the subprocess is inherently async. Our GameState `G` is the
 * single source of truth: every move — ours or Pentobi's — is applied to `G` via
 * `applyPlacement`, and the winner comes from `finalScores(G)`. Pentobi's board is
 * kept in lock-step (its own `genmove` auto-applies its moves; we `play` ours into
 * it) purely so it can reason; we never trust its scoring. Because each Pentobi
 * move must resolve to one of our legal moves (`moveToPlacement`), every bridged
 * game is replay-verified against our rules core for free.
 */
import { COLOR_ORDER } from '../../types';
import type { Color, GameState } from '../../types';
import { colorStateOf, createInitialState } from '../../modes';
import { resolveCells } from '../../pieces';
import { applyPlacement } from '../../placement';
import { generateLegalMoves } from '../../moves';
import { finalScores } from '../../scoring';
import { mulberry32 } from '../arena';
import type { Strategy } from '../arena';
import { GtpEngine } from './gtp';
import { isPass, moveToPlacement, placementToMove } from './coords';

/** A tournament seat: either one of our local strategies or a Pentobi level. */
export type Seat =
  | { kind: 'local'; name: string; strategy: Strategy }
  | { kind: 'pentobi'; name: string; level: number };

/** Mirrors arena.advanceActiveColor / BlokusGame.advanceActiveColor. */
function advanceActiveColor(G: GameState): void {
  for (let step = 1; step <= COLOR_ORDER.length; step++) {
    const i = (G.activeColorIndex + step) % COLOR_ORDER.length;
    if (!colorStateOf(G, COLOR_ORDER[i]).stuck) {
      G.activeColorIndex = i;
      return;
    }
  }
}

/**
 * Play one 4p Classic game. `byColor` maps each color to its seat; `engineByColor`
 * gives the live Pentobi process for each Pentobi-seated color (already
 * `clear_board`ed + seeded for this game); local colors are absent. Returns the
 * final-scores payload from our rules core.
 */
export async function playGameVsPentobi(
  byColor: Record<Color, Seat>,
  engineByColor: Partial<Record<Color, GtpEngine>>,
  rng: () => number,
): Promise<ReturnType<typeof finalScores>> {
  const G = createInitialState(4, 'basic');
  let live = COLOR_ORDER.length;

  while (live > 0) {
    const color = COLOR_ORDER[G.activeColorIndex];
    const seat = byColor[color];

    let placement = null as ReturnType<typeof moveToPlacement> | null;
    if (seat.kind === 'pentobi') {
      const engine = engineByColor[color]!;
      const mv = await engine.genmove(color);
      if (isPass(mv)) {
        // Pentobi has no move. With --noresign this means genuinely stuck; our
        // rules core must agree, else the boards have desynced (bridge bug).
        if (generateLegalMoves(G, color).length > 0) {
          throw new Error(`Pentobi passed ${color} but our engine has legal moves (desync)`);
        }
        placement = null;
      } else {
        placement = moveToPlacement(G, color, mv); // throws on mismatch (replay-verify)
      }
    } else {
      placement = seat.strategy(G, color, rng);
      // Keep every Pentobi engine's board in sync with our move.
      if (placement) {
        const move = placementToMove(placement);
        for (const eng of distinctEngines(engineByColor)) await eng.play(color, move);
      }
    }

    if (placement) {
      applyPlacement(G, color, placement.pieceId, resolveCells(placement));
    } else {
      colorStateOf(G, color).stuck = true;
      live--;
    }
    advanceActiveColor(G);
  }
  return finalScores(G);
}

/** Unique engine processes among the per-color map (dedupe shared processes). */
function distinctEngines(engineByColor: Partial<Record<Color, GtpEngine>>): GtpEngine[] {
  return [...new Set(Object.values(engineByColor).filter((e): e is GtpEngine => !!e))];
}

export interface VsPentobiResult {
  /** Wins credited to each seat name (ties split evenly). */
  wins: Record<string, number>;
  /** Games each name participated in. */
  played: Record<string, number>;
  games: number;
  ties: number;
}

/** In 4p each color owns playerID = its turn-order index. */
function seatPosOf(color: Color): number {
  return COLOR_ORDER.indexOf(color);
}

/**
 * Run `games` matches among four seats, rotating which color each seat occupies
 * so first-move advantage is shared. One Pentobi process is created per distinct
 * level present in the seats and reused across games (Pentobi is stateless about
 * turn order, so one process can play whichever colors are its level this game).
 * Seeded per game for reproducibility.
 */
export async function runVsPentobi(
  seats: Seat[],
  opts: { games: number; seed: number; binPath: string; threads?: number },
): Promise<VsPentobiResult> {
  const n = COLOR_ORDER.length;
  if (seats.length !== n) throw new Error(`need ${n} seats, got ${seats.length}`);

  const levels = [
    ...new Set(seats.filter((s): s is Extract<Seat, { kind: 'pentobi' }> => s.kind === 'pentobi').map((s) => s.level)),
  ];
  const engines = new Map<number, GtpEngine>();
  for (const lvl of levels) {
    engines.set(lvl, new GtpEngine({ binPath: opts.binPath, level: lvl, threads: opts.threads }));
  }

  const rng = mulberry32(opts.seed);
  const wins: Record<string, number> = {};
  const played: Record<string, number> = {};
  let ties = 0;
  for (const s of seats) {
    wins[s.name] ??= 0;
    played[s.name] ??= 0;
  }

  try {
    for (let g = 0; g < opts.games; g++) {
      const seatName: Record<Color, string> = {} as Record<Color, string>;
      const byColor: Record<Color, Seat> = {} as Record<Color, Seat>;
      const engineByColor: Partial<Record<Color, GtpEngine>> = {};
      seats.forEach((s, i) => {
        const color = COLOR_ORDER[(i + g) % n];
        seatName[color] = s.name;
        byColor[color] = s;
        if (s.kind === 'pentobi') engineByColor[color] = engines.get(s.level)!;
      });
      for (const s of seats) played[s.name] += 1;

      // Reset + reseed every engine for this game.
      const gameSeed = ((opts.seed * 1_000_003) ^ (g + 1)) >>> 0;
      for (const [, eng] of engines) {
        await eng.clearBoard();
        await eng.setSeed(gameSeed);
      }

      const { winners } = await playGameVsPentobi(byColor, engineByColor, rng);

      const winColors = COLOR_ORDER.filter((c) => winners.includes(String(seatPosOf(c))));
      if (winColors.length !== 1) ties += 1;
      const share = winColors.length ? 1 / winColors.length : 0;
      for (const c of winColors) wins[seatName[c]] += share;
    }
  } finally {
    for (const [, eng] of engines) await eng.quit();
  }

  return { wins, played, games: opts.games, ties };
}
