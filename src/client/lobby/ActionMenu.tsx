import { FONT_UI, PANEL } from '../theme';

export interface ActionRow {
  testid: string;
  label: string;
  /** Muted second line — what this destination actually is, or what it will start. */
  hint?: string;
  /** Short pill on the right (e.g. "New today"). */
  badge?: string;
  /** Daily-puzzle streak (P35 (d)); rendered as a flame pill when > 0. */
  streak?: number;
  /** The page's single accented row (P35 (a)) — the one obvious click. */
  primary?: boolean;
  /** De-emphasize a completed destination (P35 (d)) — badging, not reordering. */
  dim?: boolean;
  onClick: () => void;
}

/**
 * The front door's single vertical menu (P29 surface, P35 hierarchy pass). Each row
 * is its own button-card so the menu reads as a column of things you can press. The
 * hierarchy (P35): exactly **one** primary row carries the page's single accent and
 * elevation (`--primary` class); every other row stays uniform and neutral, so the
 * accent means "start here" and nothing competes with it. A `dim` row is a completed
 * destination (e.g. the tutorial once finished) — de-emphasized, never reordered, so
 * the menu stays learnable. No brand-color coding: the four logo colors mean
 * seats/pieces, so a row never wears one.
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
          className={`ob-menu-row${row.primary ? ' ob-menu-row--primary' : ''}`}
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
            opacity: row.dim ? 0.62 : 1,
            // The accent lands *inline* so it wins over PANEL's inline border/shadow
            // — a CSS class can't override an inline style, which is why the accent
            // silently vanished the first time it lived only in theme.css (P35).
            ...(row.primary
              ? {
                  border: '1.5px solid var(--accent)',
                  boxShadow:
                    'var(--pnl-shadow), var(--pnl-inset), inset 3px 0 0 var(--accent), 0 8px 24px var(--accent-glow)',
                }
              : {}),
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
          {row.streak != null && row.streak > 0 && (
            <span
              data-testid={`${row.testid}-streak`}
              title={`${row.streak}-day streak`}
              style={{
                flex: '0 0 auto',
                fontSize: 12,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--ink)',
                background: 'var(--well)',
                border: '1px solid var(--pnl-bd)',
                borderRadius: 999,
                padding: '4px 9px',
              }}
            >
              🔥 {row.streak}
            </span>
          )}
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
            style={{ flex: '0 0 auto', color: row.primary ? 'var(--accent)' : 'var(--mut)', fontSize: 18 }}
          >
            →
          </span>
        </button>
      ))}
    </nav>
  );
}
