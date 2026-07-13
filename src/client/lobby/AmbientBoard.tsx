import { useEffect, useMemo, useState } from 'react';
import type { Color } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PlacedLayer } from '../board/PlacedLayer';
import { AMBIENT_GAMES } from './ambientGames';

/** One move every ~1.4s — slow enough to watch, quick enough to feel alive. */
const MOVE_MS = 1400;
/** Beat on the finished position before the board clears. */
const HOLD_MS = 2600;
const FADE_MS = 800;
/**
 * Each game opens already dealt to this ply, instantly and without a settle flash.
 * Playing from move 0 would greet every visitor with an empty board and one lonely
 * corner piece — a worse front door than the static developed position this replaced.
 * The opening is the least interesting part of a Blokus game anyway; the door opens
 * colorful and *then* starts moving.
 */
const START_PLY = 24;

const FULL_PX = BOARD_SIZE * CELL_PX;

/**
 * The front door's living board (P29 M2): it plays itself by replaying precomputed
 * heuristic self-play games (`ambientGames.ts`) one move at a time, then holds on the
 * finished position, fades, and starts the next.
 *
 * **No engine at runtime** — the games ship as resolved cell lists, so this carries no
 * move generator and no bot into the initial bundle, and it's deterministic. Placement
 * reuses the shipped `ob-settle` flash by handing PlacedLayer the newest move as
 * `lastMove`, so pieces slot in exactly the way they do in a real game.
 *
 * Purely decorative and non-interactive. Under `prefers-reduced-motion` it runs no
 * timers at all and simply shows a finished game.
 */
export function AmbientBoard({ size = 260 }: { size?: number }) {
  const reduce = useReducedMotion();
  const [gameIndex, setGameIndex] = useState(0);
  const [ply, setPly] = useState(START_PLY);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduce) return; // static finished position; nothing to schedule
    const game = AMBIENT_GAMES[gameIndex];

    if (ply < game.moves.length) {
      const t = setTimeout(() => setPly((p) => p + 1), MOVE_MS);
      return () => clearTimeout(t);
    }
    // Game over: hold on the full board, fade it out, then bring up the next one.
    const hold = setTimeout(() => setVisible(false), HOLD_MS);
    const next = setTimeout(() => {
      setGameIndex((g) => (g + 1) % AMBIENT_GAMES.length);
      setPly(START_PLY);
      setVisible(true);
    }, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(hold);
      clearTimeout(next);
    };
  }, [gameIndex, ply, reduce]);

  const { board, lastMove, shown } = useMemo(() => {
    const game = AMBIENT_GAMES[reduce ? 0 : gameIndex];
    const upTo = reduce ? game.moves.length : ply;
    const b: (Color | null)[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);
    for (let i = 0; i < upTo; i++) {
      const [colorIndex, cells] = game.moves[i];
      for (const idx of cells) b[idx] = COLOR_ORDER[colorIndex];
    }
    return {
      board: b,
      // Only a move we actually *played* settles — the dealt-in opening and the
      // reduced-motion still frame arrive already on the board, so they don't flash.
      lastMove: !reduce && upTo > START_PLY ? game.moves[upTo - 1][1] : undefined,
      shown: upTo,
    };
  }, [gameIndex, ply, reduce]);

  const scale = size / FULL_PX;

  return (
    <div
      aria-hidden="true"
      data-testid="ambient-board"
      data-moves={shown}
      style={{
        width: size,
        height: size,
        flex: '0 0 auto',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: reduce ? undefined : `opacity ${FADE_MS}ms ease-in-out`,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: FULL_PX,
          height: FULL_PX,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: 'var(--mat)',
          backgroundImage: `repeating-linear-gradient(0deg, var(--grid) 0 1px, transparent 1px ${CELL_PX}px), repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px ${CELL_PX}px)`,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px var(--pnl-bd)',
        }}
      >
        <PlacedLayer board={board} lastMove={lastMove} />
      </div>
    </div>
  );
}
