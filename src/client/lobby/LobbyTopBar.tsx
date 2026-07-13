import { ControlsHelp } from '../ControlsHelp';
import { SettingsPanel } from '../SettingsPanel';
import { FONT_MONO } from '../theme';
import { Wordmark } from './Wordmark';

/**
 * The bar every out-of-game screen wears — wordmark · where-you-are chip · spacer ·
 * utility chips. Shared by the front door and the Custom Game screen so leaving the
 * board never changes the furniture, only the chip.
 */
export function LobbyTopBar({ chip }: { chip: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 26px' }}>
      <Wordmark size={25} />
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
        {chip}
      </span>
      <span style={{ flex: 1 }} />
      <SettingsPanel docked />
      <ControlsHelp docked />
    </div>
  );
}
