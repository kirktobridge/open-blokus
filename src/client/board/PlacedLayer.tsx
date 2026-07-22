import { useMemo } from 'react';
import type { Color } from '../../game/types';
import { CELL_PX, PIECE_VAR, TILE_FINISH, tileVar, type TileFinish } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { cellOutline } from './outline';

const C = CELL_PX;
const EMPTY_SET: ReadonlySet<number> = new Set();

/** SVG-id-safe key for a value class (`''` → `base`, `-dark` → `dark`). */
const finishKey = (f: TileFinish): string => (f === '' ? 'base' : f.slice(1));

interface Region {
  color: Color;
  /** Which `--tile-*` fork molds this region — see TILE_FINISH (P20 M2c). */
  finish: TileFinish;
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
function buildRegions(
  board: (Color | null)[],
  exclude: ReadonlySet<number>,
  n: number,
): Region[] {
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
    regions.push({ color, finish: TILE_FINISH[color], fillD, highlightD, shadowD });
  }
  return regions;
}

/**
 * The per-cell molding for one value class: frame bevel (light top-left, dark
 * bottom-right), an inverted recess rim around the translucent window, a
 * top-edge glint, and a seam so same-piece cells still read as individually
 * molded squares. All inset 0.75px so strokes aren't clipped at the tile edge.
 *
 * Emitted once per class present on the board rather than once for the whole
 * layer, because a `<pattern>`'s content inherits custom properties from where
 * it *sits* (the `<defs>`), not from the element that references it — so a
 * `--tile-hi` override on the referencing rect would do nothing, and each class
 * needs its own copy resolving its own fork of the tokens.
 */
function TileDetailPattern({ finish }: { finish: TileFinish }) {
  return (
    <pattern
      id={`pl-tile-detail-${finishKey(finish)}`}
      patternUnits="userSpaceOnUse"
      width={C}
      height={C}
    >
      {/* Frame bevel: light top+left, dark bottom+right. */}
      <path
        d="M0.75 29.25 L0.75 0.75 L29.25 0.75"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.5}
        style={{ opacity: tileVar('--tile-hi', finish) }}
      />
      <path
        d="M0.75 29.25 L29.25 29.25 L29.25 0.75"
        fill="none"
        stroke="#000000"
        strokeWidth={1.5}
        style={{ opacity: tileVar('--tile-lo', finish) }}
      />
      {/* Window recess rim, inverted: dark top+left, light bottom+right. At the
          translucent window boundary, so the amplitudes are the theme's
          (--tile-rim-lo/-hi) — a dark mat swallows the dark side. */}
      <path
        d="M5.5 24.5 L5.5 5.5 L24.5 5.5"
        fill="none"
        stroke="#000000"
        strokeWidth={1}
        style={{ strokeOpacity: tileVar('--tile-rim-lo', finish) }}
      />
      <path
        d="M5.5 24.5 L24.5 24.5 L24.5 5.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1}
        style={{ strokeOpacity: tileVar('--tile-rim-hi', finish) }}
      />
      {/* Top-edge glint. */}
      <rect
        x={4.5}
        y={1.6}
        width={6}
        height={1.6}
        rx={0.8}
        style={{ fill: tileVar('--tile-glint', finish) }}
        opacity={0.5}
      />
      {/* Seam (right+bottom) separating same-piece cells. Color-with-alpha, not a
          plain black at a fixed opacity: on a near-black body the seam has to
          switch to the light side or there is nothing left to draw it with. */}
      <path
        d="M0.75 29.25 L29.25 29.25 L29.25 0.75"
        fill="none"
        stroke={tileVar('--tile-seam', finish)}
        strokeWidth={0.75}
      />
    </pattern>
  );
}

/**
 * Skeuomorphic finish for placed pieces, drawn as one SVG overlay above the
 * interactive cell grid (pointer-events: none, so clicks fall through). Each
 * piece is a single joined polyomino, but the finish reads as individually
 * molded translucent tiles: a per-cell alpha mask (recessed window more
 * transparent than the frame, so the board mat shows through), per-cell bevels /
 * window rim / glint / seams, one soft contact shadow, a warm macro lamp-pool,
 * an ambient-occlusion seam, a darker dye border, and a faint grain. Piece fills
 * come from the `--piece-*` tokens and the molding from `--tile-*`, so a theme
 * switch recolors the finish with no re-render.
 */
export function PlacedLayer({
  board,
  previewCells,
  lastMove,
  glowColors,
  settleId,
}: {
  board: (Color | null)[];
  /** Board indices currently under a placement preview (excluded from finish). */
  previewCells?: ReadonlySet<number>;
  /** Board indices of the most recent placement (drawn with a highlight ring). */
  lastMove?: number[];
  /** Colors whose pieces get a glowing halo (game-over winner reveal, P16). */
  glowColors?: Color[];
  /**
   * Identity of the placement the settle flash belongs to. Defaults to the cells
   * themselves, but callers that draw through a view rotation (P49) pass the
   * *board-space* identity: turning the view re-indexes where the flash would be
   * drawn, and without this the remount key changes and a long-settled piece
   * flashes again as though it had just been played.
   */
  settleId?: string;
}) {
  const reduce = useReducedMotion();
  // The board array carries its own side length; no Classic default to get wrong.
  const n = Math.round(Math.sqrt(board.length));
  const SIZE = n * C;
  const exclude = previewCells ?? EMPTY_SET;
  const regions = useMemo(() => buildRegions(board, exclude, n), [board, exclude, n]);
  const allFillsD = useMemo(() => regions.map((r) => r.fillD).join(''), [regions]);
  // Value classes actually on the board — Classic boards only ever hit `base`, so
  // the per-class defs cost nothing there.
  const finishes = useMemo(
    () => [...new Set(regions.map((r) => r.finish))].sort(),
    [regions],
  );
  const glowSet = glowColors && glowColors.length > 0 ? new Set(glowColors) : undefined;
  // Remount key so the settle flash replays exactly once per placement.
  const settleKey =
    lastMove && lastMove.length > 0 ? (settleId ?? lastMove.join(',')) : '';
  // The last move's own silhouette + fill (the fill is only ever a clip for the ring).
  const ring = useMemo(
    () => (lastMove && lastMove.length > 0 ? cellOutline(lastMove, n) : null),
    [lastMove, n],
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
        {/* Macro volume = the warm lamp pool (same geometry as --table-bg): a
            radial highlight top-of-center falling to a dark rim. Low amplitude —
            per-cell molding now carries the depth. Stops stay literal (P40 audit):
            a specular pool over the same-colored pieces in every theme, so it's
            mat-independent — unlike the strokes that sit on/through the mat. */}
        <radialGradient
          id="pl-vol"
          cx={SIZE * 0.5}
          cy={SIZE * 0.4}
          r={SIZE * 0.8}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.1" />
        </radialGradient>
        {/* Per-cell molding, grid-aligned (board cells sit at multiples of C).
            (a) Translucency mask: the window is more transparent than the frame,
            so the board mat shows through — glowing on a pale mat, deepening on a
            dark one, as real translucent plastic does. */}
        <pattern id="pl-alpha-pat" patternUnits="userSpaceOnUse" width={C} height={C}>
          <rect width={C} height={C} fill="#ffffff" fillOpacity={0.96} />
          <rect x={5.5} y={5.5} width={19} height={19} rx={1.5} fill="#ffffff" fillOpacity={0.74} />
        </pattern>
        <mask id="pl-tile-alpha">
          <rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#pl-alpha-pat)" />
        </mask>
        {/* (b) Detail paint, one copy per value class present (P20 M2c). CSS vars
            resolve inside inline SVG, so the theme tokens drive the finish. */}
        {finishes.map((f) => (
          <TileDetailPattern key={f} finish={f} />
        ))}
        {/* Contact shadow — cast onto the mat, so its opacity is the theme's
            (--tile-shadow): black vanishes on a dark table, and the pieces would
            stop reading as resting on the surface. Per class as well, since a
            white piece on a pale mat needs a deeper seat than a black one, which
            grounds itself. */}
        {finishes.map((f) => (
          <filter
            key={f}
            id={`pl-shadow-${finishKey(f)}`}
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
          >
            <feDropShadow
              dx="0"
              dy="0.8"
              stdDeviation="1"
              floodColor="#000000"
              style={{ floodOpacity: tileVar('--tile-shadow', f) }}
            />
          </filter>
        ))}
        {/* Union of each class's footprints — what its own detail pattern paints
            over (the volume and grain stay on the global `pl-all`, being
            class-independent). */}
        {finishes.map((f) => (
          <clipPath key={f} id={`pl-fin-${finishKey(f)}`}>
            <path d={regions.filter((r) => r.finish === f).map((r) => r.fillD).join('')} />
          </clipPath>
        ))}
        {/* Soft blur for the contact shadow, so it reads as cast onto the mat
            (a feathered falloff) rather than a crisp keyline hugging the edge. */}
        <filter id="pl-ao-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.1" />
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
        {/* Soft colored halo for glowing (winner) pieces in the reveal mosaic. */}
        <filter id="pl-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        {/* Clip for uniform layers (volume, grain) — union of all pieces. */}
        <clipPath id="pl-all">
          <path d={allFillsD} />
        </clipPath>
        {/* Inverse of pl-all: the bare mat only (every footprint masked out). The
            contact shadow is stroked on the silhouette and cut to this, so only its
            outer half — the part on the mat — survives. Masking to *all* footprints
            (not just one) also stops a piece's contact from darkening a neighbor that
            shares an edge. */}
        <mask id="pl-outside" maskUnits="userSpaceOnUse" x={0} y={0} width={SIZE} height={SIZE}>
          <rect x={0} y={0} width={SIZE} height={SIZE} fill="#ffffff" />
          <path d={allFillsD} fill="#000000" />
        </mask>
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
              <path key={i} d={r.fillD} fill={PIECE_VAR[r.color]} />
            ))}
        </g>
      )}

      {/* Contact shadow — the occlusion where a piece meets the mat, cast *outside*
          each footprint (P42). A proud piece throws its shadow onto the surface, so
          this sits on the mat and hugs the silhouette from without; the earlier
          inset seam read the wrong way (a dark rim *inside* the piece = a recessed
          well). Drawn below the fills so the piece rests on top of it. Depth is the
          theme's (--tile-ao) — a dark scene needs a deeper seat. */}
      <g mask="url(#pl-outside)">
        <g filter="url(#pl-ao-blur)">
          {regions.map((r, i) => (
            <path
              key={i}
              d={`${r.highlightD}${r.shadowD}`}
              fill="none"
              stroke="#000000"
              style={{ strokeOpacity: tileVar('--tile-ao', r.finish) }}
              strokeWidth={4}
            />
          ))}
        </g>
      </g>

      {/* Translucent fills: one contact shadow (outer <g>) wraps the alpha mask
          (inner <g>) — nesting order matters, or the mask waffle-textures the
          drop-shadow. The window's lower alpha lets the board mat show through. */}
      {finishes.map((f) => (
        <g key={f} filter={`url(#pl-shadow-${finishKey(f)})`}>
          <g mask="url(#pl-tile-alpha)">
            {regions.map((r, i) =>
              r.finish === f ? (
                <path key={i} d={r.fillD} fill={PIECE_VAR[r.color]} fillOpacity={0.95} />
              ) : null,
            )}
          </g>
        </g>
      ))}

      {/* Macro lamp-pool volume, confined to the pieces. */}
      <rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#pl-vol)" clipPath="url(#pl-all)" />

      {/* Per-cell molding detail (bevels, window rim, glint, seams), each class's
          pattern clipped to its own pieces. */}
      {finishes.map((f) => (
        <rect
          key={f}
          x={0}
          y={0}
          width={SIZE}
          height={SIZE}
          fill={`url(#pl-tile-detail-${finishKey(f)})`}
          clipPath={`url(#pl-fin-${finishKey(f)})`}
        />
      ))}

      {/* Thin darker dye border around each piece footprint (the photo's edge),
          clipped to 1.5px inside so it can't bleed onto a neighbor sharing an edge.
          The mix depth is the theme's (--tile-dye): the window shows the mat just
          inside this line, so a heavy mix crushes the edge into a dark mat. What
          it mixes *toward* is a token too (--tile-dye-mix), because on a
          near-black body mixing further toward black draws no border at all — the
          achromatic forks flip it to white (P20 M2c). */}
      {regions.map((r, i) => (
        <g key={i} clipPath={`url(#pl-r${i})`}>
          <path
            d={`${r.highlightD}${r.shadowD}`}
            fill="none"
            stroke={`color-mix(in srgb, ${PIECE_VAR[r.color]}, ${tileVar('--tile-dye-mix', r.finish)} ${tileVar('--tile-dye', r.finish)})`}
            strokeWidth={3}
          />
        </g>
      ))}

      {/* Faint grain over the pieces. Opacity stays literal (P40 audit): desaturated
          symmetric noise reads the same on any mat, like MatLayer's own grain. */}
      <rect
        x={0}
        y={0}
        width={SIZE}
        height={SIZE}
        filter="url(#pl-grain)"
        clipPath="url(#pl-all)"
        opacity={0.04}
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
            const x = idx % n;
            const y = (idx / n) | 0;
            return <rect key={idx} x={x * C} y={y * C} width={C} height={C} fill="#ffffff" />;
          })}
        </g>
      )}
    </svg>
  );
}
