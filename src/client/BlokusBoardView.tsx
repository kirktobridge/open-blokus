import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { Color, GameState, PieceId } from '../game/types';
import { COLOR_ORDER } from '../game/types';
import { BOARD_SIZE } from '../shared/constants';
import { resolveCells } from '../game/pieces';
import { isLegalPlacement } from '../game/placement';
import { CORNERS } from '../game/modes';
import { Board } from './board/Board';
import { BoardFrame } from './board/BoardFrame';
import { deadPieces, legalTargetCells } from './advisor/legalMoves';
import { RoomMeter } from './advisor/RoomMeter';
import type { Hint } from './advisor/LegalMoveHints';
import { HandTray } from './tray/HandTray';
import { Standings } from './controls/ScorePanel';
import { PlayerCard, type SeatTag } from './controls/PlayerCard';
import { Controls } from './controls/Controls';
import { ReactionBar } from './controls/ReactionBar';
import { GameOverModal, type GameOverPayload } from './controls/GameOverModal';
import { EventBeats } from './controls/EventBeats';
import { matchAction, type PlacementAction } from './controls/keymap';
import { useSelection } from './hooks/useSelection';
import { useGameEvents } from './hooks/useGameEvents';
import { useGameSound } from './sound/useGameSound';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useReactions } from './hooks/useReactions';
import { isRealName } from './lobby/config';
import { reactionMessage } from './lobby/reactions';
import { BlitzBoardBar } from './blitz/BlitzBoardBar';
import { BLITZ_URGENT_MS } from './blitz/blitz';
import { usePrefs } from './settings';
import { DOCK_COLUMN_W, FONT_MONO, FONT_UI, PIECE_VAR } from './theme';
import type { Difficulty } from './ai/difficulty';
import type { GameRecord } from '../game/ai/selfplay';
import { TURNS_TO_BOTTOM_RIGHT } from './board/orientation';

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
  blitzRemainingMs,
  blitzLimitMs,
  gameRecord,
  onReview,
  matchData,
  chatMessages,
  sendChatMessage,
  isMultiplayer,
}: BoardProps<GameState> & {
  botDifficulties?: Record<string, Difficulty>;
  /** Live blitz countdown for the board-side bar (P24); null/absent = no clock. */
  blitzRemainingMs?: number | null;
  blitzLimitMs?: number | null;
  /** Finished-game record enabling the game-over "Review game" entry (P2 R0). */
  gameRecord?: GameRecord | null;
  /** Dismiss the ceremony into in-table review mode (P2 R0.2); offline only. */
  onReview?: () => void;
}) {
  const sel = useSelection();
  const activeColor = COLOR_ORDER[G.activeColorIndex];
  // Single-player passes isActive=true for the current player; multiplayer gates it.
  const canPlay = isActive !== false && !ctx.gameover;
  const prefs = usePrefs();
  const inventoryDisplay = prefs.inventoryDisplay;
  const reduce = useReducedMotion();
  const { beats } = useGameEvents(G);

  // Sound (P7) rides the same beat stream the banners do, so a cue and its banner are
  // the same moment; placement/pickup/blitz-tick cues come from the state below.
  useGameSound({ G, beats, selectedPieceId: sel.pieceId, blitzRemainingMs });

  // A cut beat carries the corners it destroyed (P32); mark them on the board for
  // exactly as long as the beat lives, so the banner and the scars share one TTL.
  const cutMarks = useMemo(
    () =>
      beats
        .filter((b) => b.kind === 'cut' && b.color && b.lostCells?.length)
        .map((b) => ({ id: b.id, color: b.color as Color, cells: b.lostCells! })),
    [beats],
  );

  // Multiplayer identity & reactions (P19). Seat nicknames come from the match
  // metadata (the default `Player N` reads as anonymous); reactions ride the chat
  // transport and surface as per-seat bubbles. Both are inert offline (matchData /
  // chat props are absent), so nothing renders in the vs-AI table.
  const seatNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of matchData ?? []) {
      if (isRealName(m.name)) out[String(m.id)] = m.name;
    }
    return out;
  }, [matchData]);
  const reactions = useReactions(chatMessages);
  const onReact = (id: string) => sendChatMessage?.(reactionMessage(id));

  // Blitz legibility (P24): in the final seconds the board frame itself gains a
  // red glow ring — a peripheral board-edge tint dead-center in the field of view.
  // Static (reduced-motion-safe); the breathing lives on the countdown bar's fill.
  const blitzUrgent = blitzRemainingMs != null && blitzRemainingMs <= BLITZ_URGENT_MS;

  // Board-frame shake on a rejected placement (P16). Uses the Web Animations API
  // so it replays on the same element without a remount hack; no-op if motion is
  // reduced or the element can't animate (SSR / older engines).
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

  // Orient the board to the local seat's color (bottom-right); manual button cycles.
  const homeColor =
    playerID != null ? COLOR_ORDER.find((c) => G.config.owners[c] === playerID) : undefined;
  const [boardTurns, setBoardTurns] = useState(
    homeColor ? TURNS_TO_BOTTOM_RIGHT[homeColor] : 0,
  );

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
      ? isLegalPlacement(G, activeColor, sel.pieceId, oriented)
      : false;
  const preview =
    sel.pieceId && sel.hover
      ? { cells: new Set(oriented.map((c) => `${c.x},${c.y}`)), legal, staged: sel.staged }
      : undefined;

  // Advisor (P3 R1): an opt-in overlay marking every square the selected piece
  // could legally land on. The expensive part (generateLegalMoves) is memoized on
  // piece + board only, so hovering doesn't recompute it; the hovered footprint is
  // then excluded so the live preview stays crisp.
  // Both advisor overlays are opt-in *preferences* now (P38): set in Settings →
  // Gameplay, not as under-board buttons. Off by default; coaching-only.
  const advisorOn = prefs.moveOptions;
  const roomOn = prefs.cornerCounter;
  const advisorTargets = useMemo(
    () =>
      advisorOn && canPlay && sel.pieceId ? legalTargetCells(G, activeColor, sel.pieceId) : [],
    [advisorOn, canPlay, sel.pieceId, G, activeColor],
  );
  const advisorHints = useMemo<Hint[]>(() => {
    if (advisorTargets.length === 0) return [];
    const hovered = new Set(oriented.map((c) => c.y * BOARD_SIZE + c.x));
    const cells = advisorTargets.filter((c) => !hovered.has(c));
    // Tint the hints in the active color so they read as "where your piece fits".
    return cells.length > 0
      ? [{ id: 'legal', cells, tone: 'legal', color: PIECE_VAR[activeColor] }]
      : [];
  }, [advisorTargets, oriented, activeColor]);

  // Dead-piece shading (P39): per-color sets of still-held pieces with no legal
  // move left, gated by the two opt-in toggles. Self = the seat(s) this client
  // owns (mirrors the `isYou` test below); Opponents = everyone else. Computed
  // once per G change (and only for colors a toggle will actually shade), so the
  // per-color `generateLegalMoves` sweep — the cost the scope flags — never runs
  // for a color whose overlay is off.
  const deadSelfOn = prefs.deadPieceSelf;
  const deadOppOn = prefs.deadPieceOpponents;
  const deadByColor = useMemo(() => {
    const out = {} as Record<Color, Set<PieceId>>;
    for (const c of COLOR_ORDER) {
      const self = playerID != null && G.config.owners[c] === playerID;
      const show = self ? deadSelfOn : deadOppOn;
      out[c] = show ? new Set(deadPieces(G, c)) : new Set();
    }
    return out;
  }, [deadSelfOn, deadOppOn, G, playerID]);

  const canSubmit = sel.staged && legal;

  // Shake the board the moment a placement is locked onto an illegal spot — the
  // "that doesn't fit" beat (P16). Fires on the transition into staged-illegal
  // (a click/keyboard lock), not on every re-render while it sits there.
  const stagedIllegal = canPlay && sel.staged && sel.pieceId != null && sel.hover != null && !legal;
  const wasStagedIllegal = useRef(false);
  useEffect(() => {
    if (stagedIllegal && !wasStagedIllegal.current) shake();
    wasStagedIllegal.current = stagedIllegal;
    // shake reads live refs; re-running only on the flag transition is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedIllegal]);

  // Clear a half-composed placement when your turn ends. Submitting resets the
  // selection itself, but blitz ends a turn *without* a submit (P20 M1) — leaving
  // the staged ghost, often an illegal red one, painted into your next turn. The
  // tray is only interactive on your own turn, so there's never a pre-selection to
  // lose here.
  const yourTurn = homeColor != null && activeColor === homeColor;
  const resetSelection = sel.reset;
  const wasYourTurn = useRef(yourTurn);
  useEffect(() => {
    if (wasYourTurn.current && !yourTurn) resetSelection();
    wasYourTurn.current = yourTurn;
  }, [yourTurn, resetSelection]);

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
        // Committing a locked-but-illegal placement: reject with a shake rather
        // than silently doing nothing.
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
    const nick = owner !== 'shared' ? seatNames[owner] : undefined;
    const nameSuffix = isYou ? 'You' : (diff ?? nick ?? null);

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
  else if (sel.staged && !legal) statusMain = 'Illegal spot — click to pick it back up, or cancel.';
  else if (sel.staged && legal)
    statusMain = 'Locked — Enter or PLAY MOVE to confirm · click to reposition.';
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
          const owner = G.config.owners[c];
          return (
            <PlayerCard
              key={c}
              color={c}
              state={G.colors[c]}
              nameSuffix={nameSuffix}
              tag={tag}
              active={c === activeColor && !ctx.gameover}
              inventoryDisplay={inventoryDisplay}
              reaction={owner !== 'shared' ? reactions[owner] : undefined}
              dead={deadByColor[c]}
            />
          );
        })}
      </div>

      {/* Center column — framed board · rotate · status · dock. Pinned width so the
          side columns clear the wider-than-board action dock and the review table
          can mirror it exactly (DOCK_COLUMN_W). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', width: DOCK_COLUMN_W }}>
        {/* Blitz countdown, in the field of view (P24). Inert unless a clock runs. */}
        <BlitzBoardBar
          remainingMs={blitzRemainingMs ?? null}
          limitMs={blitzLimitMs ?? null}
          reduce={reduce}
        />

        {/* Walnut frame + recessed mat around the (unchanged) board grid. */}
        <BoardFrame outerRef={frameRef} urgent={blitzUrgent}>
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
              onCellClick={interactive ? sel.stageAt : undefined}
              onLeave={() => {
                if (!sel.staged) sel.setHover(null);
              }}
              onRotate={interactive ? sel.rotate : undefined}
              onFlip={interactive ? sel.flip : undefined}
              hints={advisorHints}
              cutMarks={cutMarks}
            />
          </div>
        </BoardFrame>

        {/* Under-board controls: rotate board. The opt-in advisor overlays moved to
            Settings → Gameplay (P38), so the board's surroundings stay for play. */}
        <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            data-testid="rotate-board"
            // Increment without wrapping so the CSS transform always animates
            // forward (270°→360° instead of 270°→0°, which spins backwards).
            onClick={() => setBoardTurns((t) => t + 1)}
            title="Rotate the board view 90°"
            style={{
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
        </div>

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
            <span style={{ color: PIECE_VAR[activeColor], fontWeight: 700 }}>{activeColor}</span>
          </span>
        </p>

        <Controls
          pieceId={sel.pieceId}
          color={activeColor}
          disabled={!canPlay}
          staged={sel.staged}
          canSubmit={canSubmit}
          onRotate={sel.rotate}
          onFlip={sel.flip}
          onSubmit={submitMove}
          onCancel={cancel}
        />

        {/* Reactions (P19) — online only; offline has no transport to broadcast on
            (the vs-AI table builds boardProps without the multiplayer flag). */}
        {isMultiplayer && <ReactionBar onReact={onReact} />}
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
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {roomOn && <RoomMeter G={G} />}
          <Standings G={G} />
        </div>
      </div>

      <EventBeats beats={beats} />

      {ctx.gameover && (
        <GameOverModal
          G={G}
          gameover={ctx.gameover as GameOverPayload}
          winnerColors={COLOR_ORDER.filter((c) => {
            const owner = G.config.owners[c];
            return owner !== 'shared' && winners.includes(owner);
          })}
          gameRecord={gameRecord}
          onReview={onReview}
        />
      )}
    </div>
  );
}
