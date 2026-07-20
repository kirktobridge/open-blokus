import { useEffect, useRef, useState } from 'react';
import type { Cell, Color, GameState } from '../../game/types';
import { detectEvents } from '../drama';
import type { EventId } from '../drama';

/** A transient on-board announcement — one detected `DramaEvent`, given a lifetime. */
export interface Beat {
  id: number;
  kind: EventId;
  /** Subject color; null for board-wide beats (endgame). */
  color: Color | null;
  text: string;
  /** `cut` only: the attach points the placement destroyed (board highlight). */
  lostCells?: Cell[];
}

/** How long a beat stays on screen before fading out (ms). */
const BEAT_TTL = 2800;

/**
 * Watches game state for the moments P16 gives ceremony to and surfaces them as
 * transient "beats". The vocabulary itself lives in `drama.ts` / `docs/EVENTS.md`
 * (P32); this hook only gives events a lifetime. It's the same seam P7 (sound) hangs
 * its cues on. Beats self-expire; timers are cleared only on unmount so a fresh
 * placement within the TTL window never strands an earlier beat.
 */
export function useGameEvents(G: GameState): { beats: Beat[]; log: Beat[] } {
  const prevRef = useRef<GameState>(G);
  const idRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  // Append-only history for the persistent event feed (P43): the same detected
  // events as `beats`, but they never expire, so a player who looked away can scroll
  // back through the game's narrative. One detection seam feeds both — the feed
  // inherits P32's anti-spam for free and re-runs no detectors.
  const [log, setLog] = useState<Beat[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = G;
    if (prev === G) return; // initial mount / no change
    const events = detectEvents(prev, G);
    if (events.length === 0) return;

    const added: Beat[] = events.map((e) => ({
      id: ++idRef.current,
      kind: e.kind,
      color: e.color,
      text: e.text,
      lostCells: e.lostCells,
    }));
    setBeats((b) => [...b, ...added]);
    setLog((l) => [...l, ...added]);

    const ids = new Set(added.map((a) => a.id));
    const timer = setTimeout(() => {
      setBeats((b) => b.filter((x) => !ids.has(x.id)));
    }, BEAT_TTL);
    timersRef.current.push(timer);
  }, [G]);

  return { beats, log };
}
