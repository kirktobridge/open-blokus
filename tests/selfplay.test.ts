import { describe, it, expect } from 'vitest';
import { COLOR_ORDER } from '../src/game/types';
import type { Color } from '../src/game/types';
import { mulberry32, heuristicStrategy, greedySizeStrategy } from '../src/game/ai/arena';
import type { Strategy } from '../src/game/ai/arena';
import {
  playRecordedGame,
  replayGame,
  epsilonStrategy,
  serializeRecord,
  deserializeRecord,
} from '../src/game/ai/selfplay';
import { finalScores } from '../src/game/scoring';

function mixedSeats(): { byColor: Record<Color, Strategy>; seats: Record<Color, string> } {
  const pool: [string, Strategy][] = [
    ['heur', heuristicStrategy()],
    ['heur-e10', epsilonStrategy(heuristicStrategy(), 0.1)],
    ['greedy', greedySizeStrategy],
    ['heur', heuristicStrategy()],
  ];
  return {
    byColor: Object.fromEntries(COLOR_ORDER.map((c, i) => [c, pool[i][1]])) as Record<
      Color,
      Strategy
    >,
    seats: Object.fromEntries(COLOR_ORDER.map((c, i) => [c, pool[i][0]])) as Record<
      Color,
      string
    >,
  };
}

describe('selfplay records', () => {
  it('records a full game whose replay reproduces the final scores', () => {
    const { byColor, seats } = mixedSeats();
    const record = playRecordedGame(byColor, seats, 7, mulberry32(7));

    expect(record.moves.length).toBeGreaterThan(20); // real game, not a stub
    expect(record.winners.length).toBeGreaterThan(0);

    let positions = 0;
    const G = replayGame(record.moves, () => positions++);
    expect(positions).toBe(record.moves.length);
    expect(finalScores(G).colors).toEqual(record.scores);
  });

  it('round-trips through serialize/deserialize losslessly', () => {
    const { byColor, seats } = mixedSeats();
    const record = playRecordedGame(byColor, seats, 11, mulberry32(11));

    const back = deserializeRecord(JSON.parse(JSON.stringify(serializeRecord(record))));
    expect(back).toEqual(record);
    expect(finalScores(replayGame(back.moves)).colors).toEqual(record.scores);
  });

  it('replay throws on an illegal (tampered) move list', () => {
    const { byColor, seats } = mixedSeats();
    const record = playRecordedGame(byColor, seats, 13, mulberry32(13));

    const tampered = [...record.moves];
    // Duplicate the first move: its piece is no longer in `remaining` → illegal.
    tampered.splice(1, 0, tampered[0]);
    expect(() => replayGame(tampered)).toThrow(/illegal replayed move/);
  });

  it('is deterministic for a fixed seed', () => {
    const { byColor, seats } = mixedSeats();
    const a = playRecordedGame(byColor, seats, 42, mulberry32(42));
    const b = playRecordedGame(byColor, seats, 42, mulberry32(42));
    expect(a).toEqual(b);
  });
});
