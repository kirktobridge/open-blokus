import { FONT_MONO } from '../theme';
import { loadNick } from './config';
import { useProgression } from '../progression/progression';

/**
 * Top-bar profile affordance (P35 (b)). Your Stats moved out of the menu column — a
 * noun among verbs diluted the "ways to play" reading — into the persistent bar as an
 * avatar with one glanceable number (the live win streak). Clicking opens the same
 * ProgressionPanel modal the row used to. The avatar shows the player's nickname
 * initial when they've chosen one, else a neutral silhouette; the streak pill appears
 * only once there's a streak to show, so a fresh profile is just the avatar.
 */
export function ProfileChip({ onOpen }: { onOpen: () => void }) {
  const p = useProgression();
  const nick = loadNick();
  const initial = nick ? nick[0]!.toUpperCase() : '';
  const streak = p.currentStreak;

  return (
    <button
      data-testid="profile-chip"
      onClick={onOpen}
      aria-label="Your stats"
      title="Your stats"
      className="ob-profile-chip"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid var(--top-bd)',
        background: 'var(--top-bg)',
        borderRadius: 999,
        padding: streak > 0 ? '4px 12px 4px 5px' : '5px',
        cursor: 'pointer',
        color: 'var(--top-ink)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--brass)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        {initial || '👤'}
      </span>
      {streak > 0 && (
        <span
          data-testid="profile-streak"
          title={`${streak}-win streak`}
          style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, letterSpacing: '.02em' }}
        >
          🔥 {streak}
        </span>
      )}
    </button>
  );
}
