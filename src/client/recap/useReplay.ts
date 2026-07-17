import { useEffect, useMemo, useState } from 'react';
import type { GameRecord } from '../../game/ai/selfplay';
import { buildRecap, type RecapFrame } from '../../game/recap';

// Auto-play (P2 R0.1): one ply per BASE_STEP_MS at 1×, faster at 2×/5×.
export type Speed = 1 | 2 | 5;
const SPEEDS: readonly Speed[] = [1, 2, 5];
const BASE_STEP_MS = 1600;

export interface Replay {
  frames: RecapFrame[];
  frame: RecapFrame;
  ply: number;
  lastPly: number;
  playing: boolean;
  speed: Speed;
  /** Jump to a ply (pauses playback so a manual seek never fights the timer). */
  seekTo: (p: number) => void;
  /** Step by ±1 ply (also pauses). */
  step: (d: number) => void;
  /** Play/pause; restarts from the top if parked at the end. */
  togglePlay: () => void;
  /** Cycle 1× → 2× → 5× → 1×. */
  cycleSpeed: () => void;
}

/**
 * Playback controller over a `GameRecord`'s recap frames — the transport shared
 * by the post-game review table (P2 R0.2). Opens parked on the final position;
 * auto-advances one ply per tick while playing and stops cleanly at the end. Pure
 * state over `buildRecap` frames — no AI/eval.
 */
export function useReplay(record: GameRecord): Replay {
  const frames = useMemo(() => buildRecap(record), [record]);
  const lastPly = frames.length - 1;
  const [ply, setPly] = useState(lastPly); // open on the final position
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const clamp = (p: number) => Math.max(0, Math.min(lastPly, p));

  const seekTo = (p: number) => {
    setPlaying(false);
    setPly(clamp(p));
  };
  const step = (d: number) => {
    setPlaying(false);
    setPly((p) => clamp(p + d));
  };
  const togglePlay = () => {
    setPly((p) => (p >= lastPly ? 0 : p));
    setPlaying((pl) => !pl);
  };
  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);

  // Auto-advance while playing; the timer rate scales with the chosen speed.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setPly((p) => clamp(p + 1)), BASE_STEP_MS / speed);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, lastPly]);

  // Stop cleanly when playback reaches the final position.
  useEffect(() => {
    if (playing && ply >= lastPly) setPlaying(false);
  }, [playing, ply, lastPly]);

  return {
    frames,
    frame: frames[ply],
    ply,
    lastPly,
    playing,
    speed,
    seekTo,
    step,
    togglePlay,
    cycleSpeed,
  };
}
