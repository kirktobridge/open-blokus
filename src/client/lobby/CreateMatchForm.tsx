import { useState } from 'react';
import type { GameMode, ScoringVariant } from '../../game/types';

export function CreateMatchForm({
  onCreate,
}: {
  onCreate: (mode: GameMode, scoring: ScoringVariant) => void;
}) {
  const [mode, setMode] = useState<GameMode>(4);
  const [scoring, setScoring] = useState<ScoringVariant>('basic');

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
      <label>
        Players:{' '}
        <select
          data-testid="mode-select"
          value={mode}
          onChange={(e) => setMode(Number(e.target.value) as GameMode)}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      <label>
        Scoring:{' '}
        <select
          data-testid="scoring-select"
          value={scoring}
          onChange={(e) => setScoring(e.target.value as ScoringVariant)}
        >
          <option value="basic">basic</option>
          <option value="advanced">advanced</option>
        </select>
      </label>
      <button data-testid="create-match" onClick={() => onCreate(mode, scoring)}>
        Create match
      </button>
    </div>
  );
}
