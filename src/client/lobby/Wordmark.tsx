import { COLOR_ORDER } from '../../game/types';
import { FONT_UI, PIECE_VAR } from '../theme';

/**
 * The wordmark: a 2×2 four-color piece glyph beside the name. The glyph draws the
 * four seat colors from the live palette, so it re-tints with the viewer's chosen
 * one instead of hard-coding a brand blue.
 */
export function Wordmark({ size = 26 }: { size?: number }) {
  const cell = Math.round(size * 0.42);
  const gap = Math.max(2, Math.round(size * 0.09));

  return (
    <span
      data-testid="wordmark"
      style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT_UI }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(2, ${cell}px)`,
          gap,
        }}
      >
        {COLOR_ORDER.map((c) => (
          <span
            key={c}
            style={{
              width: cell,
              height: cell,
              borderRadius: Math.max(2, Math.round(cell * 0.22)),
              background: PIECE_VAR[c],
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 1px 2px rgba(0,0,0,.25)',
            }}
          />
        ))}
      </span>
      <span style={{ fontWeight: 900, fontSize: size, color: 'var(--top-ink)' }}>OpenBlokus</span>
    </span>
  );
}
