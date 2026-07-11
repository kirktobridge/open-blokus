import { useMemo } from 'react';
import type { Color } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import type { RecapFrame } from '../../game/recap';
import { FONT_MONO } from '../theme';

/**
 * Score-over-time timeline (product P2 R0) — the "when did I fall behind?" read.
 * One line per color tracing cumulative squares placed against move number, with
 * a marker on the currently-scrubbed ply. Pure presentational SVG over the recap
 * frames; clicking (or dragging across) the plot seeks the scrubber.
 */
const W = 460;
const H = 132;
const PAD = { top: 12, right: 12, bottom: 20, left: 26 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function ScoreTimeline({
  frames,
  ply,
  colors,
  onSeek,
}: {
  frames: RecapFrame[];
  ply: number;
  colors: Record<Color, string>;
  /** Seek to a ply when the plot is clicked/dragged. */
  onSeek?: (ply: number) => void;
}) {
  const lastPly = frames.length - 1;
  const yMax = useMemo(
    () => Math.max(1, ...COLOR_ORDER.map((c) => frames[lastPly].placed[c])),
    [frames, lastPly],
  );

  const px = (p: number) => PAD.left + (lastPly === 0 ? 0 : (p / lastPly) * PLOT_W);
  const py = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  // Colors that actually took part (skip the unused 4th color in 2/3p games).
  const activeColors = COLOR_ORDER.filter((c) => frames[lastPly].placed[c] > 0);

  const paths = useMemo(
    () =>
      activeColors.map((c) => ({
        color: c,
        d: frames.map((f, i) => `${i === 0 ? 'M' : 'L'}${px(f.ply)},${py(f.placed[c])}`).join(' '),
      })),
    // px/py are pure fns of frames/lastPly/yMax; recompute with those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frames, lastPly, yMax],
  );

  const seek = (clientX: number, target: SVGSVGElement) => {
    if (!onSeek || lastPly === 0) return;
    const rect = target.getBoundingClientRect();
    const rel = ((clientX - rect.left) / rect.width) * W - PAD.left;
    const p = Math.round((rel / PLOT_W) * lastPly);
    onSeek(Math.max(0, Math.min(lastPly, p)));
  };

  return (
    <svg
      data-testid="score-timeline"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Squares placed by each color over the course of the game"
      style={{ display: 'block', cursor: onSeek ? 'ew-resize' : 'default', touchAction: 'none' }}
      onPointerDown={(e) => {
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        seek(e.clientX, e.currentTarget);
      }}
      onPointerMove={(e) => {
        if (e.buttons) seek(e.clientX, e.currentTarget);
      }}
    >
      {/* Plot frame + baseline. */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="var(--pnl-bd)" />
      <line
        x1={PAD.left}
        y1={PAD.top + PLOT_H}
        x2={PAD.left + PLOT_W}
        y2={PAD.top + PLOT_H}
        stroke="var(--pnl-bd)"
      />
      {/* Y ticks: 0 and max. */}
      <text x={PAD.left - 5} y={PAD.top + PLOT_H} textAnchor="end" dominantBaseline="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--mut)">
        0
      </text>
      <text x={PAD.left - 5} y={PAD.top} textAnchor="end" dominantBaseline="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--mut)">
        {yMax}
      </text>

      {/* Current-ply marker. */}
      <line
        data-testid="timeline-marker"
        x1={px(ply)}
        y1={PAD.top}
        x2={px(ply)}
        y2={PAD.top + PLOT_H}
        stroke="var(--ink)"
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />

      {/* One line per participating color. */}
      {paths.map((p) => (
        <path key={p.color} d={p.d} fill="none" stroke={colors[p.color]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* Dot on each line at the current ply. */}
      {activeColors.map((c) => (
        <circle key={c} cx={px(ply)} cy={py(frames[ply].placed[c])} r={2.6} fill={colors[c]} />
      ))}

      {/* X-axis caption. */}
      <text x={PAD.left + PLOT_W} y={H - 5} textAnchor="end" fontSize="9" fontFamily={FONT_MONO} fill="var(--mut)">
        move {ply} / {lastPly}
      </text>
    </svg>
  );
}
