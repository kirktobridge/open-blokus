import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { Color, GameState } from '../game/types';
import { COLOR_ORDER } from '../game/types';
import { resolveCells } from '../game/pieces';
import { isLegalPlacement } from '../game/placement';
import { CORNERS } from '../game/modes';
import { Board } from './board/Board';
import { HandTray } from './tray/HandTray';
import { Standings } from './controls/ScorePanel';
import { PlayerCard, type SeatTag } from './controls/PlayerCard';
import { Controls } from './controls/Controls';
import { GameOverModal, type GameOverPayload } from './controls/GameOverModal';
import { matchAction, type PlacementAction } from './controls/keymap';
import { useSelection } from './hooks/useSelection';
import { usePaletteColors } from './palettes';
import { useInventoryDisplay } from './settings';
import { FONT_MONO, FONT_UI } from './theme';
import type { Difficulty } from './ai/difficulty';

/** Clockwise quarter-turns that bring each color's corner to the bottom-right. */
const TURNS_TO_BOTTOM_RIGHT: Record<Color, number> = { blue: 2, yellow: 1, red: 0, green: 3 };

/** Rotate a screen-space (dx, dy) into board space for a board turned `turns` CW. */
function toBoardDelta(dx: number, dy: number, turns: number): [number, number] {
  let a = dx;
  let b = dy;
  const t = ((turns % 4) + 4) % 4;
  for (let i = 0; i < t; i++) [a, b] = [b, -a];
  return [a, b];
}

const cap = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/**
 * Interactive game view — "the study table". Two-step placement: position +
 * orient a piece (mouse or WASD / arrows / scroll), lock it (click or Space),
 * then submit (PLAY MOVE or Enter). Three columns: players · board+dock · hand.
 * The board is rotated so the local player's corner sits bottom-right.
 *
 * `botDifficulties` (offline only) labels each bot seat; absent in multiplayer.
 */
export function BlokusBoardView({
  G,
  ctx,
  moves,
  isActive,
  playerID,
  botDifficulties,
}: BoardProps<GameState> & { botDifficulties?: Record<string, Difficulty> }) {
  const sel = useSelection();
  const colors = usePaletteColors();
  const activeColor = COLOR_ORDER[G.activeColorIndex];
  // Single-player passes isActive=true for the current player; multiplayer gates it.
  const canPlay = isActive !== false && !ctx.gameover;
  const inventoryDisplay = useInventoryDisplay();

  // Orient the board to the local seat's color (bottom-right); manual button cycles.
  const homeColor =
    playerID != null ? COLOR_ORDER.find((c) => G.config.owners[c] === playerID) : undefined;
  const [boardTurns, setBoardTurns] = useState(
    homeColor ? TURNS_TO_BOTTOM_RIGHT[homeColor] : 0,
  );

  const oriented =
    sel.pieceId && sel.hover
      ? resolveCells({
          pieceId: sel.pieceId,
          rotation: sel.rotation,
          reflected: sel.reflected,
          x: sel.hover.x,
          y: sel.hover.y,
        })
      : [];
  const legal =
    canPlay && sel.pieceId && sel.hover
      ? isLegalPlacement(G, activeColor, sel.pieceId, oriented)
      : false;
  const preview =
    sel.pieceId && sel.hover
      ? { cells: new Set(oriented.map((c) => `${c.x},${c.y}`)), legal, staged: sel.staged }
      : undefined;

  const canSubmit = sel.staged && legal;

  // Before your color's first move, mark its required opening corner.
  const startHint =
    canPlay && !G.colors[activeColor].hasStarted ? CORNERS[activeColor] : undefined;

  /** Commit the staged placement to the engine. Returns whether a move was made. */
  function submitMove(): boolean {
    if (!canPlay || !sel.pieceId || !sel.hover || !sel.staged) return false;
    const cells = resolveCells({
      pieceId: sel.pieceId,
      rotation: sel.rotation,
      reflected: sel.reflected,
      x: sel.hover.x,
      y: sel.hover.y,
    });
    if (!isLegalPlacement(G, activeColor, sel.pieceId, cells)) return false;
    moves.placePiece({
      pieceId: sel.pieceId,
      rotation: sel.rotation,
      reflected: sel.reflected,
      x: sel.hover.x,
      y: sel.hover.y,
    });
    sel.reset();
    return true;
  }

  /** Cancel: drop the lock if staged, else deselect the piece entirely. */
  function cancel(): void {
    if (sel.staged) sel.unstage();
    else sel.reset();
  }

  const interactive = canPlay && sel.pieceId != null;

  // Keep a fresh action handler in a ref so the window listener stays stable while
  // still closing over the latest selection/legality. Returns true if it consumed
  // the event (so we can preventDefault only when we actually acted).
  const handleActionRef = useRef<(a: PlacementAction) => boolean>(() => false);
  handleActionRef.current = (action) => {
    if (!canPlay) return false;
    if (action === 'cancel') {
      if (sel.staged) sel.unstage();
      else sel.reset();
      return true;
    }
    if (!sel.pieceId) return false;
    // Movement is expressed in screen space, then rotated into board space so the
    // arrow keys stay intuitive whatever the board's orientation.
    const moveScreen = (dx: number, dy: number) => sel.move(...toBoardDelta(dx, dy, boardTurns));
    switch (action) {
      case 'moveUp':
        moveScreen(0, -1);
        return true;
      case 'moveDown':
        moveScreen(0, 1);
        return true;
      case 'moveLeft':
        moveScreen(-1, 0);
        return true;
      case 'moveRight':
        moveScreen(1, 0);
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
        return submitMove();
      default:
        return false;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys while typing in a form field (palette name, join id, …).
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const action = matchAction(e);
      if (!action) return;
      if (handleActionRef.current(action)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Next non-stuck color after the active one — the "NEXT" seat.
  const onDeckColor: Color | undefined = (() => {
    for (let i = 1; i <= COLOR_ORDER.length; i++) {
      const c = COLOR_ORDER[(G.activeColorIndex + i) % COLOR_ORDER.length];
      if (c !== activeColor && !G.colors[c].stuck) return c;
    }
    return undefined;
  })();

  const winners = (ctx.gameover as GameOverPayload | undefined)?.winners ?? [];

  /** Name suffix + state pill for a seat. */
  function seatMeta(c: Color): { nameSuffix: string | null; tag: SeatTag } {
    const owner = G.config.owners[c];
    const isYou = playerID != null && owner === playerID;
    const diff = owner !== 'shared' ? botDifficulties?.[owner] : undefined;
    const nameSuffix = isYou ? 'You' : (diff ?? null);

    let tag: SeatTag = null;
    if (ctx.gameover && owner !== 'shared' && winners.includes(owner)) tag = 'winner';
    else if (c === activeColor && !ctx.gameover) tag = 'active';
    else if (G.colors[c].stuck) tag = 'noMoves';
    else if (c === onDeckColor && !ctx.gameover) tag = 'onDeck';
    else if (G.colors[c].lastPlaced != null) tag = 'played';
    return { nameSuffix, tag };
  }

  // Status sentence above the dock (always names the next action).
  let statusMain: ReactNode;
  if (ctx.gameover) statusMain = 'Game over — see the results.';
  else if (!canPlay) statusMain = `Waiting — ${cap(activeColor)} to move…`;
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
        background: 'var(--table-bg)',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Left column — players in turn order */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 250 }}>
        {COLOR_ORDER.map((c) => {
          const { nameSuffix, tag } = seatMeta(c);
          return (
            <PlayerCard
              key={c}
              color={c}
              state={G.colors[c]}
              colors={colors}
              nameSuffix={nameSuffix}
              tag={tag}
              active={c === activeColor && !ctx.gameover}
              inventoryDisplay={inventoryDisplay}
            />
          );
        })}
      </div>

      {/* Center column — framed board · rotate · status · dock */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        {/* Walnut frame + recessed mat around the (unchanged) board grid. */}
        <div
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
            <div
              data-testid="board-rotator"
              style={{
                display: 'inline-block',
                transform: `rotate(${boardTurns * 90}deg)`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease',
                verticalAlign: 'top',
              }}
            >
              <Board
                board={G.board}
                activeColor={activeColor}
                preview={preview}
                lastMove={G.lastMove}
                startHint={startHint}
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
        </div>

        {/* Rotate-board control, sat under the board so its top aligns with the panels. */}
        <button
          data-testid="rotate-board"
          // Increment without wrapping so the CSS transform always animates
          // forward (270°→360° instead of 270°→0°, which spins backwards).
          onClick={() => setBoardTurns((t) => t + 1)}
          title="Rotate the board view 90°"
          style={{
            alignSelf: 'flex-end',
            fontFamily: FONT_UI,
            fontSize: 11.5,
            border: '1px solid var(--top-bd)',
            background: 'var(--top-bg)',
            color: 'var(--top-ink)',
            borderRadius: 999,
            padding: '4px 11px',
            cursor: 'pointer',
          }}
        >
          Rotate board ⟲
        </button>

        {/* Status line — also carries the machine-readable active color. */}
        <p
          role="status"
          data-testid="turn-status"
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--top-mut)',
            textAlign: 'center',
            maxWidth: 620,
          }}
        >
          {statusMain}
          <span style={{ color: 'var(--top-mut)' }}>
            {' · '}active{' '}
            <span style={{ color: colors[activeColor], fontWeight: 700 }}>{activeColor}</span>
          </span>
        </p>

        <Controls
          pieceId={sel.pieceId}
          color={activeColor}
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

      {/* Right column — your hand + standings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {homeColor && (
          <HandTray
            color={homeColor}
            state={G.colors[homeColor]}
            interactive={canPlay && homeColor === activeColor}
            selectedId={homeColor === activeColor ? sel.pieceId : null}
            onSelect={sel.selectPiece}
          />
        )}
        <div
          style={{
            width: 300,
            background: 'var(--pnl)',
            border: '1px solid var(--pnl-bd)',
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: '0 14px 28px rgba(15,9,3,.32)',
            boxSizing: 'border-box',
          }}
        >
          <Standings G={G} />
        </div>
      </div>

      {ctx.gameover && (
        <GameOverModal
          gameover={ctx.gameover as GameOverPayload}
          winnerColors={COLOR_ORDER.filter((c) => {
            const owner = G.config.owners[c];
            return owner !== 'shared' && winners.includes(owner);
          })}
        />
      )}
    </div>
  );
}
