import { useState } from 'react';
import { describeKeys } from './controls/keymap';
import { ICON_BTN, ICON_CHIP } from './theme';
import { HelpIcon } from './icons';

/**
 * Read-only reference of the placement controls. Keyboard hints come from the
 * central keymap (src/client/controls/keymap.ts) so they can never drift; mouse
 * equivalents are listed alongside. Not editable (yet).
 */
const ROWS: { action: string; keys: string; mouse: string }[] = [
  { action: 'Select piece', keys: '—', mouse: 'Click a tray piece' },
  { action: 'Move cursor', keys: '↑ ↓ ← →', mouse: 'Hover the board' },
  {
    action: 'Rotate piece',
    keys: `${describeKeys('rotateCCW')} ↺   ${describeKeys('rotateCW')} ↻`,
    mouse: 'Scroll wheel',
  },
  { action: 'Flip piece', keys: describeKeys('flip'), mouse: 'Right-click' },
  { action: 'Lock (place)', keys: describeKeys('place'), mouse: 'Left-click a cell' },
  { action: 'Submit move', keys: describeKeys('submit'), mouse: 'Submit button' },
  { action: 'Cancel / clear', keys: describeKeys('cancel'), mouse: 'Clear button' },
  { action: 'Rotate board', keys: '—', mouse: 'Rotate-board button' },
];

export function ControlsHelp({ docked = false }: { docked?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={
        docked
          ? { position: 'relative', zIndex: 1000 }
          : { position: 'fixed', bottom: 8, left: 190, zIndex: 1000 }
      }
    >
      <button
        data-testid="controls-help-toggle"
        onClick={() => setOpen((o) => !o)}
        title="Keyboard & mouse controls"
        aria-label="Help"
        aria-expanded={open}
        style={docked ? ICON_CHIP : ICON_BTN}
      >
        <HelpIcon />
      </button>

      {open && (
        <div
          data-testid="controls-help"
          style={{
            position: 'absolute',
            ...(docked ? { top: 34, right: 0 } : { bottom: 34, left: 0 }),
            width: 280,
            background: 'var(--surface)',
            color: 'var(--fg)',
            border: '1px solid var(--cell-outline)',
            borderRadius: 8,
            padding: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 13,
          }}
        >
          <h3 style={{ margin: '0 0 8px' }}>Controls</h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-muted)' }}>
                <th style={{ paddingRight: 8, fontWeight: 600 }}>Action</th>
                <th style={{ paddingRight: 8, fontWeight: 600 }}>Keyboard</th>
                <th style={{ fontWeight: 600 }}>Mouse</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.action} style={{ borderTop: '1px solid var(--cell-outline)' }}>
                  <td style={{ paddingRight: 8, padding: '3px 8px 3px 0' }}>{r.action}</td>
                  <td style={{ paddingRight: 8, whiteSpace: 'nowrap' }}>{r.keys}</td>
                  <td>{r.mouse}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '8px 0 0', color: 'var(--fg-muted)', fontSize: 12 }}>
            Arrow keys are screen-relative and follow the board's rotation.
          </p>
        </div>
      )}
    </div>
  );
}
