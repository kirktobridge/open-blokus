import { useEffect, useRef } from 'react';
import { attachRecorder, type RecorderClient, type RecorderHeader } from './recorder';

/**
 * Attach the game recorder to a boardgame.io client for its lifetime. Re-attaches
 * if the client or seat labels change; one attach spans repeated Play-Again games
 * on the same client (it resets on client.reset()).
 */
export function useGameRecorder(client: RecorderClient, header: RecorderHeader): void {
  const seatKey = JSON.stringify(header.seats);
  const headerRef = useRef(header);
  headerRef.current = header;
  // Re-attach only when the client or the seat labels change; headerRef keeps the
  // latest header without widening the dependency list.
  useEffect(
    () => attachRecorder(client, headerRef.current),
    [client, seatKey, header.src],
  );
}
