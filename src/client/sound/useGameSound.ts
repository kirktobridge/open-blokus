import { useEffect, useRef } from 'react';
import type { GameState } from '../../game/types';
import { detectPlacement } from '../drama';
import type { Beat } from '../hooks/useGameEvents';
import { BLITZ_URGENT_MS } from '../blitz/blitz';
import { configureSound, play } from './engine';
import { usePrefs } from '../settings';

/**
 * When each cue fires (P7). The *what* is `cues.ts`, the *how* is `engine.ts`; this is
 * the only place that knows the game.
 *
 * It deliberately does **not** re-run the detectors: `useGameEvents` already diffed this
 * ply, so sound consumes the resulting beat stream (each beat has a monotonic id — play
 * every id we haven't yet). That makes sound exactly the consumer `docs/EVENTS.md`
 * describes — keyed off event ids, with P32's anti-spam (one beat per color per ply)
 * inherited for free, so the audio can't chatter even if the board is dramatic.
 *
 * The three non-event cues come from state this hook can see directly: picking a piece
 * up, a piece landing (`G.lastMove`), and the blitz clock's final seconds.
 */
export function useGameSound({
  G,
  beats,
  selectedPieceId,
  blitzRemainingMs,
}: {
  G: GameState;
  beats: Beat[];
  /** Currently lifted piece, or null — the pickup click. */
  selectedPieceId: string | null;
  /** Live blitz countdown; null/absent when no clock runs. */
  blitzRemainingMs?: number | null;
}): void {
  const prefs = usePrefs();
  const prevG = useRef<GameState>(G);
  const lastBeat = useRef(0);
  const prevPiece = useRef<string | null>(selectedPieceId);
  const lastTick = useRef<number | null>(null);

  // Prefs flow one way into the engine; nothing else reads them.
  useEffect(() => {
    configureSound({ enabled: prefs.sound, volume: prefs.volume });
  }, [prefs.sound, prefs.volume]);

  // The clack: a piece landed. Pitch drops with the piece's size (cues.ts).
  useEffect(() => {
    const prev = prevG.current;
    prevG.current = G;
    if (prev === G) return; // initial mount / no change
    const placement = detectPlacement(prev, G);
    if (placement) play('place', placement.size);
  }, [G]);

  // The vocabulary: one cue per newly-announced beat, in the order P32 ranked them.
  useEffect(() => {
    for (const beat of beats) {
      if (beat.id <= lastBeat.current) continue;
      lastBeat.current = beat.id;
      play(beat.kind);
    }
  }, [beats]);

  // The click: a piece lifted off the tray. Dropping one back makes no sound.
  useEffect(() => {
    const prev = prevPiece.current;
    prevPiece.current = selectedPieceId;
    if (selectedPieceId && selectedPieceId !== prev) play('select');
  }, [selectedPieceId]);

  // Blitz (P24's reserved seat): a tick per whole second inside the urgent window.
  // Keyed on the second itself, not the render — the clock re-renders ~10× a second.
  useEffect(() => {
    if (blitzRemainingMs == null || blitzRemainingMs > BLITZ_URGENT_MS) {
      lastTick.current = null;
      return;
    }
    const second = Math.ceil(blitzRemainingMs / 1000);
    if (second <= 0 || second === lastTick.current) return;
    lastTick.current = second;
    play('blitz-tick');
  }, [blitzRemainingMs]);
}
