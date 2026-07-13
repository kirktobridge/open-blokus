import { FONT_UI, PANEL } from '../theme';

export interface ActionRow {
  testid: string;
  label: string;
  /** Muted second line — what this destination actually is, or what it will start. */
  hint?: string;
  /** Short pill on the right (e.g. "New today"). */
  badge?: string;
  onClick: () => void;
}

/**
 * The front door's single vertical menu (P29): every destination in one place, one
 * click away. Each row is its own button-card — it lifts on its own hover — rather
 * than a band inside one panel, so the menu reads as a column of things you can
 * press. Rows stay deliberately **uniform** (same weight, no icons, no accent fill):
 * the board carries the page, the menu just points. Emphasis is a later pass.
 *
 * The rows share the column's height evenly (`flex: 1`), so the menu stands as tall
 * as the board beside it instead of huddling at the top of the page.
 */
export function ActionMenu({ rows }: { rows: ActionRow[] }) {
  return (
    <nav
      data-testid="action-menu"
      aria-label="Main menu"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}
    >
      {rows.map((row) => (
        <button
          key={row.testid}
          data-testid={row.testid}
          onClick={row.onClick}
          className="ob-menu-row"
          style={{
            ...PANEL,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flex: '1 1 0',
            minHeight: 78,
            width: '100%',
            textAlign: 'left',
            padding: '16px 22px',
            cursor: 'pointer',
            fontFamily: FONT_UI,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 19, fontWeight: 800 }}>{row.label}</span>
            {row.hint && (
              <span style={{ display: 'block', marginTop: 3, fontSize: 14, color: 'var(--mut)' }}>
                {row.hint}
              </span>
            )}
          </span>
          {row.badge && (
            <span
              data-testid={`${row.testid}-badge`}
              style={{
                flex: '0 0 auto',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                color: 'var(--mut)',
                background: 'var(--well)',
                border: '1px solid var(--pnl-bd)',
                borderRadius: 999,
                padding: '4px 10px',
              }}
            >
              {row.badge}
            </span>
          )}
          <span
            aria-hidden="true"
            className="ob-menu-arrow"
            style={{ flex: '0 0 auto', color: 'var(--mut)', fontSize: 18 }}
          >
            →
          </span>
        </button>
      ))}
    </nav>
  );
}
