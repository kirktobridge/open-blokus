import { describe, it, expect } from 'vitest';
import {
  emptyStreak,
  prevDayKey,
  foldCompletion,
  liveStreak,
} from '../src/client/lobby/streak';

describe('prevDayKey', () => {
  it('steps back one day within a month', () => {
    expect(prevDayKey('2026-07-17')).toBe('2026-07-16');
  });
  it('rolls over the start of a month', () => {
    expect(prevDayKey('2026-07-01')).toBe('2026-06-30');
  });
  it('rolls over the start of a year', () => {
    expect(prevDayKey('2026-01-01')).toBe('2025-12-31');
  });
  it('handles a leap day', () => {
    expect(prevDayKey('2024-03-01')).toBe('2024-02-29');
  });
});

describe('foldCompletion', () => {
  it('starts a run at 1 from empty', () => {
    expect(foldCompletion(emptyStreak(), '2026-07-17')).toEqual({ last: '2026-07-17', count: 1 });
  });
  it('is idempotent for a second completion the same day', () => {
    const s = { last: '2026-07-17', count: 3 };
    expect(foldCompletion(s, '2026-07-17')).toBe(s);
  });
  it('extends the run on the next day', () => {
    expect(foldCompletion({ last: '2026-07-17', count: 3 }, '2026-07-18')).toEqual({
      last: '2026-07-18',
      count: 4,
    });
  });
  it('restarts at 1 after a gap of a full day', () => {
    expect(foldCompletion({ last: '2026-07-17', count: 3 }, '2026-07-19')).toEqual({
      last: '2026-07-19',
      count: 1,
    });
  });
  it('extends across a month boundary', () => {
    expect(foldCompletion({ last: '2026-06-30', count: 2 }, '2026-07-01')).toEqual({
      last: '2026-07-01',
      count: 3,
    });
  });
});

describe('liveStreak', () => {
  it('is 0 when nothing was ever completed', () => {
    expect(liveStreak(emptyStreak(), '2026-07-17')).toBe(0);
  });
  it('shows the count when completed today', () => {
    expect(liveStreak({ last: '2026-07-17', count: 5 }, '2026-07-17')).toBe(5);
  });
  it('stays alive when completed yesterday (today not done yet)', () => {
    expect(liveStreak({ last: '2026-07-16', count: 5 }, '2026-07-17')).toBe(5);
  });
  it('lapses to 0 when the last completion is older than yesterday', () => {
    expect(liveStreak({ last: '2026-07-15', count: 5 }, '2026-07-17')).toBe(0);
  });
});
