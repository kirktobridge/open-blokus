/**
 * Canned reactions (P19). Broadcast over boardgame.io's chat transport — an
 * ephemeral side channel that never touches `G` (the game state stays plain JSON
 * and cheat-resistant). Each reaction is a short emoji + label; the wire payload
 * carries only the id, and the receiver looks the rest up from this table so a
 * peer can't inject arbitrary text.
 */
export interface Reaction {
  id: string;
  emoji: string;
  label: string;
}

/** The fixed set shown in the reaction bar, in display order. */
export const REACTIONS: readonly Reaction[] = [
  { id: 'nice', emoji: '👏', label: 'Nice move' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
  { id: 'think', emoji: '🤔', label: 'Thinking…' },
  { id: 'ouch', emoji: '😬', label: 'Ouch' },
  { id: 'haha', emoji: '😂', label: 'Haha' },
  { id: 'gg', emoji: '🤝', label: 'Good game' },
];

const BY_ID: Record<string, Reaction> = Object.fromEntries(
  REACTIONS.map((r) => [r.id, r]),
);

/** A chat payload that carries a reaction. `type` tags it apart from other chat. */
export interface ReactionPayload {
  type: 'reaction';
  id: string;
}

/** Build the chat payload for a reaction id (used by the reaction bar). */
export function reactionMessage(id: string): ReactionPayload {
  return { type: 'reaction', id };
}

/**
 * Resolve a received chat payload to a known Reaction, or null if it isn't a
 * reaction we recognise (other chat traffic, an unknown id, malformed input).
 */
export function parseReaction(payload: unknown): Reaction | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { type?: unknown; id?: unknown };
  if (p.type !== 'reaction' || typeof p.id !== 'string') return null;
  return BY_ID[p.id] ?? null;
}
