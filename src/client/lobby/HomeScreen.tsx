import { useEffect, useMemo, useState } from 'react';
import type { Color, GameMode, ScoringVariant } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { ownersFor } from '../../game/modes';
import type { MatchInfo } from './config';
import { DIFFICULTIES, type Difficulty } from '../ai/difficulty';
import { CreateMatchForm } from './CreateMatchForm';
import { MatchList } from './MatchList';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Bot seats (last `aiCount` playerIDs) and the label for each — the color(s) that
 * seat owns per `ownersFor(mode)`. A seat may own two colors (2p). The 3p 'shared'
 * color belongs to no fixed seat, so it doesn't add a label. If a seat owns a
 * shared color's turns too (3p), we note it. Returned in seat order.
 */
function botSeatLabels(mode: GameMode, aiCount: number): { seat: string; label: string }[] {
  const humanCount = Math.max(0, mode - aiCount);
  const owners = ownersFor(mode);
  const colorsForSeat = (seat: string): Color[] =>
    COLOR_ORDER.filter((c) => owners[c] === seat);
  // In 3p the 'shared' color rotates among all seats — flag it once on the setup.
  const hasShared = COLOR_ORDER.some((c) => owners[c] === 'shared');

  return Array.from({ length: mode }, (_, i) => String(i))
    .filter((s) => Number(s) >= humanCount)
    .map((seat) => {
      const colors = colorsForSeat(seat);
      let label = colors.map(cap).join(', ') || `Seat ${seat}`;
      if (hasShared) label += ' + shared';
      return { seat, label };
    });
}

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
  onStartAI: (
    mode: GameMode,
    aiCount: number,
    botDifficulties: Record<string, Difficulty>,
  ) => void;
}) {
  const [id, setId] = useState('');
  const [aiMode, setAiMode] = useState<GameMode>(4);
  const [aiCount, setAiCount] = useState(3);
  const [botDifficulties, setBotDifficulties] = useState<Record<string, Difficulty>>({});

  const botSeats = useMemo(() => botSeatLabels(aiMode, aiCount), [aiMode, aiCount]);

  // Keep the map in sync with the current bot seats: every current seat gets an
  // entry (default 'easy'), stale seats are dropped. Runs when players/count change.
  useEffect(() => {
    setBotDifficulties((prev) => {
      const next: Record<string, Difficulty> = {};
      for (const { seat } of botSeats) next[seat] = prev[seat] ?? 'easy';
      return next;
    });
  }, [botSeats]);

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
        </div>

        {botSeats.length > 0 && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' }}
          >
            {botSeats.map(({ seat, label }) => (
              <label
                key={seat}
                style={{ display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <span style={{ minWidth: 140 }}>{label}:</span>
                <select
                  data-testid={`ai-difficulty-${seat}`}
                  value={botDifficulties[seat] ?? 'easy'}
                  onChange={(e) =>
                    setBotDifficulties((prev) => ({
                      ...prev,
                      [seat]: e.target.value as Difficulty,
                    }))
                  }
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        <button
          data-testid="start-ai"
          onClick={() => onStartAI(aiMode, aiCount, botDifficulties)}
        >
          Start
        </button>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '4px 0 0' }}>
          {aiMode - aiCount} human / {aiCount} AI{aiCount === aiMode ? ' (watch)' : ''}
          {botSeats.length > 0 &&
            ` · ${botSeats.map(({ seat }) => botDifficulties[seat] ?? 'easy').join(', ')}`}
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
