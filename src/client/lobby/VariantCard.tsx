import type { Color, Variant } from '../../game/types';
import { VARIANTS } from '../../game/modes';
import { CELL_PX } from '../theme';
import { PlacedLayer } from '../board/PlacedLayer';

/**
 * The variant choice as a board, not a dropdown (P65 M1).
 *
 * Classic-vs-Duo is the most consequential control on the setup screen — it changes
 * the board size, the color count, and where you start — and it used to render as two
 * words behind a `title` tooltip that touch devices never show. Here each option shows
 * the thing it selects: a real board at that variant's true geometry, with its start
 * cells dealt in its own piece colors, so the 20×20/4-corner and 14×14/2-interior
 * difference is visible without reading anything.
 *
 * **Static cells only** — no timers, no engine, no ambient replay. `AmbientBoard` is
 * decorative and may move; this is a *control* on a screen whose job is to be exited,
 * and motion here would compete with the CTA. It also keeps P29's property that the
 * lobby bundle carries no move generator.
 *
 * Geometry reads from `VARIANTS[variant]` — the variant-keyed seam. The
 * `boardSizeOf`/`startCellOf` helpers take a `GameState`, and no game exists at setup
 * time, so they don't apply here.
 */

/** Board px the card renders at. Small enough to sit two-up in the 640px column. */
const CARD_BOARD_PX = 140;

/**
 * A board array holding nothing but this variant's start cells.
 *
 * Exported for test: this is the whole variant-sensitive claim of the card — that
 * Classic draws 4 corners on 400 squares and Duo 2 interior cells on 196 — and it is
 * pure, so it is checkable without rendering React.
 */
export function startCellBoard(variant: Variant): (Color | null)[] {
  const { boardSize, playColors, startCells } = VARIANTS[variant];
  const board: (Color | null)[] = Array.from({ length: boardSize * boardSize }, () => null);
  for (const color of playColors) {
    const cell = startCells[color];
    // ByColor is partial by design; a color in playColors always has one, but the
    // typechecker can't know that.
    if (cell) board[cell.y * boardSize + cell.x] = color;
  }
  return board;
}

/**
 * A non-interactive board preview at `CARD_BOARD_PX`, scaled from its true pixel size
 * the way `AmbientBoard` does, over the same mat/grid recipe — so a 14×14 board draws
 * with the same cell size as a 20×20 one and simply comes out smaller, which is the
 * point of showing them side by side.
 */
function VariantBoard({ variant }: { variant: Variant }) {
  const { boardSize } = VARIANTS[variant];
  const fullPx = boardSize * CELL_PX;

  return (
    <div
      aria-hidden="true"
      style={{ width: CARD_BOARD_PX, height: CARD_BOARD_PX, pointerEvents: 'none' }}
    >
      <div
        style={{
          position: 'relative',
          width: fullPx,
          height: fullPx,
          transform: `scale(${CARD_BOARD_PX / fullPx})`,
          transformOrigin: 'top left',
          background: 'var(--mat)',
          backgroundImage: `repeating-linear-gradient(0deg, var(--grid) 0 1px, transparent 1px ${CELL_PX}px), repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px ${CELL_PX}px)`,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px var(--pnl-bd)',
        }}
      >
        <PlacedLayer board={startCellBoard(variant)} />
      </div>
    </div>
  );
}

/** One selectable variant option: its board, its name, and a one-line caption. */
export function VariantCard({
  variant,
  label,
  caption,
  selected,
  onSelect,
}: {
  variant: Variant;
  label: string;
  caption: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`variant-card-${variant}`}
      // The group is a radio set, not a set of independent buttons: screen readers
      // should hear "2 of 2 selected", and the visual selected state needs a
      // non-visual twin.
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 9,
        flex: '1 1 0',
        cursor: 'pointer',
        padding: '13px 11px',
        borderRadius: 12,
        background: selected ? 'var(--well)' : 'transparent',
        // Selection reads as a ring in the accent, unselected as a quiet edge —
        // both are always present, so the card never changes size on selection.
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--pnl-bd)'}`,
        color: 'var(--ink)',
        font: 'inherit',
        textAlign: 'center',
      }}
    >
      <VariantBoard variant={variant} />
      <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
      <span style={{ color: 'var(--mut)', fontSize: 12, lineHeight: 1.4 }}>{caption}</span>
    </button>
  );
}
