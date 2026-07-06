import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FONT_MONO, ICON_BTN, ICON_CHIP } from './theme';
import { GearIcon } from './icons';
import { THEME_CYCLE, THEME_META, setTheme, useThemeMode } from './ThemeToggle';
import {
  TOKEN_GROUPS,
  clearTokenOverride,
  effectiveToken,
  resetAllTokens,
  setInventoryDisplay,
  setTokenOverride,
  useSettings,
  type InventoryDisplay,
} from './settings';
import { PaletteControls } from './PalettePicker';

const HEX6 = /^#[0-9a-fA-F]{6}$/;

const sectionLabel: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: '.15em',
  textTransform: 'uppercase',
  color: 'var(--fg-muted)',
  margin: '4px 0 8px',
};

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px 10px',
        fontSize: 12.5,
        cursor: 'pointer',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--brass)' : 'var(--cell-outline)'}`,
        background: active ? 'var(--well)' : 'transparent',
        color: 'var(--fg)',
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

/** One tunable token: swatch (if a hex color) + text field + reset. */
function TokenRow({ name, label, overridden }: { name: string; label: string; overridden: boolean }) {
  const value = effectiveToken(name);
  const isHex = HEX6.test(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
      <span style={{ flex: '0 0 108px', fontSize: 11.5, color: 'var(--fg)' }}>{label}</span>
      {isHex && (
        <input
          type="color"
          value={value}
          aria-label={`${label} color`}
          onChange={(e) => setTokenOverride(name, e.target.value)}
          style={{ width: 26, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
        />
      )}
      <input
        type="text"
        value={value}
        aria-label={label}
        spellCheck={false}
        onChange={(e) => setTokenOverride(name, e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          padding: '3px 6px',
          borderRadius: 5,
          border: '1px solid var(--cell-outline)',
          background: 'var(--surface)',
          color: 'var(--fg)',
        }}
      />
      <button
        onClick={() => clearTokenOverride(name)}
        disabled={!overridden}
        title="Reset to theme default"
        aria-label={`Reset ${label}`}
        style={{
          fontSize: 11,
          padding: '2px 6px',
          cursor: overridden ? 'pointer' : 'default',
          opacity: overridden ? 1 : 0.3,
        }}
      >
        ↺
      </button>
    </div>
  );
}

/**
 * One panel for every user-facing setting: inventory display, theme, piece
 * colors, and live overrides for every font/color design token. Fixed
 * bottom-left by default; `docked` renders an in-flow top-bar chip.
 */
export function SettingsPanel({ docked = false }: { docked?: boolean }) {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const settings = useSettings();
  const theme = useThemeMode();
  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !s[g] }));

  return (
    <div
      style={
        docked
          ? { position: 'relative', zIndex: 1000 }
          : { position: 'fixed', bottom: 8, left: 8, zIndex: 1000 }
      }
    >
      <button
        data-testid="settings-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        style={docked ? ICON_CHIP : ICON_BTN}
      >
        <GearIcon />
      </button>

      {open && (
        <div
          data-testid="settings-panel"
          style={{
            position: 'absolute',
            ...(docked ? { top: 34, right: 0 } : { bottom: 34, left: 0 }),
            width: 320,
            maxHeight: '80vh',
            overflowY: 'auto',
            background: 'var(--surface)',
            color: 'var(--fg)',
            border: '1px solid var(--cell-outline)',
            borderRadius: 10,
            padding: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Settings</h3>

          {/* Inventory display */}
          <div style={sectionLabel}>Inventory</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['silhouette', 'dots'] as InventoryDisplay[]).map((mode) => (
              <SegButton
                key={mode}
                active={settings.inventoryDisplay === mode}
                onClick={() => setInventoryDisplay(mode)}
              >
                {mode === 'silhouette' ? 'Pieces' : 'Dots'}
              </SegButton>
            ))}
          </div>

          {/* Theme */}
          <div style={sectionLabel}>Theme</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {THEME_CYCLE.map((mode) => (
              <SegButton key={mode} active={theme === mode} onClick={() => setTheme(mode)}>
                {THEME_META[mode].name}
              </SegButton>
            ))}
          </div>

          {/* Piece colors */}
          <div style={sectionLabel}>Piece colors</div>
          <div style={{ marginBottom: 14 }}>
            <PaletteControls />
          </div>

          {/* Design tokens */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <div style={{ ...sectionLabel, margin: '4px 0' }}>Design tokens</div>
            <button
              onClick={resetAllTokens}
              disabled={Object.keys(settings.tokens).length === 0}
              style={{
                fontSize: 11,
                cursor: Object.keys(settings.tokens).length ? 'pointer' : 'default',
                opacity: Object.keys(settings.tokens).length ? 1 : 0.4,
              }}
            >
              Reset all
            </button>
          </div>
          {TOKEN_GROUPS.map((g) => {
            const expanded = openGroups[g.group] ?? false;
            const changed = g.tokens.filter((t) => t.name in settings.tokens).length;
            return (
              <div key={g.group} style={{ marginBottom: 6 }}>
                <button
                  onClick={() => toggleGroup(g.group)}
                  aria-expanded={expanded}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '5px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: 'left',
                    color: 'var(--fg-muted)',
                    background: 'transparent',
                    border: 'none',
                    borderTop: '1px solid var(--cell-outline)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 10, display: 'inline-block' }}>{expanded ? '▾' : '▸'}</span>
                  {g.group}
                  {changed > 0 && (
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 9,
                        color: 'var(--brass)',
                        border: '1px solid var(--brass)',
                        borderRadius: 999,
                        padding: '0 5px',
                      }}
                    >
                      {changed}
                    </span>
                  )}
                </button>
                {expanded && (
                  <div style={{ padding: '6px 2px 4px' }}>
                    {g.tokens.map((t) => (
                      <TokenRow
                        key={t.name}
                        name={t.name}
                        label={t.label}
                        overridden={t.name in settings.tokens}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
