import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Tween duration for the rolling count (ms). */
const DURATION = 420;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that rolls to its new value instead of snapping — the live
 * score/remaining-square feedback and the game-over count-up (P16). Renders the
 * exact `value` on first paint (SSR-correct), animates only on change, and
 * respects `prefers-reduced-motion` by jumping straight to the target.
 */
export function CountUp({
  value,
  style,
  testId,
}: {
  value: number;
  style?: CSSProperties;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  // Mirror of the shown value so a mid-tween change interpolates from where the
  // digits visibly are, not from a stale target.
  const displayRef = useRef(value);
  displayRef.current = display;

  useEffect(() => {
    const from = displayRef.current;
    if (reduce || from === value) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setDisplay(Math.round(from + (value - from) * easeOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return (
    <span data-testid={testId} style={style}>
      {display}
    </span>
  );
}
