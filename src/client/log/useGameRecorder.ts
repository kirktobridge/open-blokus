import { useEffect, useRef } from 'react';
import type { GameRecord } from '../../game/ai/selfplay';
import { attachRecorder, type RecorderClient, type RecorderHeader } from './recorder';

/**
 * Attach the game recorder to a boardgame.io client for its lifetime. Re-attaches
 * if the client or seat labels change; one attach spans repeated Play-Again games
 * on the same client (it resets on client.reset()).
 *
 * `onRecord` (optional) fires when each game ends, with the finished record — the
 * game-review entry point (P2 R0) reads it. Kept in a ref so passing a fresh
 * closure each render doesn't tear down and re-attach the recorder.
 */
export function useGameRecorder(
  client: RecorderClient,
  header: RecorderHeader,
  onRecord?: (record: GameRecord) => void,
): void {
  const seatKey = JSON.stringify(header.seats);
  const headerRef = useRef(header);
  headerRef.current = header;
  const onRecordRef = useRef(onRecord);
  onRecordRef.current = onRecord;
  // Re-attach only when the client or the seat labels change; the refs keep the
  // latest header/callback without widening the dependency list.
  useEffect(
    () => attachRecorder(client, headerRef.current, undefined, (r) => onRecordRef.current?.(r)),
    [client, seatKey, header.src],
  );
}
