import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../game/types';
import type { GameOverPayload } from '../controls/GameOverModal';
import { recordGameResult, type GameResult, type Milestone } from './progression';

/** Minimal boardgame.io client surface the recorder needs (keeps it testable). */
export interface ProgressionClient {
  getState(): { G: GameState; ctx: { gameover?: unknown } } | null;
  subscribe(fn: () => void): () => void;
}

/**
 * Records each finished game into progression exactly once and surfaces any
 * newly-unlocked milestones as toasts. `deriveResult` maps the final state to a
 * `GameResult` (or null to skip — e.g. an all-AI watch game with no local player).
 *
 * Idempotency across React StrictMode's mount→cleanup→mount (and any re-subscribe)
 * keys off the gameover payload object, which is stable for a finished game and
 * changes on client.reset() (Play Again) → a new game records again. Recording is
 * deduped at module scope (`recordedUnlocks`); the toast is shown once per surviving
 * component instance via `shownForRef`, so the toast still appears even when the
 * first StrictMode mount is the one that did the recording.
 */
const recordedUnlocks = new WeakMap<object, Milestone[]>();

export function useProgressionRecorder(
  client: ProgressionClient,
  deriveResult: (G: GameState, gameover: GameOverPayload) => GameResult | null,
): { toasts: Milestone[]; dismiss: () => void } {
  const [toasts, setToasts] = useState<Milestone[]>([]);
  const deriveRef = useRef(deriveResult);
  deriveRef.current = deriveResult;
  const shownForRef = useRef<object | null>(null);

  useEffect(() => {
    const handle = () => {
      const s = client.getState();
      const over = s?.ctx.gameover;
      if (!s || !over || typeof over !== 'object') return;

      // Record once per finished game (module-scoped, StrictMode-safe).
      if (!recordedUnlocks.has(over)) {
        const result = deriveRef.current(s.G, over as GameOverPayload);
        recordedUnlocks.set(over, result ? recordGameResult(result) : []);
      }

      // Show its toasts once on this instance (surviving mount wins).
      if (shownForRef.current !== over) {
        shownForRef.current = over;
        const unlocked = recordedUnlocks.get(over) ?? [];
        setToasts(unlocked);
      }
    };

    const unsub = client.subscribe(handle);
    handle(); // a game already over at attach time (e.g. remount) still surfaces
    return unsub;
  }, [client]);

  return { toasts, dismiss: () => setToasts([]) };
}
