import type { ReactNode } from 'react';
import { SettingsPanel } from './SettingsPanel';
import { ControlsHelp } from './ControlsHelp';
import { ICON_CHIP, FONT_MONO, FONT_UI } from './theme';
import { LeaveIcon } from './icons';

type TableShellProps = {
  /** The pill next to the wordmark — what kind of table this is ("Local game", "Review"). */
  label: string;
  /** Anything the table wants between the pill and the utility chips (counts, clocks, indicators). */
  status?: ReactNode;
  onLeave: () => void;
  leaveLabel?: string;
  leaveTestId?: string;
  /**
   * Fixed-height flex column instead of natural page flow: the TopBar is a fixed row and
   * the child takes the rest, so a review transport can pin to the viewport bottom (P52).
   */
  fill?: boolean;
  children: ReactNode;
};

/**
 * The chrome every full-viewport table wears: wordmark, a kind-of-table pill, and the
 * utility chips (Settings, Controls help, Leave). Shared (P53) so the two ways into
 * review — inside a vs-AI table, or standalone from Your stats → Recent games — can't
 * drift into different amounts of chrome again.
 */
export function TableShell({
  label,
  status,
  onLeave,
  leaveLabel = 'Leave table',
  leaveTestId = 'leave-table',
  fill = false,
  children,
}: TableShellProps) {
  return (
    <div
      style={{
        background: 'var(--table-bg)',
        ...(fill
          ? { height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
          : { minHeight: '100vh' }),
      }}
    >
      {/* TopBar — wordmark · table chip · status · utility chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 26px',
          fontFamily: FONT_UI,
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: FONT_UI, fontWeight: 900, fontSize: 25, color: 'var(--top-ink)' }}>
          OpenBlokus
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '.09em',
            color: 'var(--top-mut)',
            border: '1px solid var(--top-bd)',
            borderRadius: 999,
            padding: '5px 12px',
          }}
        >
          {label}
        </span>
        {status}

        <span style={{ flex: 1 }} />

        <SettingsPanel docked />
        <ControlsHelp docked />
        <button
          data-testid={leaveTestId}
          onClick={onLeave}
          aria-label={leaveLabel}
          title={leaveLabel}
          style={{ ...ICON_CHIP, opacity: 0.85 }}
        >
          <LeaveIcon />
        </button>
      </div>
      {children}
    </div>
  );
}
