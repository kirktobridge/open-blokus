import { describe, it, expect } from 'vitest';
import { COLOR_ORDER } from '../src/game/types';
import type { Color } from '../src/game/types';
import { mulberry32, heuristicStrategy, greedySizeStrategy } from '../src/game/ai/arena';
import type { Strategy } from '../src/game/ai/arena';
import { playRecordedGame, replayGame, type GameRecord } from '../src/game/ai/selfplay';
import { finalScores, remainingSquares } from '../src/game/scoring';
import { attachPoints } from '../src/game/ai/alphabeta';
import { buildRecap } from '../src/game/recap';

function seededRecord(seed: number): GameRecord {
  const pool: Strategy[] = [
    heuristicStrategy(),
    greedySizeStrategy,
    heuristicStrategy(),
    greedySizeStrategy,
  ];
  const byColor = Object.fromEntries(COLOR_ORDER.map((c, i) => [c, pool[i]])) as Record<
    Color,
    Strategy
  >;
  const seats = Object.fromEntries(COLOR_ORDER.map((c) => [c, 'heur'])) as Record<Color, string>;
  return playRecordedGame(byColor, seats, seed, mulberry32(seed));
}

describe('buildRecap', () => {
  it('produces one frame per move plus an empty opening frame', () => {
    const record = seededRecord(7);
    const frames = buildRecap(record);
    expect(frames).toHaveLength(record.moves.length + 1);
    expect(frames[0].ply).toBe(0);
    expect(frames[0].move).toBeNull();
    expect(frames[0].moveCells).toEqual([]);
    expect(frames[0].board.every((c) => c === null)).toBe(true);
    // Frame indices are contiguous plies.
    frames.forEach((f, i) => expect(f.ply).toBe(i));
  });

  it('each non-opening frame records its move and the cells it filled', () => {
    const frames = buildRecap(seededRecord(11));
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i];
      expect(f.move).toEqual(frames[i].move); // present
      expect(f.moveCells.length).toBeGreaterThan(0);
      // Every cell the move claims is that color on this frame's board…
      for (const idx of f.moveCells) expect(f.board[idx]).toBe(f.move!.color);
      // …and was empty on the previous frame.
      for (const idx of f.moveCells) expect(frames[i - 1].board[idx]).toBeNull();
    }
  });

  it('placed-squares is monotonic per color and matches the final scores', () => {
    const record = seededRecord(3);
    const frames = buildRecap(record);

    // Monotonic non-decreasing per color.
    for (let i = 1; i < frames.length; i++) {
      for (const c of COLOR_ORDER) {
        expect(frames[i].placed[c]).toBeGreaterThanOrEqual(frames[i - 1].placed[c]);
      }
    }

    // Final placed == 89 − remaining (89 = total squares of the 21 pieces).
    const finalG = replayGame(record.moves, undefined, record.mode, record.scoring);
    const last = frames[frames.length - 1];
    for (const c of COLOR_ORDER) {
      expect(last.placed[c]).toBe(89 - remainingSquares(finalG.colors[c]));
    }
  });

  it("final frame's board matches a full replay", () => {
    const record = seededRecord(5);
    const frames = buildRecap(record);
    const finalG = replayGame(record.moves, undefined, record.mode, record.scoring);
    expect(frames[frames.length - 1].board).toEqual(finalG.board);
    // And the scores derived from that board are the record's scores.
    expect(finalScores(finalG).colors).toEqual(record.scores);
  });

  it('records per-color mobility that matches an independent replay (P34 M1)', () => {
    const record = seededRecord(4);
    const frames = buildRecap(record);

    // Ply 0: every color sits on its single empty starting corner.
    for (const c of COLOR_ORDER) expect(frames[0].mobility[c]).toBe(1);

    // Each frame's mobility equals attachPoints on a fresh replay to that ply —
    // the chart's y-values can never drift from the ground-truth frontier.
    for (let k = 0; k < frames.length; k++) {
      const G = replayGame(record.moves.slice(0, k), undefined, record.mode, record.scoring);
      for (const c of COLOR_ORDER) {
        expect(frames[k].mobility[c]).toBe(attachPoints(G, c));
      }
    }
  });

  it('mobility is non-monotonic in general — it rises then collapses', () => {
    // Score only ever climbs (asserted above); mobility is the signal that falls,
    // which is the whole point of the P34 chart. At least one color must dip.
    const frames = buildRecap(seededRecord(13));
    const dips = COLOR_ORDER.some((c) =>
      frames.some((f, i) => i > 0 && f.mobility[c] < frames[i - 1].mobility[c]),
    );
    expect(dips).toBe(true);
  });

  it('snapshots per-color inventory at each ply — the review table renders from it (R0.2)', () => {
    const record = seededRecord(6);
    const frames = buildRecap(record);

    // Ply 0: no color has started; full 21-piece inventory, no last-placed.
    for (const c of COLOR_ORDER) {
      expect(frames[0].colors[c].hasStarted).toBe(false);
      expect(frames[0].colors[c].lastPlaced).toBeNull();
      expect(frames[0].colors[c].remaining).toHaveLength(21);
    }

    // A frame's snapshot is an independent clone — the replay mutates one G in
    // place, so an early frame must not see a later ply's smaller inventory.
    expect(frames[0].colors).not.toBe(frames[frames.length - 1].colors);

    // Each move shrinks exactly the mover's inventory by one and records the piece
    // it just played as `lastPlaced`; every other color is unchanged that ply.
    for (let i = 1; i < frames.length; i++) {
      const m = frames[i].move!;
      expect(frames[i].colors[m.color].lastPlaced).toBe(m.pieceId);
      expect(frames[i].colors[m.color].remaining).not.toContain(m.pieceId);
      expect(frames[i].colors[m.color].remaining).toHaveLength(
        frames[i - 1].colors[m.color].remaining.length - 1,
      );
      for (const c of COLOR_ORDER) {
        if (c === m.color) continue;
        expect(frames[i].colors[c].remaining).toEqual(frames[i - 1].colors[c].remaining);
      }
    }

    // Final inventory matches a full independent replay (never drifts from truth).
    const finalG = replayGame(record.moves, undefined, record.mode, record.scoring);
    for (const c of COLOR_ORDER) {
      expect(frames[frames.length - 1].colors[c].remaining).toEqual(finalG.colors[c].remaining);
    }
  });

  it('throws on a corrupt (illegal) move rather than rendering a bogus frame', () => {
    const record = seededRecord(9);
    const corrupt: GameRecord = {
      ...record,
      // Force an illegal move: drop a piece onto a cell an earlier move already filled.
      moves: [record.moves[0], { ...record.moves[0], color: record.moves[1].color }],
    };
    expect(() => buildRecap(corrupt)).toThrow(/illegal replayed move/);
  });
});
