import type { CSSProperties } from 'react';
import type { Color, PieceId } from '../../game/types';
import { PIECES, pieceSize } from '../../game/pieces';
import { FONT_MONO, FONT_UI } from '../theme';
import type { PaletteColors } from '../palettes';
import { primaryKey } from './keymap';

/** A small keycap badge, e.g. `Enter` inside PLAY MOVE. */
function Keycap({ children, tone = 'dark' }: { children: string; tone?: 'dark' | 'light' }) {
  const style: CSSProperties =
    tone === 'light'
      ? { background: 'rgba(255,255,255,.22)', color: '#fff' }
      : { background: 'var(--ink)', color: 'var(--pnl)' };
  return (
    <span
      style={{
        ...style,
        fontFamily: FONT_MONO,
        fontSize: 9.5,
        fontWeight: 600,
        borderRadius: 4,
        padding: '2px 5px',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

/** A tiny fixed-size preview of a piece's base shape (in-hand slot). */
function SlotPreview({
  pieceId,
  color,
  colors,
}: {
  pieceId: PieceId;
  color: Color;
  colors: PaletteColors;
}) {
  const cells = PIECES[pieceId];
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  const filled = new Set(cells.map((c) => `${c.x},${c.y}`));
  const px = 10;
  const squares = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = filled.has(`${x},${y}`);
      squares.push(
        <div
          key={`${x},${y}`}
          style={{
            width: px,
            height: px,
            background: on ? colors[color] : 'transparent',
            borderRadius: on ? 2 : 0,
            boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,.4)' : undefined,
          }}
        />,
      );
    }
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${w}, ${px}px)`, gap: 1 }}>
      {squares}
    </div>
  );
}

const TOOL_TILE: CSSProperties = {
  width: 48,
  height: 40,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  background: 'var(--well)',
  border: '1px solid var(--pnl-bd)',
  borderRadius: 10,
  cursor: 'pointer',
  color: 'var(--ink)',
};

const DIVIDER: CSSProperties = { width: 1, height: 46, background: 'var(--pnl-bd)' };

/**
 * The action dock: in-hand slot → PLAY MOVE → ⟲ ⟳ ⇄ → Cancel. Order is
 * intentional (see design handoff). Buttons keep their original test ids.
 */
export function Controls({
  pieceId,
  color,
  colors,
  disabled,
  staged,
  canSubmit,
  onRotate,
  onFlip,
  onSubmit,
  onCancel,
}: {
  pieceId: PieceId | null;
  color: Color;
  colors: PaletteColors;
  disabled: boolean;
  staged: boolean;
  canSubmit: boolean;
  onRotate: (dir: 1 | -1) => void;
  onFlip: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const toolsDisabled = disabled || !pieceId;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--pnl)',
        border: '1px solid var(--pnl-bd)',
        borderRadius: 16,
        padding: '11px 16px',
        fontFamily: FONT_UI,
        color: 'var(--ink)',
        boxShadow: '0 16px 32px rgba(15,9,3,.38)',
      }}
    >
      {/* 1. In-hand slot */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 10,
          background: 'var(--well)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {pieceId ? <SlotPreview pieceId={pieceId} color={color} colors={colors} /> : null}
      </div>

      {/* 2. Label block */}
      <div style={{ minWidth: 78 }}>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            letterSpacing: '.1em',
            color: 'var(--mut)',
          }}
        >
          IN HAND
        </div>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>
          {pieceId ? `${pieceId} · ${pieceSize(pieceId)} sq` : '—'}
        </div>
      </div>

      <div style={DIVIDER} />

      {/* 4. Primary — PLAY MOVE */}
      <button
        data-testid="submit-move"
        disabled={!canSubmit}
        onClick={onSubmit}
        title="Play the staged move (Enter)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: 'none',
          borderRadius: 12,
          padding: '12px 22px',
          fontFamily: FONT_UI,
          fontWeight: 600,
          fontSize: 15,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: canSubmit ? '#3468cf' : 'var(--well)',
          color: canSubmit ? '#fff' : '#a5987f',
          animation: staged && canSubmit ? 'ob-pulse 1.8s ease-out infinite' : undefined,
        }}
      >
        PLAY MOVE
        <Keycap tone={canSubmit ? 'light' : 'dark'}>{primaryKey('submit')}</Keycap>
      </button>

      <div style={DIVIDER} />

      {/* 6. Tool tiles ⟲ ⟳ ⇄ */}
      <button
        data-testid="rotate-ccw"
        disabled={toolsDisabled}
        onClick={() => onRotate(-1)}
        title="Rotate counter-clockwise (A / scroll)"
        style={{ ...TOOL_TILE, opacity: toolsDisabled ? 0.5 : 1 }}
      >
        <span style={{ fontSize: 17, lineHeight: 1 }}>⟲</span>
        <Keycap>{primaryKey('rotateCCW')}</Keycap>
      </button>
      <button
        data-testid="rotate"
        disabled={toolsDisabled}
        onClick={() => onRotate(1)}
        title="Rotate clockwise (D / scroll)"
        style={{ ...TOOL_TILE, opacity: toolsDisabled ? 0.5 : 1 }}
      >
        <span style={{ fontSize: 17, lineHeight: 1 }}>⟳</span>
        <Keycap>{primaryKey('rotateCW')}</Keycap>
      </button>
      <button
        data-testid="flip"
        disabled={toolsDisabled}
        onClick={onFlip}
        title="Flip (F / right-click)"
        style={{ ...TOOL_TILE, opacity: toolsDisabled ? 0.5 : 1 }}
      >
        <span style={{ fontSize: 17, lineHeight: 1 }}>⇄</span>
        <Keycap>{primaryKey('flip')}</Keycap>
      </button>

      <div style={DIVIDER} />

      {/* 8. Cancel */}
      <button
        data-testid="clear"
        disabled={disabled || !pieceId}
        onClick={onCancel}
        title="Cancel (Esc)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--well)',
          border: '1px solid var(--pnl-bd)',
          borderRadius: 10,
          padding: '10px 14px',
          fontFamily: FONT_UI,
          fontSize: 13,
          color: 'var(--ink)',
          cursor: disabled || !pieceId ? 'not-allowed' : 'pointer',
          opacity: disabled || !pieceId ? 0.5 : 1,
        }}
      >
        CANCEL
        <Keycap>{primaryKey('cancel')}</Keycap>
      </button>
    </div>
  );
}
