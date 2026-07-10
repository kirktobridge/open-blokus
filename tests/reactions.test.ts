import { describe, it, expect } from 'vitest';
import { REACTIONS, reactionMessage, parseReaction } from '../src/client/lobby/reactions';
import { isRealName } from '../src/client/lobby/config';

describe('reaction wire contract (P19)', () => {
  it('round-trips every canned reaction through send → parse', () => {
    for (const r of REACTIONS) {
      const parsed = parseReaction(reactionMessage(r.id));
      expect(parsed).toEqual(r);
    }
  });

  it('rejects non-reaction and malformed payloads', () => {
    expect(parseReaction(null)).toBeNull();
    expect(parseReaction(undefined)).toBeNull();
    expect(parseReaction('gg')).toBeNull(); // plain chat text
    expect(parseReaction({ type: 'chat', id: 'nice' })).toBeNull();
    expect(parseReaction({ type: 'reaction' })).toBeNull(); // no id
    expect(parseReaction({ type: 'reaction', id: 42 })).toBeNull(); // wrong id type
  });

  it('ignores an unknown reaction id (peer cannot inject arbitrary content)', () => {
    expect(parseReaction({ type: 'reaction', id: 'definitely-not-real' })).toBeNull();
  });

  it('reactions have unique ids and non-empty emoji + label', () => {
    const ids = REACTIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of REACTIONS) {
      expect(r.emoji.length).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe('nickname anonymity rule (P19)', () => {
  it('treats the default Player N seat name as anonymous', () => {
    expect(isRealName('Player 0')).toBe(false);
    expect(isRealName('Player 12')).toBe(false);
  });

  it('accepts a chosen nickname', () => {
    expect(isRealName('Alice')).toBe(true);
    expect(isRealName('Player One')).toBe(true); // not the numeric default
    expect(isRealName('xX_Player 3_Xx')).toBe(true); // default only when exact
  });

  it('rejects empty / missing names', () => {
    expect(isRealName('')).toBe(false);
    expect(isRealName(undefined)).toBe(false);
  });
});
