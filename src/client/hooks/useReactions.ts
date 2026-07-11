import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from 'boardgame.io';
import { parseReaction, type Reaction } from '../lobby/reactions';

/** How long a reaction bubble lingers on a seat before fading (ms). */
export const REACTION_TTL_MS = 3000;

/** A live reaction on one seat; `key` changes per message so the bubble replays. */
export interface ActiveReaction {
  reaction: Reaction;
  key: string;
}

/**
 * Fold the incoming chat stream (P19) into the current reaction per sender seat.
 * boardgame.io accumulates every received message in `chatMessages`, echoing the
 * sender's own too, so we track processed ids and only act on new ones. Each new
 * reaction replaces that seat's bubble and schedules its own removal, so a rapid
 * second reaction supersedes the first cleanly.
 *
 * Returns a map keyed by the sender's playerID (the seat that reacted).
 */
export function useReactions(
  chatMessages: ChatMessage[] | undefined,
): Record<string, ActiveReaction> {
  const [active, setActive] = useState<Record<string, ActiveReaction>>({});
  const seen = useRef(new Set<string>());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!chatMessages) return;
    for (const msg of chatMessages) {
      if (seen.current.has(msg.id)) continue;
      seen.current.add(msg.id);
      const reaction = parseReaction(msg.payload);
      if (!reaction) continue;
      const seat = msg.sender;
      const key = msg.id;
      setActive((prev) => ({ ...prev, [seat]: { reaction, key } }));
      const timer = window.setTimeout(() => {
        // Only clear if this exact reaction is still showing — a newer one wins.
        setActive((prev) => (prev[seat]?.key === key ? omit(prev, seat) : prev));
      }, REACTION_TTL_MS);
      timers.current.push(timer);
    }
  }, [chatMessages]);

  // Clear pending timers on unmount so they don't fire into a gone component.
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  return active;
}

function omit<T>(obj: Record<string, T>, key: string): Record<string, T> {
  const rest: Record<string, T> = {};
  for (const k in obj) if (k !== key) rest[k] = obj[k];
  return rest;
}
