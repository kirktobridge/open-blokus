import { useState } from 'react';
import type { GameMode, ScoringVariant } from '../../game/types';
import type { MatchInfo } from './config';
import { CreateMatchForm } from './CreateMatchForm';
import { MatchList } from './MatchList';

export function HomeScreen({
  matches,
  onCreate,
  onJoin,
  onRefresh,
}: {
  matches: MatchInfo[];
  onCreate: (mode: GameMode, scoring: ScoringVariant) => void;
  onJoin: (matchID: string) => void;
  onRefresh: () => void;
}) {
  const [id, setId] = useState('');

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', maxWidth: 560 }}>
      <h1>OpenBlokus</h1>
      <CreateMatchForm onCreate={onCreate} />
      <div style={{ margin: '8px 0' }}>
        <input
          data-testid="join-id-input"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="match id"
        />
        <button data-testid="join-id-submit" onClick={() => id && onJoin(id)}>
          Join by ID
        </button>
      </div>
      <MatchList matches={matches} onJoin={onJoin} onRefresh={onRefresh} />
    </div>
  );
}
