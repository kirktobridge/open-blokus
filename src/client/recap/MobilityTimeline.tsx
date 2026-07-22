import { useMemo } from 'react';
import type { Color } from '../../game/types';
import type { RecapFrame } from '../../game/recap';
import { FONT_MONO, PIECE_VAR } from '../theme';

/**
 * Mobility-over-time timeline (product P34 M1) — the "when did my room collapse?"
 * read that score alone can't show (score tracks closely until late; mobility is
 * what actually diverges mid-game). One line per color tracing open corner
 * attach-points against move number, with a marker on the currently-scrubbed ply.
 * Sibling to {@link ScoreTimeline}: same pure-SVG-over-recap-frames shape and seek
 * interaction, but the y-scale spans the whole game — mobility peaks mid-game and
 * falls, so a last-frame max would flatten the interesting part.
 */
const W = 460;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 20, left: 26 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function MobilityTimeline({
  frames,
  ply,
  onSeek,
}: {
  frames: RecapFrame[];
  ply: number;
  /** Seek to a ply when the plot is clicked/dragged. */
  onSeek?: (ply: number) => void;
}) {
  const lastPly = frames.length - 1;

  // Colors that actually took part (skip the unused 4th color in 2/3p games).
  // The frame's own key set *is* the variant's color list — no COLOR_ORDER walk,
  // which would plot four empty Classic lines for a Duo game.
  const activeColors = useMemo(
    () =>
      (Object.keys(frames[lastPly].placed) as Color[]).filter(
        (c) => (frames[lastPly].placed[c] ?? 0) > 0,
      ),
    [frames, lastPly],
  );

  // Peak mobility across the *whole* game, not just the final frame.
  const yMax = useMemo(
    () => Math.max(1, ...frames.flatMap((f) => activeColors.map((c) => f.mobility[c] ?? 0))),
    [frames, activeColors],
  );

  const px = (p: number) => PAD.left + (lastPly === 0 ? 0 : (p / lastPly) * PLOT_W);
  const py = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  const paths = useMemo(
    () =>
      activeColors.map((c) => ({
        color: c,
        d: frames.map((f, i) => `${i === 0 ? 'M' : 'L'}${px(f.ply)},${py(f.mobility[c] ?? 0)}`).join(' '),
      })),
    // px/py are pure fns of frames/lastPly/yMax; recompute with those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frames, lastPly, yMax, activeColors],
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
      data-testid="mobility-timeline"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Open corners (room to play) for each color over the course of the game"
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
      {/* Y ticks: 0 and peak. */}
      <text x={PAD.left - 5} y={PAD.top + PLOT_H} textAnchor="end" dominantBaseline="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--mut)">
        0
      </text>
      <text x={PAD.left - 5} y={PAD.top} textAnchor="end" dominantBaseline="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--mut)">
        {yMax}
      </text>

      {/* Current-ply marker. */}
      <line
        data-testid="mobility-marker"
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
        <path key={p.color} d={p.d} fill="none" stroke={PIECE_VAR[p.color]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* Dot on each line at the current ply. */}
      {activeColors.map((c) => (
        <circle key={c} cx={px(ply)} cy={py(frames[ply].mobility[c] ?? 0)} r={2.6} fill={PIECE_VAR[c]} />
      ))}

      {/* Axis caption — names the metric so it's not confused with the score plot. */}
      <text x={PAD.left + PLOT_W} y={H - 5} textAnchor="end" fontSize="9" fontFamily={FONT_MONO} fill="var(--mut)">
        open corners · move {ply} / {lastPly}
      </text>
    </svg>
  );
}
