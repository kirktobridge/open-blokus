import { useState } from 'react';
import type { GameMode, ScoringVariant } from '../../game/types';
import { FIELD, SECONDARY_BTN, FONT_UI } from '../theme';

const labelStyle = { display: 'flex', gap: 6, alignItems: 'center', fontFamily: FONT_UI, fontSize: 14 };

export function CreateMatchForm({
  onCreate,
}: {
  onCreate: (mode: GameMode, scoring: ScoringVariant) => void;
}) {
  const [mode, setMode] = useState<GameMode>(4);
  const [scoring, setScoring] = useState<ScoringVariant>('basic');

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={labelStyle}>
        Players:{' '}
        <select
          data-testid="mode-select"
          value={mode}
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
          value={scoring}
          onChange={(e) => setScoring(e.target.value as ScoringVariant)}
          style={FIELD}
        >
          <option value="basic">basic</option>
          <option value="advanced">advanced</option>
        </select>
      </label>
      <button data-testid="create-match" onClick={() => onCreate(mode, scoring)} style={SECONDARY_BTN}>
        Create match
      </button>
    </div>
  );
}
