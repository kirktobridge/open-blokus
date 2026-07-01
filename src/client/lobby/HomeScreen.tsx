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
  onStartAI,
}: {
  matches: MatchInfo[];
  onCreate: (mode: GameMode, scoring: ScoringVariant) => void;
  onJoin: (matchID: string) => void;
  onRefresh: () => void;
  onStartAI: (mode: GameMode, aiCount: number) => void;
}) {
  const [id, setId] = useState('');
  const [aiMode, setAiMode] = useState<GameMode>(4);
  const [aiCount, setAiCount] = useState(3);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', maxWidth: 560 }}>
      <h1>OpenBlokus</h1>

      <section style={{ marginBottom: 16 }}>
        <h3>Play vs AI (offline)</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>
            Players:{' '}
            <select
              data-testid="ai-mode-select"
              value={aiMode}
              onChange={(e) => {
                const m = Number(e.target.value) as GameMode;
                setAiMode(m);
                setAiCount((c) => Math.min(c, m));
              }}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          <label>
            AI opponents:{' '}
            <select
              data-testid="ai-count-select"
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
            >
              {Array.from({ length: aiMode + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button data-testid="start-ai" onClick={() => onStartAI(aiMode, aiCount)}>
            Start
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '4px 0 0' }}>
          {aiMode - aiCount} human / {aiCount} AI{aiCount === aiMode ? ' (watch)' : ''}
        </p>
      </section>

      <h3>Online multiplayer</h3>
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
