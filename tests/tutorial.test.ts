import { describe, it, expect } from 'vitest';
import { buildTutorial } from '../src/client/tutorial/scenarios';
import { isLegalPlacement } from '../src/game/placement';
import { resolveCells } from '../src/game/pieces';
import { anchorsAfter } from '../src/client/advisor/legalMoves';

const steps = buildTutorial();
const byId = (id: string) => {
  const s = steps.find((x) => x.id === id);
  if (!s) throw new Error(`no step ${id}`);
  return s;
};

const legalOf = (stepId: string, hintId: string): boolean => {
  const s = byId(stepId);
  const h = s.hints.find((x) => x.id === hintId);
  if (!h?.placement) throw new Error(`no placement for ${stepId}/${hintId}`);
  return isLegalPlacement(s.G, s.color, h.placement.pieceId, resolveCells(h.placement));
};

describe('P4 tutorial scenarios stay in sync with the rules', () => {
  it('has the four Classic steps then the Duo step, in order', () => {
    expect(steps.map((s) => s.id)).toEqual(['start', 'edges', 'corners', 'growth', 'duo-start']);
  });

  it('every advancing hint is a legal placement, every advancing hint carries one', () => {
    for (const s of steps) {
      for (const h of s.hints) {
        if (h.advances) {
          expect(h.placement, `${s.id}/${h.id} advances but has no placement`).toBeDefined();
          expect(
            isLegalPlacement(s.G, s.color, h.placement!.pieceId, resolveCells(h.placement!)),
            `${s.id}/${h.id} should be legal`,
          ).toBe(true);
        }
      }
    }
  });

  it('step 1: the corner move is legal, the center move is an illegal first move', () => {
    const s = byId('start');
    expect(legalOf('start', 'corner')).toBe(true);
    const center = s.hints.find((h) => h.id === 'center')!;
    expect(isLegalPlacement(s.G, s.color, center.placement?.pieceId ?? 'V3', resolveCells({
      pieceId: 'V3', rotation: 0, reflected: false, x: 9, y: 9,
    }))).toBe(false);
  });

  it('step 2: the edge move is rejected, the diagonal move is accepted', () => {
    const s = byId('edges');
    const edge = s.hints.find((h) => h.id === 'edge')!;
    // The edge hint is an authored illegal placement (edge-touch): reconstruct + check.
    const edgeCells = edge.cells.map((i) => ({ x: i % 20, y: Math.floor(i / 20) }));
    expect(isLegalPlacement(s.G, s.color, 'I2', edgeCells)).toBe(false);
    expect(legalOf('edges', 'diagonal')).toBe(true);
  });

  it('step 3: several distinct corner options, all legal', () => {
    const s = byId('corners');
    expect(s.hints.length).toBeGreaterThanOrEqual(3);
    // Each corner hint targets a single distinct cell.
    const cells = s.hints.flatMap((h) => h.cells);
    expect(new Set(cells).size).toBe(cells.length);
    for (const h of s.hints) {
      expect(isLegalPlacement(s.G, s.color, h.placement!.pieceId, resolveCells(h.placement!))).toBe(true);
    }
  });

  it('step 4: both moves legal, but the open move keeps strictly more room', () => {
    const s = byId('growth');
    const cramped = s.hints.find((h) => h.id === 'cramped')!;
    const open = s.hints.find((h) => h.id === 'open')!;
    // Cramped is legal (it's suboptimal, not illegal).
    const crampedCells = cramped.cells.map((i) => ({ x: i % 20, y: Math.floor(i / 20) }));
    expect(isLegalPlacement(s.G, s.color, 'I2', crampedCells)).toBe(true);
    expect(legalOf('growth', 'open')).toBe(true);
    expect(anchorsAfter(s.G, s.color, open.placement!)).toBeGreaterThan(
      anchorsAfter(s.G, s.color, {
        pieceId: 'I2', rotation: 0, reflected: false, x: 2, y: 0,
      }),
    );
  });

  it('duo step: a 14×14 black board whose opening covers the interior start, not a corner', () => {
    const s = byId('duo-start');
    // The Duo variant board is 14×14 = 196 cells, and black opens (GAME_SPEC_DUO §3/§5).
    expect(s.G.board.length).toBe(14 * 14);
    expect(s.color).toBe('black');
    // The interior hint is a legal first move that actually covers black's start cell…
    expect(legalOf('duo-start', 'interior')).toBe(true);
    const start = s.G.config.startCells?.black;
    expect(start, 'Duo state must carry black’s start cell').toBeDefined();
    const interior = s.hints.find((h) => h.id === 'interior')!;
    const covers = resolveCells(interior.placement!).some((c) => c.x === start!.x && c.y === start!.y);
    expect(covers, 'the interior opening must cover black’s start cell').toBe(true);
    // …and the start cell is interior, not a corner — the point of the whole step.
    expect(start!.x > 0 && start!.y > 0).toBe(true);
    // The corner move is illegal precisely because Duo does not open from the corner.
    const corner = s.hints.find((h) => h.id === 'corner')!;
    const cornerCells = resolveCells({ pieceId: 'V3', rotation: 0, reflected: false, x: 0, y: 0 });
    expect(corner.placement).toBeUndefined();
    expect(isLegalPlacement(s.G, s.color, 'V3', cornerCells)).toBe(false);
  });
});
