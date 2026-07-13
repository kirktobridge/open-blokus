import { useMemo } from 'react';
import type { Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';
import type { PaletteColors } from '../palettes';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { cellOutline } from './outline';

const C = CELL_PX;
const SIZE = BOARD_SIZE * C;
const EMPTY_SET: ReadonlySet<number> = new Set();

interface Region {
  color: Color;
  /** Union of the region's cell squares — one fill path (renders as one shape). */
  fillD: string;
  /** Top/left silhouette edges → light bevel. */
  highlightD: string;
  /** Bottom/right silhouette edges → dark shadow edge. */
  shadowD: string;
}

/**
 * Connected same-color cells form one region. Blokus forbids same-color pieces
 * from touching edge-to-edge, so a 4-connected same-color component is exactly
 * one placed piece — no per-piece id needed. Preview cells are excluded so a
 * piece's finish never paints over the live (illegal) placement feedback.
 */
function buildRegions(board: (Color | null)[], exclude: ReadonlySet<number>): Region[] {
  const n = BOARD_SIZE;
  const colorAt = (idx: number): Color | null =>
    idx >= 0 && idx < board.length && !exclude.has(idx) ? board[idx] : null;

  const visited = new Uint8Array(board.length);
  const regions: Region[] = [];

  for (let i = 0; i < board.length; i++) {
    const color = colorAt(i);
    if (!color || visited[i]) continue;

    // Flood-fill this component.
    const cells: number[] = [];
    const stack = [i];
    visited[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const x = c % n;
      const y = (c / n) | 0;
      const nbrs: number[] = [];
      if (x > 0) nbrs.push(c - 1);
      if (x < n - 1) nbrs.push(c + 1);
      if (y > 0) nbrs.push(c - n);
      if (y < n - 1) nbrs.push(c + n);
      for (const m of nbrs) {
        if (!visited[m] && colorAt(m) === color) {
          visited[m] = 1;
          stack.push(m);
        }
      }
    }

    // Fill = union of squares; bevel = only the silhouette (edges facing a
    // non-region cell), split into top/left (light) and bottom/right (dark).
    let fillD = '';
    let highlightD = '';
    let shadowD = '';
    for (const c of cells) {
      const x = c % n;
      const y = (c / n) | 0;
      const px = x * C;
      const py = y * C;
      fillD += `M${px} ${py}h${C}v${C}h${-C}z`;
      if ((y > 0 ? colorAt(c - n) : null) !== color) highlightD += `M${px} ${py}h${C}`;
      if ((x > 0 ? colorAt(c - 1) : null) !== color) highlightD += `M${px} ${py}v${C}`;
      if ((y < n - 1 ? colorAt(c + n) : null) !== color) shadowD += `M${px} ${py + C}h${C}`;
      if ((x < n - 1 ? colorAt(c + 1) : null) !== color) shadowD += `M${px + C} ${py}v${C}`;
    }
    regions.push({ color, fillD, highlightD, shadowD });
  }
  return regions;
}

/**
 * Skeuomorphic finish for placed pieces, drawn as one SVG overlay above the
 * interactive cell grid (pointer-events: none, so clicks fall through). Each
 * piece is a single joined polyomino: translucent fill, one soft contact
 * shadow, global top-down volume shading, per-piece silhouette bevel, and a
 * faint grain. Parameterized entirely by the palette's hex colors.
 */
export function PlacedLayer({
  board,
  colors,
  previewCells,
  lastMove,
  glowColors,
}: {
  board: (Color | null)[];
  colors: PaletteColors;
  /** Board indices currently under a placement preview (excluded from finish). */
  previewCells?: ReadonlySet<number>;
  /** Board indices of the most recent placement (drawn with a highlight ring). */
  lastMove?: number[];
  /** Colors whose pieces get a glowing halo (game-over winner reveal, P16). */
  glowColors?: Color[];
}) {
  const reduce = useReducedMotion();
  const exclude = previewCells ?? EMPTY_SET;
  const regions = useMemo(() => buildRegions(board, exclude), [board, exclude]);
  const allFillsD = useMemo(() => regions.map((r) => r.fillD).join(''), [regions]);
  const glowSet = glowColors && glowColors.length > 0 ? new Set(glowColors) : undefined;
  // Remount key so the settle flash replays exactly once per placement.
  const settleKey = lastMove && lastMove.length > 0 ? lastMove.join(',') : '';
  // The last move's own silhouette + fill (the fill is only ever a clip for the ring).
  const ring = useMemo(
    () => (lastMove && lastMove.length > 0 ? cellOutline(lastMove) : null),
    [lastMove],
  );

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        {/* Global top-down volume so lighting is consistent across all pieces.
            Bright top reads as light entering the translucent plastic. */}
        <linearGradient id="pl-vol" x1="0" y1="0" x2="0" y2={SIZE} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.14" />
        </linearGradient>
        {/* One soft contact shadow for the whole placed layer. */}
        <filter id="pl-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="1" floodColor="#000000" floodOpacity="0.35" />
        </filter>
        {/* Very light desaturated grain. */}
        <filter id="pl-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix in="noise" type="saturate" values="0" />
        </filter>
        {/* Glossy plastic sheen: a specular lip along the (blurred) silhouette,
            lit from the top-left. Pure white highlight, clipped to the shape. */}
        <filter id="pl-gloss" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="glossBlur" />
          <feSpecularLighting
            in="glossBlur"
            surfaceScale="4"
            specularConstant="0.75"
            specularExponent="16"
            lightingColor="#ffffff"
            result="glossSpec"
          >
            <feDistantLight azimuth="235" elevation="62" />
          </feSpecularLighting>
          <feComposite in="glossSpec" in2="SourceAlpha" operator="in" />
        </filter>
        {/* Soft colored halo for glowing (winner) pieces in the reveal mosaic. */}
        <filter id="pl-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        {/* Clip for uniform layers (volume, grain) — union of all pieces. */}
        <clipPath id="pl-all">
          <path d={allFillsD} />
        </clipPath>
        {/* Per-piece clips so bevel strokes stay inside their own silhouette
            (different colors may share an edge, so a global clip won't do). */}
        {regions.map((r, i) => (
          <clipPath key={i} id={`pl-r${i}`}>
            <path d={r.fillD} />
          </clipPath>
        ))}
        {/* Clip for the last-move ring — the just-played piece only. */}
        {ring && (
          <clipPath id="pl-last">
            <path d={ring.fillD} />
          </clipPath>
        )}
      </defs>

      {/* Winner glow (reveal only): blurred colored copies beneath the fills so
          the halo bleeds out around the winning color's pieces. */}
      {glowSet && (
        <g className={reduce ? undefined : 'ob-glow'} filter="url(#pl-glow)">
          {regions
            .filter((r) => glowSet.has(r.color))
            .map((r, i) => (
              <path key={i} d={r.fillD} fill={colors[r.color]} />
            ))}
        </g>
      )}

      {/* Translucent fills sharing one contact shadow. */}
      <g filter="url(#pl-shadow)">
        {regions.map((r, i) => (
          <path key={i} d={r.fillD} fill={colors[r.color]} fillOpacity={0.92} />
        ))}
      </g>

      {/* Global volume shading, confined to the pieces. */}
      <rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#pl-vol)" clipPath="url(#pl-all)" />

      {/* Per-piece silhouette bevel (clipped to keep the inner half only), plus a
          thin bright rim on every edge so the dye "light-pipes" at its border. */}
      {regions.map((r, i) => (
        <g key={i} clipPath={`url(#pl-r${i})`}>
          <path
            d={r.highlightD}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.55}
            strokeWidth={3}
          />
          <path d={r.shadowD} fill="none" stroke="#000000" strokeOpacity={0.35} strokeWidth={3} />
          <path
            d={`${r.highlightD}${r.shadowD}`}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.22}
            strokeWidth={1.2}
          />
        </g>
      ))}

      {/* Glossy plastic sheen over the pieces. */}
      <path d={allFillsD} fill="#000000" filter="url(#pl-gloss)" opacity={0.85} />

      {/* Faint grain over the pieces. */}
      <rect
        x={0}
        y={0}
        width={SIZE}
        height={SIZE}
        filter="url(#pl-grain)"
        clipPath="url(#pl-all)"
        opacity={0.06}
      />

      {/* Last-move ring, crisp above the finish: one outline around the *piece*, not a
          box per cell — the piece's internal seams aren't its border (P31). Stroked on
          the silhouette and clipped to the piece, so only the inner half shows and the
          ring can't bleed onto a neighbor sharing that edge. */}
      {ring && (
        <g clipPath="url(#pl-last)">
          <path
            data-testid="last-move-ring"
            d={ring.outlineD}
            fill="none"
            strokeWidth={6}
            strokeLinecap="square"
            style={{ stroke: 'var(--brass)' }}
          />
        </g>
      )}

      {/* Placement settle: a one-shot white flash over the just-placed cells that
          pops and fades, reading as the piece landing. Keyed so it replays per
          placement; suppressed under reduced motion. */}
      {!reduce && settleKey !== '' && (
        <g key={settleKey} className="ob-settle">
          {lastMove!.map((idx) => {
            const x = idx % BOARD_SIZE;
            const y = (idx / BOARD_SIZE) | 0;
            return <rect key={idx} x={x * C} y={y * C} width={C} height={C} fill="#ffffff" />;
          })}
        </g>
      )}
    </svg>
  );
}
