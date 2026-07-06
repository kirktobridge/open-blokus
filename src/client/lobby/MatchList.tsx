import type { MatchInfo } from './config';
import { FONT_MONO, FONT_UI, PRIMARY_BTN, SECONDARY_BTN, WELL_ROW } from '../theme';
import { CopyInvite } from './CopyInvite';

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
    <div style={{ fontFamily: FONT_UI }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--ink)' }}>Open matches</h3>
        <button
          data-testid="refresh"
          onClick={onRefresh}
          style={{ ...SECONDARY_BTN, padding: '5px 12px', fontSize: 13 }}
        >
          ↻ Refresh
        </button>
      </div>
      {matches.length === 0 && (
        <p style={{ color: 'var(--mut)', margin: 0 }}>
          No open tables yet — create one and share the invite link.
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map((m) => {
          const seated = m.players.filter((p) => p.name).length;
          const total = m.players.length;
          const full = seated >= total;
          return (
            <li key={m.matchID} style={WELL_ROW}>
              <code style={{ fontFamily: FONT_MONO, fontSize: 13, color: 'var(--ink)' }}>
                {m.matchID.slice(0, 8)}
              </code>
              <span style={{ color: 'var(--mut)', fontSize: 13 }}>
                {m.setupData?.mode ?? total}p · {m.setupData?.scoring ?? 'basic'} · {seated}/{total} seated
              </span>
              <span style={{ flex: 1 }} />
              <CopyInvite matchID={m.matchID} compact />
              <button
                data-testid={`join-${m.matchID}`}
                disabled={full}
                onClick={() => onJoin(m.matchID)}
                style={{ ...PRIMARY_BTN, padding: '7px 14px', fontSize: 13, opacity: full ? 0.5 : 1 }}
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
