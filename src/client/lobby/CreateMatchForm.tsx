import { useState } from 'react';
import type { GameMode, ScoringVariant, Variant } from '../../game/types';
import { VARIANTS } from '../../game/modes';
import { FIELD, SECONDARY_BTN, FONT_UI } from '../theme';

const labelStyle = { display: 'flex', gap: 6, alignItems: 'center', fontFamily: FONT_UI, fontSize: 14 };

export function CreateMatchForm({
  onCreate,
}: {
  onCreate: (mode: GameMode, scoring: ScoringVariant, variant: Variant) => void;
}) {
  const [mode, setMode] = useState<GameMode>(4);
  const [scoring, setScoring] = useState<ScoringVariant>('basic');
  const [variant, setVariant] = useState<Variant>('classic');
  // Duo fixes both the seat count and the scoring system, so those two controls
  // have nothing left to offer once it's chosen.
  const duo = variant === 'duo';

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={labelStyle}>
        Game:{' '}
        <select
          data-testid="variant-select-online"
          value={variant}
          onChange={(e) => {
            const v = e.target.value as Variant;
            setVariant(v);
            const modes = VARIANTS[v].modes;
            if (!modes.includes(mode)) setMode(modes[0]);
          }}
          style={FIELD}
        >
          <option value="classic">Classic</option>
          <option value="duo">Duo</option>
        </select>
      </label>
      <label style={labelStyle}>
        Players:{' '}
        <select
          data-testid="mode-select"
          value={mode}
          disabled={duo}
          onChange={(e) => setMode(Number(e.target.value) as GameMode)}
          style={FIELD}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      <label style={labelStyle}>
        Scoring:{' '}
        <select
          data-testid="scoring-select"
          value={duo ? 'advanced' : scoring}
          disabled={duo}
          onChange={(e) => setScoring(e.target.value as ScoringVariant)}
          style={FIELD}
        >
          <option value="basic">basic</option>
          <option value="advanced">advanced</option>
        </select>
      </label>
      <button
        data-testid="create-match"
        onClick={() => onCreate(mode, scoring, variant)}
        style={SECONDARY_BTN}
      >
        Create match
      </button>
    </div>
  );
}
