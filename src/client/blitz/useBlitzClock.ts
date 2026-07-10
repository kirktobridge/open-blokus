import { useEffect, useRef, useState } from 'react';
import type { BlitzSeconds } from './blitz';

/** How often the countdown re-renders. Fine enough for a tenths-of-a-second read. */
const TICK_MS = 100;

/**
 * Per-move countdown for blitz (P20 M1). Runs only while `running` (a human seat
 * is on the clock); each new `turnKey` restarts it from the full limit.
 *
 * `onExpire` fires at most once per turn — the ref keeps a fresh callback without
 * restarting the clock when the parent re-renders. Returns remaining ms, or null
 * when no clock is running (so callers render nothing).
 */
export function useBlitzClock({
  seconds,
  running,
  turnKey,
  onExpire,
}: {
  seconds: BlitzSeconds;
  running: boolean;
  /** Changes exactly once per turn (the client's stateID). */
  turnKey: number;
  onExpire: () => void;
}): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (seconds == null || !running) {
      setRemainingMs(null);
      return;
    }

    const limitMs = seconds * 1000;
    const deadline = Date.now() + limitMs;
    setRemainingMs(limitMs);

    let fired = false;
    const id = setInterval(() => {
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left > 0 || fired) return;
      // Stop before dispatching: the move flips `running`, but the expiry must not
      // be able to fire twice if that unmount lands a tick late.
      fired = true;
      clearInterval(id);
      onExpireRef.current();
    }, TICK_MS);

    return () => clearInterval(id);
  }, [seconds, running, turnKey]);

  return running && seconds != null ? remainingMs : null;
}
