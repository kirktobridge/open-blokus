import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  botSeatLabels,
  launchSetup,
  loadSetup,
  normalizeSetup,
  pinSetup,
  setupDiff,
  setupKey,
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

describe('Quick Play default (P46)', () => {
  // The vitest env is node, so storage is stubbed per case (same pattern as the
  // appearance store's tests) — these read and write the real persistence path.
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
  });

  const odd = setup({ mode: 2, aiCount: 1, botDifficulties: { '1': 'hard' }, blitzSeconds: 10 });

  it('starts the built-in setup until something is pinned', () => {
    expect(loadSetup()).toEqual(DEFAULT_SETUP);
  });

  it('launching a one-off setup leaves the default alone', () => {
    // The whole point: an experiment you play once must not become the one-click
    // path. This is the regression that P46 exists to prevent.
    launchSetup(odd);
    expect(loadSetup()).toEqual(DEFAULT_SETUP);
  });

  it('pinning is what sets it, and it survives a reload', () => {
    pinSetup(odd);
    expect(setupKey(loadSetup())).toBe(setupKey(odd));
  });

  it('still refuses to start an invalid setup (P17 guard on the launch path)', () => {
    // Blitz retires extreme — the guard has to live on launch now that launching
    // no longer goes through the save.
    const started = launchSetup(setup({ aiCount: 1, botDifficulties: { '3': 'extreme' }, blitzSeconds: 5 }));
    expect(started.botDifficulties['3']).toBe('hard');
  });

  it('pins the normalized setup, not the raw one', () => {
    pinSetup(setup({ mode: 2, aiCount: 4 }));
    expect(loadSetup().aiCount).toBe(2);
  });
});

describe('setupKey (P46)', () => {
  it('ignores seat ordering and stale seats — same game, same key', () => {
    const a = setup({ aiCount: 2, botDifficulties: { '2': 'hard', '3': 'medium' } });
    const b = setup({ aiCount: 2, botDifficulties: { '3': 'medium', '2': 'hard', '9': 'easy' } });
    expect(setupKey(a)).toBe(setupKey(b));
  });

  it('separates setups that would start a different game', () => {
    expect(setupKey(setup())).not.toBe(setupKey(setup({ blitzSeconds: 30 })));
    expect(setupKey(setup())).not.toBe(setupKey(setup({ aiCount: 2 })));
  });
});

describe('setupDiff (P65 M4)', () => {
  const pinned = setup({ mode: 4, aiCount: 3, botDifficulties: { '1': 'easy', '2': 'easy', '3': 'easy' } });

  it('marks nothing when the setup is the pinned default', () => {
    expect(Object.values(setupDiff(pinned, pinned)).every((v) => v === false)).toBe(true);
  });

  it('marks only the seat whose tier was bumped', () => {
    const edited = setup({ ...pinned, botDifficulties: { ...pinned.botDifficulties, '2': 'hard' } });
    const diff = setupDiff(edited, pinned);
    expect(diff['seat:2']).toBe(true);
    expect(diff['seat:1']).toBe(false);
    expect(diff['seat:3']).toBe(false);
    // The returning player's whole task is "bump one bot, keep my usual" — the other
    // controls must stay unmarked or the signal is noise.
    expect(diff.variant).toBe(false);
    expect(diff.mode).toBe(false);
    expect(diff.aiCount).toBe(false);
    expect(diff.blitz).toBe(false);
  });

  it.each([
    ['variant', setup({ ...pinned, variant: 'duo' as const })],
    ['blitz', setup({ ...pinned, blitzSeconds: 30 })],
    ['aiCount', setup({ ...pinned, aiCount: 2 })],
  ])('marks a changed %s', (field, edited) => {
    expect(setupDiff(edited, pinned)[field]).toBe(true);
  });

  it('agrees with setupKey: same key means nothing is marked', () => {
    // setupDiff is the per-field twin of the isPinned comparison, so the two must not
    // be able to disagree — a marked row on an identically-keyed setup would point at
    // something the player cannot change back.
    const equivalent = normalizeSetup(setup({ ...pinned, botDifficulties: { ...pinned.botDifficulties } }));
    expect(setupKey(equivalent)).toBe(setupKey(pinned));
    expect(Object.values(setupDiff(equivalent, pinned)).some(Boolean)).toBe(false);
  });

  it('counts a seat that exists on only one side as changed', () => {
    // botSeatLabels labels the *trailing* seats, so dropping 3 bots to 1 keeps seat
    // '3' and retires '1' and '2' — those are the rows that vanished, and a row that
    // exists on only one side is a real difference from the default.
    const fewer = normalizeSetup(setup({ ...pinned, aiCount: 1 }));
    const diff = setupDiff(fewer, pinned);
    expect(Object.keys(fewer.botDifficulties)).toEqual(['3']);
    expect(diff['seat:1']).toBe(true);
    expect(diff['seat:2']).toBe(true);
    expect(diff['seat:3']).toBe(false);
  });
});
