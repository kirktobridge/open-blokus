import { COLOR_ORDER } from '../game/types';
import { PIECE_TOKEN } from './theme';
import {
  applyPiecePalette,
  clearTokenOverride,
  effectiveToken,
  setTokenOverride,
  useActiveTheme,
} from './appearance';
import { PIECE_PALETTES } from './palettes';

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * One-click preset piece palettes (P60). Applying one forks the active built-in
 * (or overlays the active user theme) with the six `--piece-*` colors — the same
 * fork the per-color editor below makes, just all at once from a curated set.
 * The swatch previews the four Classic colors; black/white come along for Duo.
 */
export function PalettePresets() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="palette-presets">
      {PIECE_PALETTES.map((p) => (
        <button
          key={p.id}
          onClick={() => applyPiecePalette(p.id)}
          data-testid={`palette-preset-${p.id}`}
          title={`Apply ${p.name} piece colors`}
          aria-label={`Apply ${p.name} palette`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 7px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'inline-flex', borderRadius: 2, overflow: 'hidden' }}>
            {COLOR_ORDER.map((c) => (
              <span key={c} style={{ width: 9, height: 14, background: p.colors[c] }} />
            ))}
          </span>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Piece-color editor for the active theme — the four `--piece-*` tokens. Editing
 * one while a built-in is selected forks it (appearance.ts), so "custom palettes"
 * are just user themes; the built-ins keep the classic scheme forever.
 */
export function PaletteControls() {
  const { theme } = useActiveTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {COLOR_ORDER.map((c) => {
        const token = PIECE_TOKEN[c];
        const value = effectiveToken(token);
        const overridden = theme != null && token in theme.overrides;
        return (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input
              type="color"
              // <input type="color"> only accepts #rrggbb; a token tuned to any
              // other CSS color still shows a sane swatch to drag from.
              value={HEX6.test(value) ? value : '#000000'}
              aria-label={`${c} piece color`}
              onChange={(e) => setTokenOverride(token, e.target.value)}
              style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            />
            <span style={{ textTransform: 'capitalize', flex: 1 }}>{c}</span>
            <button
              onClick={() => clearTokenOverride(token)}
              disabled={!overridden}
              title="Reset to theme default"
              aria-label={`Reset ${c} piece color`}
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
      })}
    </div>
  );
}
