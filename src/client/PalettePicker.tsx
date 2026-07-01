import { useState } from 'react';
import { COLOR_ORDER } from '../game/types';
import {
  createPalette,
  deletePalette,
  selectPalette,
  updatePalette,
  useActivePalette,
  usePalettes,
  type Palette,
} from './palettes';

/** Swatch strip showing a palette's four colors. */
function Swatches({ palette }: { palette: Palette }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {COLOR_ORDER.map((c) => (
        <span
          key={c}
          title={`${c}: ${palette.colors[c]}`}
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: palette.colors[c],
            border: '1px solid var(--cell-outline)',
          }}
        />
      ))}
    </span>
  );
}

/** Editable color inputs for a custom palette. */
function PaletteEditor({ palette }: { palette: Palette }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      {COLOR_ORDER.map((c) => (
        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <input
            type="color"
            value={palette.colors[c]}
            aria-label={`${palette.name} ${c}`}
            onChange={(e) =>
              updatePalette(palette.id, { colors: { ...palette.colors, [c]: e.target.value } })
            }
            style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'none' }}
          />
          <span style={{ textTransform: 'capitalize' }}>{c}</span>
        </label>
      ))}
    </div>
  );
}

function PaletteRow({ palette, selected }: { palette: Palette; selected: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${selected ? 'var(--outline-strong)' : 'var(--cell-outline)'}`,
        borderRadius: 6,
        padding: 8,
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="radio"
          name="palette"
          checked={selected}
          onChange={() => selectPalette(palette.id)}
        />
        <Swatches palette={palette} />
        {palette.immutable ? (
          <span style={{ fontSize: 13 }}>{palette.name}</span>
        ) : (
          <input
            type="text"
            value={palette.name}
            aria-label={`palette name ${palette.name}`}
            onChange={(e) => updatePalette(palette.id, { name: e.target.value })}
            style={{ fontSize: 13, flex: 1, minWidth: 0 }}
          />
        )}
      </label>

      {selected && !palette.immutable && <PaletteEditor palette={palette} />}

      {!palette.immutable && (
        <button
          onClick={() => deletePalette(palette.id)}
          style={{ marginTop: 6, fontSize: 12, cursor: 'pointer' }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

/** Fixed control to select and customize player color palettes. */
export function PalettePicker() {
  const [open, setOpen] = useState(false);
  const palettes = usePalettes();
  const active = useActivePalette();

  return (
    <div style={{ position: 'fixed', bottom: 8, left: 96, zIndex: 1000 }}>
      <button
        data-testid="palette-toggle"
        onClick={() => setOpen((o) => !o)}
        title="Player colors"
        aria-expanded={open}
        style={{ padding: '4px 10px', cursor: 'pointer' }}
      >
        🎨 Colors
      </button>

      {open && (
        <div
          style={{
            // Anchored bottom-left; the panel opens upward from the button.
            position: 'absolute',
            bottom: 34,
            left: 0,
            width: 220,
            maxHeight: '70vh',
            overflowY: 'auto',
            background: 'var(--surface)',
            color: 'var(--fg)',
            border: '1px solid var(--cell-outline)',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {palettes.map((p) => (
            <PaletteRow key={p.id} palette={p} selected={p.id === active.id} />
          ))}
          <button
            data-testid="palette-new"
            onClick={() => createPalette(`Custom ${palettes.length}`, active.colors)}
            style={{ padding: '4px 8px', cursor: 'pointer' }}
          >
            + New palette
          </button>
        </div>
      )}
    </div>
  );
}
