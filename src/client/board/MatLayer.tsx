import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';

const C = CELL_PX;
const SIZE = BOARD_SIZE * C;

/** The four tile corners — quarter-studs that tile into one whole stud per grid
 *  intersection (pattern content is clipped to its tile, so drawing all four
 *  corners reconstructs the studs across the seams). */
const STUD_CORNERS: [number, number][] = [
  [0, 0],
  [C, 0],
  [0, C],
  [C, C],
];

/**
 * Skeuomorphic finish for the board itself (P5) — one static SVG beneath the
 * interactive cell grid, the counterpart to PlacedLayer's molded pieces.
 *
 * The real set's board is injection-molded plastic: a raised lattice with a
 * shallow square well per cell and a small alignment stud at every intersection.
 * That's the model here — the lattice is `--grid-line`, the wells are
 * `--empty-cell` (the same two tokens Cell used to paint, still the two the
 * Settings palette editor exposes), and `--mat-hi` / `--mat-lo` set how hard the
 * mold is lit. Resting cells above are transparent, so this *is* the empty board;
 * and since the placed-piece windows are translucent, the mold reads straight
 * through them — the "board-through-plastic" that finish was built for.
 *
 * Lit from the top-left, matching PlacedLayer: each ridge shows a lit near flank
 * and a shadowed far flank, and each well is dark under its top-left wall.
 */
export function MatLayer() {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      data-testid="mat-layer"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: -1 }}
      aria-hidden="true"
    >
      <defs>
        {/* Per-cell mold, grid-aligned (board cells sit at multiples of C). Each
            tile carries a full well plus the lattice bands around it, so the
            tiling yields continuous ridges with no seam bookkeeping. */}
        <pattern id="mat-mold" patternUnits="userSpaceOnUse" width={C} height={C}>
          {/* The lattice plane... */}
          <rect width={C} height={C} fill="var(--grid-line)" />
          {/* ...with the cell's well sunk into it. */}
          <rect x={1} y={1} width={C - 2} height={C - 2} rx={1.5} fill="var(--empty-cell)" />
          {/* Shadow: the ridge's far flank + the well's top-left wall. */}
          <path
            d={`M0 1 H${C} M1 0 V${C}`}
            fill="none"
            stroke="#000000"
            strokeWidth={2}
            style={{ opacity: 'var(--mat-lo)' }}
          />
          {/* Light: the ridge's near flank + the well's bottom-right return. */}
          <path
            d={`M0 ${C - 1} H${C} M${C - 1} 0 V${C}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ opacity: 'var(--mat-hi)' }}
          />
          {/* Alignment studs, proud of the lattice at each intersection. */}
          {STUD_CORNERS.map(([cx, cy]) => (
            <g key={`${cx},${cy}`}>
              <circle cx={cx} cy={cy} r={2.4} fill="var(--grid-line)" />
              {/* A stud is the same plastic as the lattice under it, so its only
                  contrast is this seating ring — hence the theme's own shadow
                  amplitude, not a constant. A fixed low alpha reads on the pale
                  themes but disappears on a near-black lattice. */}
              <circle
                cx={cx}
                cy={cy}
                r={2.4}
                fill="none"
                stroke="#000000"
                strokeWidth={0.9}
                style={{ strokeOpacity: 'var(--mat-lo)' }}
              />
              <circle
                cx={cx - 0.45}
                cy={cy - 0.45}
                r={1.2}
                fill="#ffffff"
                style={{ opacity: 'var(--mat-hi)' }}
              />
            </g>
          ))}
        </pattern>
        {/* Macro volume — same geometry and light as PlacedLayer's `pl-vol`, so
            the board and the pieces sitting on it share one lamp. */}
        <radialGradient
          id="mat-vol"
          cx={SIZE * 0.5}
          cy={SIZE * 0.4}
          r={SIZE * 0.8}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.14" />
        </radialGradient>
        {/* Desaturated grain — coarser than the pieces', since the board plastic
            is matte where the tiles are polished. */}
        <filter id="mat-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="3"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix in="noise" type="saturate" values="0" />
        </filter>
      </defs>

      <rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#mat-mold)" />
      <rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#mat-vol)" />
      <rect x={0} y={0} width={SIZE} height={SIZE} filter="url(#mat-grain)" opacity={0.05} />
    </svg>
  );
}
