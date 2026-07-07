import { useEffect, useRef, useState } from 'react';
import type { Color, GameState } from '../../game/types';
import { newlyStuckColors, outOfMovesText } from '../drama';

/** A transient on-board announcement (currently: a color running out of moves). */
export interface Beat {
  id: number;
  color: Color;
  text: string;
}

/** How long an out-of-moves beat stays on screen before fading out (ms). */
const BEAT_TTL = 2800;

/**
 * Watches game state for the moments P16 gives ceremony to and surfaces them as
 * transient "beats". Today that's a color transitioning to stuck ("X is out of
 * moves"); the same detector is where P7 (sound) will hang its cues. Beats
 * self-expire; timers are cleared only on unmount so a fresh placement within
 * the TTL window never strands an earlier beat.
 */
export function useGameEvents(G: GameState): { beats: Beat[] } {
  const prevRef = useRef<GameState>(G);
  const idRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = G;
    if (prev === G) return; // initial mount / no change
    const stuck = newlyStuckColors(prev, G);
    if (stuck.length === 0) return;

    const added: Beat[] = stuck.map((color) => ({
      id: ++idRef.current,
      color,
      text: outOfMovesText(color),
    }));
    setBeats((b) => [...b, ...added]);

    const ids = new Set(added.map((a) => a.id));
    const timer = setTimeout(() => {
      setBeats((b) => b.filter((x) => !ids.has(x.id)));
    }, BEAT_TTL);
    timersRef.current.push(timer);
  }, [G]);

  return { beats };
}
