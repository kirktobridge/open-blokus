import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FONT_MONO, ICON_BTN, ICON_CHIP } from './theme';
import { GearIcon } from './icons';
import {
  PIECE_GROUP,
  THEME_CYCLE,
  THEME_META,
  TOKEN_GROUPS,
  clearTokenOverride,
  deleteUserTheme,
  effectiveToken,
  renameUserTheme,
  setActiveTheme,
  setTokenOverride,
  useAppearance,
  useActiveTheme,
} from './appearance';
import {
  setCornerCounter,
  setInventoryDisplay,
  setMoveOptions,
  setSound,
  setVolume,
  usePrefs,
  type InventoryDisplay,
} from './settings';
import { PaletteControls } from './PalettePicker';
import { configureSound, play } from './sound/engine';

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Groups shown under "Design tokens" — the piece colors get their own section. */
const DESIGN_GROUPS = TOKEN_GROUPS.filter((g) => g.group !== PIECE_GROUP);

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

/**
 * A labeled on/off switch for a boolean preference — the plain-switch idiom the
 * Gameplay tab's advisor toggles use (P38). The whole row is the click target; the
 * hint sits under the label so the switch reads without a tooltip.
 */
function ToggleRow({
  testid,
  label,
  hint,
  checked,
  onChange,
}: {
  testid: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 9,
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        data-testid={testid}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, cursor: 'pointer' }}
      />
      <span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--fg)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
          {hint}
        </span>
      </span>
    </label>
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
 * One panel for every user-facing setting: the inventory preference, plus the
 * whole appearance model — pick a theme (a built-in, or one of your own), then
 * retune its piece colors and design tokens. Tuning a built-in forks it into a
 * named user theme (appearance.ts), so the built-ins are never dirtied and an
 * override can't leak across themes. Fixed bottom-left by default; `docked`
 * renders an in-flow top-bar chip.
 */
export function SettingsPanel({ docked = false }: { docked?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'appearance' | 'gameplay'>('appearance');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const prefs = usePrefs();
  const { userThemes, activeId } = useAppearance();
  const { theme, base } = useActiveTheme();
  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !s[g] }));
  const overrides = theme?.overrides ?? {};

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

          {/* Tabs (P38): appearance vs gameplay preferences. Advisor toggles that
              used to accrete as under-board buttons live under Gameplay now, so the
              board stays for play and the pattern scales as the advisor grows. */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <SegButton active={tab === 'appearance'} onClick={() => setTab('appearance')}>
              Appearance
            </SegButton>
            <SegButton active={tab === 'gameplay'} onClick={() => setTab('gameplay')}>
              Gameplay
            </SegButton>
          </div>

          {tab === 'gameplay' ? (
            <>
              <div style={sectionLabel}>Advisor Features</div>
              <ToggleRow
                testid="pref-move-options"
                label="Move Options"
                hint="Highlight every legal spot for the selected piece."
                checked={prefs.moveOptions}
                onChange={setMoveOptions}
              />
              <ToggleRow
                testid="pref-corner-counter"
                label="Corner Counter"
                hint="Show each color's open corners — the mid-game room the score hides."
                checked={prefs.cornerCounter}
                onChange={setCornerCounter}
              />
            </>
          ) : (
          <>
          {/* Inventory display */}
          <div style={sectionLabel}>Inventory</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['silhouette', 'dots'] as InventoryDisplay[]).map((mode) => (
              <SegButton
                key={mode}
                active={prefs.inventoryDisplay === mode}
                onClick={() => setInventoryDisplay(mode)}
              >
                {mode === 'silhouette' ? 'Pieces' : 'Dots'}
              </SegButton>
            ))}
          </div>

          {/* Sound (P7) — mute + volume. Every change previews itself: a setting you
              can't hear is a setting you can't set. The preview pushes the new values
              into the engine first, because `useGameSound`'s sync effect hasn't run
              yet (and on the home screen there's no game mounted to run it at all). */}
          <div style={sectionLabel}>Sound</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <input
                type="checkbox"
                data-testid="sound-toggle"
                checked={prefs.sound}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSound(on);
                  configureSound({ enabled: on, volume: prefs.volume });
                  if (on) play('place', 4);
                }}
              />
              {prefs.sound ? 'On' : 'Muted'}
            </label>
            <input
              type="range"
              data-testid="sound-volume"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              disabled={!prefs.sound}
              aria-label="Sound volume"
              onChange={(e) => {
                const volume = Number(e.target.value);
                setVolume(volume);
                configureSound({ enabled: prefs.sound, volume });
                play('place', 4);
              }}
              style={{ flex: 1, minWidth: 0, opacity: prefs.sound ? 1 : 0.4 }}
            />
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                color: 'var(--fg-muted)',
                width: 28,
                textAlign: 'right',
              }}
            >
              {Math.round(prefs.volume * 100)}
            </span>
          </div>

          {/* Theme — the built-ins, then the user's own (forks of a built-in). */}
          <div style={sectionLabel}>Theme</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {THEME_CYCLE.map((mode) => (
              <SegButton
                key={mode}
                active={activeId === mode}
                onClick={() => setActiveTheme(mode)}
              >
                {THEME_META[mode].name}
              </SegButton>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {userThemes.map((t) => {
              const selected = t.id === activeId;
              return (
                <div
                  key={t.id}
                  data-testid="user-theme"
                  data-selected={selected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 7px',
                    borderRadius: 8,
                    border: `1px solid ${selected ? 'var(--brass)' : 'var(--cell-outline)'}`,
                    background: selected ? 'var(--well)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    checked={selected}
                    aria-label={`Theme ${t.name}`}
                    onChange={() => setActiveTheme(t.id)}
                  />
                  <input
                    type="text"
                    value={t.name}
                    aria-label={`Rename ${t.name}`}
                    onChange={(e) => renameUserTheme(t.id, e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12.5,
                      padding: '2px 5px',
                      borderRadius: 5,
                      border: '1px solid var(--cell-outline)',
                      background: 'var(--surface)',
                      color: 'var(--fg)',
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                    ← {THEME_META[t.base].name}
                  </span>
                  <button
                    onClick={() => deleteUserTheme(t.id)}
                    title={`Delete ${t.name}`}
                    aria-label={`Delete ${t.name}`}
                    style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
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
            {/* Resetting = discarding the fork; the built-in it came from is
                pristine, so selecting it back *is* the reset. */}
            <button
              onClick={() => theme && deleteUserTheme(theme.id)}
              disabled={!theme}
              title={theme ? `Discard "${theme.name}" and go back to ${THEME_META[base].name}` : undefined}
              style={{
                fontSize: 11,
                cursor: theme ? 'pointer' : 'default',
                opacity: theme ? 1 : 0.4,
              }}
            >
              Reset all
            </button>
          </div>
          {DESIGN_GROUPS.map((g) => {
            const expanded = openGroups[g.group] ?? false;
            const changed = g.tokens.filter((t) => t.name in overrides).length;
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
                        overridden={t.name in overrides}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </>
          )}
        </div>
      )}
    </div>
  );
}
