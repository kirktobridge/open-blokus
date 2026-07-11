import { REACTIONS } from '../lobby/reactions';
import { FONT_UI } from '../theme';

/**
 * The canned-reaction button row (P19), shown only in online matches. Each button
 * fires one reaction over the chat transport; peers surface it as a toast on the
 * sender's player card. Purely a sender — display lives in PlayerCard.
 */
export function ReactionBar({ onReact }: { onReact: (id: string) => void }) {
  return (
    <div
      data-testid="reaction-bar"
      role="group"
      aria-label="Send a reaction"
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {REACTIONS.map((r) => (
        <button
          key={r.id}
          data-testid={`react-${r.id}`}
          onClick={() => onReact(r.id)}
          title={r.label}
          aria-label={r.label}
          style={{
            fontFamily: FONT_UI,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--ink)',
            border: '1px solid var(--top-bd)',
            background: 'var(--top-bg)',
            borderRadius: 999,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
