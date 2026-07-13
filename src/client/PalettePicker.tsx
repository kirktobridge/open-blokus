import { COLOR_ORDER } from '../game/types';
import { PIECE_TOKEN } from './theme';
import { clearTokenOverride, effectiveToken, setTokenOverride, useActiveTheme } from './appearance';

const HEX6 = /^#[0-9a-fA-F]{6}$/;

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
