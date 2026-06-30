import type { MatchInfo } from './config';

export function MatchList({
  matches,
  onJoin,
  onRefresh,
}: {
  matches: MatchInfo[];
  onJoin: (matchID: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div>
      <h3>
        Open matches{' '}
        <button data-testid="refresh" onClick={onRefresh}>
          ↻ refresh
        </button>
      </h3>
      {matches.length === 0 && <p>No matches yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {matches.map((m) => {
          const seated = m.players.filter((p) => p.name).length;
          const total = m.players.length;
          return (
            <li key={m.matchID} style={{ marginBottom: 6 }}>
              <code>{m.matchID}</code> · {m.setupData?.mode ?? total}p{' '}
              {m.setupData?.scoring ?? 'basic'} · {seated}/{total} seated{' '}
              <button
                data-testid={`join-${m.matchID}`}
                disabled={seated >= total}
                onClick={() => onJoin(m.matchID)}
              >
                Join
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
