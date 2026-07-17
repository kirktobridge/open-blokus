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

// Molded-tile finish (P35): every row is a raised, glossy tile — lit top, shaded
// base — the same finish language as the pieces (P5). All of it lands *inline* so it
// wins over PANEL's inline background/shadow; a CSS class can't override an inline
// style, which is why the finish silently vanished when it first lived in theme.css.
const GLINT = 'inset 0 1.5px 0 color-mix(in srgb, var(--tile-glint) 60%, transparent)';
const MOLDED_BG = 'linear-gradient(180deg, var(--card-hi), transparent 42%, var(--card-lo)), var(--pnl)';
const MOLDED_SHADOW = `var(--pnl-shadow), ${GLINT}, inset 0 -14px 20px -12px var(--card-lo)`;
// The primary row (Quick Play) wears a brass wash + brass left bar and lift over the
// same molded tile — warm, per-theme (--brass), and never a player color.
const PRIMARY_BG =
  'linear-gradient(180deg, var(--card-hi), transparent 42%, var(--card-lo)), color-mix(in srgb, var(--brass) 12%, var(--pnl))';
const PRIMARY_SHADOW = `var(--pnl-shadow), ${GLINT}, inset 0 -14px 20px -12px var(--card-lo), inset 3px 0 0 var(--brass), 0 10px 26px color-mix(in srgb, var(--brass) 32%, transparent)`;

/**
 * The front door's single vertical menu (P29 surface, P35 hierarchy pass). Each row
 * is its own button-card so the menu reads as a column of things you can press —
 * every row a molded, glossy tile. The hierarchy (P35): exactly **one** primary row
 * (Quick Play) additionally wears a brass wash + edge + lift, so it reads as "start
 * here" without a loud color fill. A `dim` row is a completed destination (e.g. the
 * tutorial once finished) — de-emphasized, never reordered, so the menu stays
 * learnable. No brand-color coding: the four logo colors mean seats/pieces, so a row
 * never wears one; the primary's accent is brass, the game's furniture color.
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
            // Molded tile on every row; the primary adds a brass wash, edge, and lift.
            background: row.primary ? PRIMARY_BG : MOLDED_BG,
            boxShadow: row.primary ? PRIMARY_SHADOW : MOLDED_SHADOW,
            ...(row.primary ? { border: '1.5px solid var(--brass)' } : {}),
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
            {/* Placeholder icon slot — a square sized to the text block (stretches to
                the label+hint height, never taller), reserved for the per-row glyph
                a later pass will drop in. Empty for now. */}
            <span
              data-testid={`${row.testid}-icon`}
              aria-hidden="true"
              style={{
                flex: '0 0 auto',
                // Square, matched to the label+hint block height (never taller).
                boxSizing: 'border-box',
                width: 40,
                height: 40,
                background: 'var(--well)',
                border: '1px solid var(--pnl-bd)',
                borderRadius: 10,
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 18,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                }}
              >
                {row.label}
              </span>
              {row.hint && (
                <span style={{ display: 'block', marginTop: 3, fontSize: 14, color: 'var(--mut)' }}>
                  {row.hint}
                </span>
              )}
            </span>
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
            style={{ flex: '0 0 auto', color: row.primary ? 'var(--brass)' : 'var(--mut)', fontSize: 24 }}
          >
            →
          </span>
        </button>
      ))}
    </nav>
  );
}
