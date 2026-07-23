import type { Color, GameState, PieceId, Placement } from '../../game/types';
import { createInitialState } from '../../game/modes';
import { applyPlacement } from '../../game/placement';
import { resolveCells } from '../../game/pieces';
import { idx } from '../../game/board';
import type { HintTone } from '../advisor/LegalMoveHints';
import {
  legalMovesForPiece,
  expansionAnchors,
  anchorsAfter,
  placementCells,
} from '../advisor/legalMoves';

/**
 * The scripted P4 tutorial. Four Classic steps + one Duo step (P58), each a
 * self-contained board + a set of clickable hints. The Classic four teach: start
 * from your corner, no own-edge contact, many corner options, and preserving
 * expansion lanes. The Duo step teaches the variant's *defining* difference — you
 * open from an interior start cell, not a corner (GAME_SPEC_DUO §3). Every hint's
 * legality/quality is derived from the rules core here (not asserted by hand), so
 * the lesson can never disagree with the actual engine, on either board size —
 * `tests/tutorial.test.ts` locks that in.
 */

export interface TutHint {
  id: string;
  cells: number[];
  tone: HintTone;
  /** Clicking a hint with a placement lands the piece and completes the step. */
  advances: boolean;
  placement?: Placement;
  /** Feedback shown when the hint is clicked. */
  feedback: string;
}

export interface TutStep {
  id: string;
  title: string;
  /** The rule/idea, shown before the player acts. */
  lesson: string;
  color: Color;
  /** The piece the player is placing this step. */
  piece: PieceId;
  /** Pre-built board for the step. */
  G: GameState;
  hints: TutHint[];
  /** Shown once the step is completed. */
  success: string;
}

const place = (pieceId: PieceId, x: number, y: number, rotation = 0, reflected = false): Placement => ({
  pieceId,
  rotation: rotation as Placement['rotation'],
  reflected,
  x,
  y,
});

/** Fresh 4p board with the given blue seed placements already applied. */
function seededBoard(seeds: Placement[]): GameState {
  const G = createInitialState(4);
  for (const s of seeds) applyPlacement(G, 'blue', s.pieceId, resolveCells(s));
  return G;
}

// Seeds reused across steps so the board grows the way real play would.
const CORNER_V3 = place('V3', 0, 0); // covers (0,0),(0,1),(1,1)

function step1Start(): TutStep {
  const G = createInitialState(4);
  const corner = place('V3', 0, 0);
  const center = place('V3', 9, 9);
  return {
    id: 'start',
    title: 'Start from your corner',
    lesson: 'In Classic Blokus, your first piece must cover your own starting corner — the top-left, glowing below. Click it to place.',
    color: 'blue',
    piece: 'V3',
    G,
    hints: [
      {
        id: 'corner',
        cells: placementCells(G, corner),
        tone: 'legal',
        advances: true,
        placement: corner,
        feedback: '',
      },
      {
        id: 'center',
        cells: placementCells(G, center),
        tone: 'illegal',
        advances: false,
        feedback: 'Not there — your very first piece has to touch your own corner.',
      },
    ],
    success: 'In Classic, every color opens from its own corner. Yours is the top-left.',
  };
}

function step2Edges(): TutStep {
  const G = seededBoard([CORNER_V3]);
  const edge = place('I2', 2, 1); // (2,1),(3,1) — edge-touches (1,1)
  const diagonal = place('I2', 2, 0); // (2,0),(3,0) — corner-touches (1,1)
  return {
    id: 'edges',
    title: 'Corners connect, edges don’t',
    lesson: 'Your new pieces may only touch your own color corner-to-corner — never along an edge. Try the red spot, then the green one.',
    color: 'blue',
    piece: 'I2',
    G,
    hints: [
      {
        id: 'edge',
        cells: placementCells(G, edge),
        tone: 'illegal',
        advances: false,
        feedback: 'Rejected — that lies edge-to-edge with your corner piece. Same-color pieces may only meet at corners.',
      },
      {
        id: 'diagonal',
        cells: placementCells(G, diagonal),
        tone: 'legal',
        advances: true,
        placement: diagonal,
        feedback: '',
      },
    ],
    success: 'A diagonal (corner) touch is the only legal way to link your pieces.',
  };
}

function step3Corners(): TutStep {
  const G = seededBoard([CORNER_V3, place('I3', 2, 2)]); // I3 → (2,2),(3,2),(4,2)
  const options = legalMovesForPiece(G, 'blue', 'I2');
  // One clickable corner per open anchor — each mapped to a legal I2 that hooks it.
  const anchors = expansionAnchors(G, 'blue');
  const hints: TutHint[] = [];
  for (const anchor of anchors) {
    const opt = options.find((o) => o.cells.includes(anchor));
    if (!opt) continue;
    hints.push({
      id: `corner-${anchor}`,
      cells: [anchor],
      tone: 'anchor',
      advances: true,
      placement: opt.placement,
      feedback: '',
    });
  }
  return {
    id: 'corners',
    title: 'You usually have many corners',
    lesson: 'Every open corner of your color is a place to grow. Here are yours — click any one to expand into it.',
    color: 'blue',
    piece: 'I2',
    G,
    hints,
    success: 'Lots of options. Keeping several corners open is what keeps you in the game.',
  };
}

function step4Growth(): TutStep {
  const G = seededBoard([CORNER_V3]);
  const cramped = place('I2', 2, 0); // hugs the top edge
  const open = place('I2', 2, 2); // reaches into open space
  const crampedRoom = anchorsAfter(G, 'blue', cramped);
  const openRoom = anchorsAfter(G, 'blue', open);
  return {
    id: 'growth',
    title: 'Protect your expansion lanes',
    lesson: 'Both moves are legal — but one keeps more room to grow. Pick the one that opens more corners.',
    color: 'blue',
    piece: 'I2',
    G,
    hints: [
      {
        id: 'cramped',
        cells: placementCells(G, cramped),
        tone: 'suboptimal',
        advances: false,
        feedback: `Legal, but it hugs the top edge — you'd keep only ${crampedRoom} open corners.`,
      },
      {
        id: 'open',
        cells: placementCells(G, open),
        tone: 'legal',
        advances: true,
        placement: open,
        feedback: '',
      },
    ],
    success: `Reaching into open space keeps ${openRoom} corners open (vs ${crampedRoom}). Room to grow wins games.`,
  };
}

function step5DuoStart(): TutStep {
  // Blokus Duo: 14×14, two colors (black opens), advanced-only scoring — the rules
  // core builds the right board and start cells from the variant table. Black's start
  // is an *interior* cell (GAME_SPEC_DUO §3), not a corner, which is the whole point.
  const G = createInitialState(2, 'advanced', 'duo');
  const interior = place('V3', 4, 4); // covers black's interior start (4,4)
  const cornerMove = place('V3', 0, 0); // the top-left corner — an ordinary cell in Duo
  return {
    id: 'duo-start',
    title: 'Duo opens from the middle',
    lesson: 'Blokus Duo is a two-player duel on a smaller 14×14 board. Its big twist: you don’t start in a corner — your first piece must cover your own interior start cell, glowing below. Click it to place.',
    color: 'black',
    piece: 'V3',
    G,
    hints: [
      {
        id: 'interior',
        cells: placementCells(G, interior),
        tone: 'legal',
        advances: true,
        placement: interior,
        feedback: '',
      },
      {
        id: 'corner',
        cells: placementCells(G, cornerMove),
        tone: 'illegal',
        advances: false,
        feedback: 'Not in Duo — the corner is just an ordinary square here. Your opening has to cover the marked interior cell.',
      },
    ],
    success: 'That interior opening — with only one opponent to fence with — is what makes Duo a sharper, more head-to-head game.',
  };
}

/** Build the ordered tutorial steps (fresh state each call). */
export function buildTutorial(): TutStep[] {
  return [step1Start(), step2Edges(), step3Corners(), step4Growth(), step5DuoStart()];
}

/** Board index of a cell — re-exported for tests/consumers building scenarios. */
export const cellIdx = idx;
