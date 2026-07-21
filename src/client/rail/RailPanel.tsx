import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FONT_UI, RAIL_MAX_W, RAIL_MIN_W } from '../theme';

/** The rail's default panel shell shadow (the play table's floating card). */
const PANEL_SHADOW = '0 14px 28px rgba(15,9,3,.32)';

/**
 * The right rail's column (P48). Elastic: it grows into whatever horizontal room
 * is left after the fixed board column, up to `RAIL_MAX_W`, and collapses back to
 * `RAIL_MIN_W` when there isn't any — so the same markup serves a 1280 laptop and
 * a wide desktop. Shared by the play table and the review table so the rail reads
 * identically in both.
 */
export function RailColumn({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="rail-column"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        flex: `1 1 ${RAIL_MIN_W}px`,
        minWidth: RAIL_MIN_W,
        maxWidth: RAIL_MAX_W,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A collapsible rail panel (P48). The header is the toggle: clicking it folds the
 * body away so a viewer can reclaim vertical space and keep the primary controls —
 * the action dock in play, the transport bar in review — above the fold without
 * scrolling. Open by default, so nothing moves until someone asks it to.
 *
 * Purely presentational: it owns its own open/closed state and never touches
 * prefs, so collapsing is a per-session glance, not a setting to manage.
 */
export function RailPanel({
  id,
  title,
  meta,
  children,
  defaultOpen = true,
  shadow = PANEL_SHADOW,
  padding = '14px 16px',
  gap = 12,
  testid,
}: {
  /** Stable slug for the toggle/body test ids and the aria wiring. */
  id: string;
  /** Header content — a plain label, or a richer node (the hand tray's color chip). */
  title: ReactNode;
  /** Optional right-aligned header detail, kept beside the chevron. */
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Override the shell shadow (the hand tray uses its molded tray rim). */
  shadow?: string;
  padding?: CSSProperties['padding'];
  gap?: number;
  /** Extra test id on the shell, for panels e2e already addresses by name. */
  testid?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `rail-body-${id}`;

  return (
    <div
      data-testid={testid}
      style={{
        width: '100%',
        background: 'var(--pnl)',
        border: '1px solid var(--pnl-bd)',
        borderRadius: 14,
        padding,
        fontFamily: FONT_UI,
        color: 'var(--ink)',
        boxShadow: shadow,
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        data-testid={`rail-toggle-${id}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          width: '100%',
          // Header sits flush with the panel padding; only the body below it is
          // separated, and only while it's showing.
          margin: 0,
          padding: 0,
          background: 'none',
          border: 'none',
          font: 'inherit',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {title}
        <span style={{ flex: 1 }} />
        {meta}
        <span
          aria-hidden
          style={{
            fontSize: 10,
            color: 'var(--mut)',
            // Chevron points down when open, right when folded.
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        >
          ▶
        </span>
      </button>

      {open && (
        <div
          id={bodyId}
          data-testid={bodyId}
          style={{ display: 'flex', flexDirection: 'column', gap, marginTop: 12 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
