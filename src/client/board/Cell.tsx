import type { Color } from '../../game/types';
import { EMPTY_CELL, GRID_LINE, CELL_PX } from '../theme';
import type { PaletteColors } from '../palettes';

export type PreviewState = 'none' | 'legal' | 'illegal';

export function Cell({
  value,
  preview,
  staged = false,
  startHint = false,
  previewColor,
  colors,
  lastMove = false,
  testId,
  label,
  onEnter,
  onClick,
}: {
  value: Color | null;
  preview: PreviewState;
  staged?: boolean;
  /** Marks the active color's starting corner before its first move. */
  startHint?: boolean;
  previewColor: Color;
  colors: PaletteColors;
  lastMove?: boolean;
  testId?: string;
  label?: string;
  onEnter?: () => void;
  onClick?: () => void;
}) {
  let background = value ? colors[value] : EMPTY_CELL;
  let opacity = 1;
  if (preview === 'legal') {
    background = colors[previewColor];
    opacity = staged ? 0.85 : 0.55;
  } else if (preview === 'illegal') {
    background = '#ef4444';
    opacity = staged ? 0.85 : 0.55;
  }

  // Corner marker: only when empty and not currently under a preview.
  const showHint = startHint && preview === 'none' && !value;

  return (
    <div
      data-testid={testId}
      data-value={value ?? ''}
      data-lastmove={lastMove}
      data-starthint={showHint}
      role={onClick ? 'button' : undefined}
      aria-label={label}
      onMouseEnter={onEnter}
      onClick={onClick}
      style={{
        width: CELL_PX,
        height: CELL_PX,
        background: showHint ? colors[previewColor] : background,
        opacity: showHint ? 0.3 : opacity,
        border: `1px solid ${GRID_LINE}`,
        boxShadow: staged
          ? 'inset 0 0 0 2px var(--outline-strong)'
          : showHint
            ? `inset 0 0 0 2px ${colors[previewColor]}`
            : lastMove
              ? 'inset 0 0 0 3px var(--last-move-ring)'
              : undefined,
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
      }}
    />
  );
}
