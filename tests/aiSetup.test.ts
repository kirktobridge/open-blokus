import { describe, expect, it } from 'vitest';
import {
  botSeatLabels,
  normalizeSetup,
  setupSummary,
  DEFAULT_SETUP,
  type AiSetup,
} from '../src/client/lobby/aiSetup';

const setup = (over: Partial<AiSetup> = {}): AiSetup => ({ ...DEFAULT_SETUP, ...over });

describe('botSeatLabels (P29)', () => {
  it('labels the trailing seats with the colors they own', () => {
    expect(botSeatLabels(4, 3)).toEqual([
      { seat: '1', label: 'Yellow' },
      { seat: '2', label: 'Red' },
      { seat: '3', label: 'Green' },
    ]);
  });

  it('gives a 2p seat both of its colors', () => {
    expect(botSeatLabels(2, 1)).toEqual([{ seat: '1', label: 'Yellow, Green' }]);
  });

  it('notes the shared color in 3p', () => {
    expect(botSeatLabels(3, 1)[0].label).toContain('+ shared');
  });
});

describe('setupSummary (P29)', () => {
  it('reads as a sentence: who, what tier, what clock', () => {
    expect(setupSummary(setup())).toBe('You vs 3 bots · all easy · untimed');
  });

  it('names a mixed lineup seat by seat and reports the clock', () => {
    const s = setup({
      aiCount: 2,
      botDifficulties: { '2': 'hard', '3': 'medium' },
      blitzSeconds: 30,
    });
    expect(setupSummary(s)).toBe('You +1 vs 2 bots · hard, medium · blitz 30s');
  });

  it('an all-bot lineup is a watch game, and a watch game has no clock to report', () => {
    expect(setupSummary(setup({ aiCount: 4, blitzSeconds: 30 }))).toBe('Watch — 4 bots · all easy');
  });

  it('says untimed when no clock is set, with one bot singular', () => {
    expect(setupSummary(setup({ mode: 2, aiCount: 1 }))).toBe('You vs 1 bot · all easy · untimed');
  });
});

describe('normalizeSetup (P29)', () => {
  it('fills every current bot seat with a tier and drops stale ones', () => {
    // '3' is a leftover from a 4-player setup that's since dropped to 2 players.
    const s = normalizeSetup(setup({ mode: 2, aiCount: 1, botDifficulties: { '3': 'hard' } }));
    expect(s.botDifficulties).toEqual({ '1': 'easy' });
  });

  it('clamps a bot count that outlives a drop in players', () => {
    expect(normalizeSetup(setup({ mode: 2, aiCount: 4 })).aiCount).toBe(2);
  });

  it('retires an extreme seat when a blitz clock is on — it cannot race one (P25)', () => {
    const s = normalizeSetup(
      setup({ aiCount: 1, botDifficulties: { '3': 'extreme' }, blitzSeconds: 5 }),
    );
    expect(s.botDifficulties['3']).toBe('hard');
  });

  it('leaves extreme alone when untimed', () => {
    const s = normalizeSetup(setup({ aiCount: 1, botDifficulties: { '3': 'extreme' } }));
    expect(s.botDifficulties['3']).toBe('extreme');
  });
});
