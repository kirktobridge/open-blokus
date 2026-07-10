import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState } from '../../game/types';
import { resolveCells } from '../../game/pieces';
import { isLegalPlacement, applyPlacement } from '../../game/placement';
import { hasAnyMove } from '../../game/moves';
import {
  cellsPlaced,
  dailyDateKey,
  dailyShareText,
  generateDailyPuzzle,
  piecesPlaced,
} from '../../game/puzzle/daily';
import { Board } from '../board/Board';
import { HandTray } from '../tray/HandTray';
import { Controls } from '../controls/Controls';
import { useSelection } from '../hooks/useSelection';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { usePaletteColors } from '../palettes';
import { matchAction, type PlacementAction } from '../controls/keymap';
import { SettingsPanel } from '../SettingsPanel';
import { ControlsHelp } from '../ControlsHelp';
import { FONT_MONO, FONT_UI, ICON_CHIP, PANEL, PRIMARY_BTN, SECONDARY_BTN } from '../theme';
import { LeaveIcon } from '../icons';

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/**
 * Daily-puzzle solitaire (product P14 M1). A seeded mid-game position handed to
 * one color; the player fits as many of that color's remaining pieces as they
 * can. Score = squares placed. No opponents, no turn rotation, no boardgame.io —
 * just the pure rules core over local React state, reusing the shared Board,
 * HandTray and Controls primitives.
 */
export function DailyPuzzleGame({ onLeave }: { onLeave: () => void }) {
  // `?puzzle=YYYY-MM-DD` pins the day (debugging / e2e); otherwise today's date.
  const dateKey = useMemo(() => {
    const q =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('puzzle')
        : null;
    return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : dailyDateKey();
  }, []);
  const puzzle = useMemo(() => generateDailyPuzzle(dateKey), [dateKey]);
  const color = puzzle.playerColor;

  const [board, setBoard] = useState<GameState>(puzzle.state);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  // Reset if the puzzle changes (e.g. crossing midnight remounts with a new key).
  useEffect(() => {
    setBoard(puzzle.state);
    setDone(false);
    setCopied(false);
  }, [puzzle]);

  const sel = useSelection();
  const colors = usePaletteColors();
  const reduce = useReducedMotion();

  const stuck = useMemo(() => !hasAnyMove(board, color), [board, color]);
  const finished = done || stuck;
  const canPlay = !finished;

  const cells = cellsPlaced(puzzle, board);
  const pieces = piecesPlaced(puzzle, board);

  // Board-frame shake on a rejected placement (mirrors the vs-AI table, P16).
  const frameRef = useRef<HTMLDivElement>(null);
  function shake(): void {
    const el = frameRef.current;
    if (reduce || !el || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-in-out' },
    );
  }

  const oriented = useMemo(
    () =>
      sel.pieceId && sel.hover
        ? resolveCells({
            pieceId: sel.pieceId,
            rotation: sel.rotation,
            reflected: sel.reflected,
            x: sel.hover.x,
            y: sel.hover.y,
          })
        : [],
    [sel.pieceId, sel.hover, sel.rotation, sel.reflected],
  );
  const legal =
    canPlay && sel.pieceId && sel.hover
      ? isLegalPlacement(board, color, sel.pieceId, oriented)
      : false;
  const preview =
    sel.pieceId && sel.hover
      ? { cells: new Set(oriented.map((c) => `${c.x},${c.y}`)), legal, staged: sel.staged }
      : undefined;
  const canSubmit = sel.staged && legal;

  // Shake on the transition into a locked-but-illegal placement.
  const stagedIllegal = canPlay && sel.staged && sel.pieceId != null && sel.hover != null && !legal;
  const wasStagedIllegal = useRef(false);
  useEffect(() => {
    if (stagedIllegal && !wasStagedIllegal.current) shake();
    wasStagedIllegal.current = stagedIllegal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedIllegal]);

  /** Commit the staged placement to a fresh state clone. */
  function submitMove(): boolean {
    if (!canPlay || !sel.pieceId || !sel.hover || !sel.staged) return false;
    const placed = resolveCells({
      pieceId: sel.pieceId,
      rotation: sel.rotation,
      reflected: sel.reflected,
      x: sel.hover.x,
      y: sel.hover.y,
    });
    if (!isLegalPlacement(board, color, sel.pieceId, placed)) return false;
    const next = structuredClone(board);
    applyPlacement(next, color, sel.pieceId, placed);
    setBoard(next);
    sel.reset();
    return true;
  }

  function cancel(): void {
    if (sel.staged) sel.unstage();
    else sel.reset();
  }

  const interactive = canPlay && sel.pieceId != null;

  // Keyboard controls — same action set as the vs-AI table, minus board rotation
  // (the puzzle board is never turned). Kept in a ref so the window listener stays
  // stable while closing over the latest selection/legality.
  const handleActionRef = useRef<(a: PlacementAction) => boolean>(() => false);
  handleActionRef.current = (action) => {
    if (!canPlay) return false;
    if (action === 'cancel') {
      cancel();
      return true;
    }
    if (!sel.pieceId) return false;
    switch (action) {
      case 'moveUp':
        sel.move(0, -1);
        return true;
      case 'moveDown':
        sel.move(0, 1);
        return true;
      case 'moveLeft':
        sel.move(-1, 0);
        return true;
      case 'moveRight':
        sel.move(1, 0);
        return true;
      case 'rotateCW':
        sel.rotate(1);
        return true;
      case 'rotateCCW':
        sel.rotate(-1);
        return true;
      case 'flip':
        sel.flip();
        return true;
      case 'place':
        if (!sel.hover) return false;
        sel.stage();
        return true;
      case 'submit':
        if (sel.staged && !legal) {
          shake();
          return true;
        }
        return submitMove();
      default:
        return false;
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const action = matchAction(e);
      if (!action) return;
      if (handleActionRef.current(action)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function copyShare(): Promise<void> {
    const text = dailyShareText(dateKey, cells, pieces);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard blocked (permissions / insecure context) — leave the text on screen.
    }
  }

  let statusMain: ReactNode;
  if (finished) statusMain = 'Puzzle complete — see your result.';
  else if (!sel.pieceId) statusMain = 'Select a piece from your hand to begin.';
  else if (sel.staged && !legal) statusMain = 'Illegal spot — reposition or cancel.';
  else if (sel.staged && legal) statusMain = 'Locked — press Enter or PLAY MOVE to confirm.';
  else
    statusMain = (
      <>
        <span style={{ fontFamily: FONT_MONO, color: 'var(--top-ink)' }}>{sel.pieceId}</span> in
        hand — hover to preview · click to stage · scroll rotates · right-click flips
      </>
    );

  return (
    <div style={{ background: 'var(--table-bg)', minHeight: '100vh' }}>
      {/* TopBar — wordmark · mode chip · date · utility chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 26px',
          fontFamily: FONT_UI,
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 25, color: 'var(--top-ink)' }}>OpenBlokus</span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '.09em',
            color: 'var(--top-mut)',
            border: '1px solid var(--top-bd)',
            borderRadius: 999,
            padding: '5px 12px',
          }}
        >
          Daily puzzle
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: 'var(--top-mut)' }}>
          {dateKey}
        </span>
        <span style={{ flex: 1 }} />
        <SettingsPanel docked />
        <ControlsHelp docked />
        <button
          data-testid="leave-puzzle"
          onClick={onLeave}
          aria-label="Leave puzzle"
          title="Leave puzzle"
          style={{ ...ICON_CHIP, opacity: 0.85 }}
        >
          <LeaveIcon />
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 22,
          padding: '8px 26px 24px',
          fontFamily: FONT_UI,
          color: 'var(--ink)',
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexWrap: 'wrap',
          boxSizing: 'border-box',
        }}
      >
        {/* Left column — puzzle briefing + live score */}
        <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...PANEL, padding: 18 }}>
            <h2 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 18 }}>Today's puzzle</h2>
            <p style={{ margin: '0 0 14px', color: 'var(--mut)', fontSize: 13 }}>
              Fit as many <strong style={{ color: colors[color] }}>{cap(color)}</strong> pieces as
              you can. Score is squares placed — you play alone against the board.
            </p>
            <div data-testid="puzzle-score" style={{ display: 'flex', gap: 18 }}>
              <div>
                <div
                  data-testid="puzzle-cells"
                  style={{ fontFamily: FONT_MONO, fontSize: 28, fontWeight: 800 }}
                >
                  {cells}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mut)' }}>squares</div>
              </div>
              <div>
                <div
                  data-testid="puzzle-pieces"
                  style={{ fontFamily: FONT_MONO, fontSize: 28, fontWeight: 800 }}
                >
                  {pieces}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mut)' }}>pieces</div>
              </div>
            </div>
          </div>
          {!finished && (
            <button
              data-testid="finish-puzzle"
              onClick={() => setDone(true)}
              style={{ ...SECONDARY_BTN }}
            >
              I'm done — show result
            </button>
          )}
        </div>

        {/* Center column — framed board · status · controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          <div
            ref={frameRef}
            style={{
              background: 'linear-gradient(160deg, var(--frame-a), var(--frame-b))',
              borderRadius: 16,
              padding: 19,
              boxShadow:
                'inset 0 1px 0 var(--frame-hi), inset 0 -1px 0 rgba(0,0,0,.4), 0 24px 48px rgba(15,9,3,.42)',
            }}
          >
            <div
              style={{
                background: 'var(--mat)',
                borderRadius: 7,
                padding: 13,
                boxShadow: 'inset 0 2px 9px rgba(0,0,0,.26)',
              }}
            >
              <Board
                board={board.board}
                activeColor={color}
                preview={preview}
                lastMove={board.lastMove}
                onCellEnter={
                  interactive && !sel.staged ? (x, y) => sel.setHover({ x, y }) : undefined
                }
                onCellClick={
                  interactive
                    ? (x, y) => {
                        sel.setHover({ x, y });
                        sel.stage();
                      }
                    : undefined
                }
                onLeave={() => {
                  if (!sel.staged) sel.setHover(null);
                }}
                onRotate={interactive ? sel.rotate : undefined}
                onFlip={interactive ? sel.flip : undefined}
              />
            </div>
          </div>

          <p
            role="status"
            data-testid="puzzle-status"
            style={{ margin: 0, fontSize: 13, color: 'var(--top-mut)', textAlign: 'center', maxWidth: 620 }}
          >
            {statusMain}
          </p>

          <Controls
            pieceId={sel.pieceId}
            color={color}
            colors={colors}
            disabled={!canPlay}
            staged={sel.staged}
            canSubmit={canSubmit}
            onRotate={sel.rotate}
            onFlip={sel.flip}
            onSubmit={submitMove}
            onCancel={cancel}
          />
        </div>

        {/* Right column — your hand */}
        <HandTray
          color={color}
          state={board.colors[color]}
          interactive={canPlay}
          selectedId={sel.pieceId}
          onSelect={sel.selectPiece}
        />
      </div>

      {finished && (
        <div
          data-testid="puzzle-result"
          role="dialog"
          aria-label="Puzzle result"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,9,3,.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            fontFamily: FONT_UI,
          }}
        >
          <div style={{ ...PANEL, padding: 28, width: 340, textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 4px', fontWeight: 800 }}>Nice fitting!</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--mut)', fontSize: 13 }}>
              Daily puzzle · {dateKey}
            </p>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 40, fontWeight: 800 }}>{cells}</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>squares</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 40, fontWeight: 800 }}>{pieces}</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>pieces</div>
              </div>
            </div>
            <button
              data-testid="copy-result"
              onClick={copyShare}
              style={{ ...PRIMARY_BTN, width: '100%', marginBottom: 10 }}
            >
              {copied ? 'Copied!' : 'Copy result'}
            </button>
            <button data-testid="leave-puzzle-result" onClick={onLeave} style={{ ...SECONDARY_BTN, width: '100%' }}>
              Back to lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
