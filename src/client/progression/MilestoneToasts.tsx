import { useEffect } from 'react';
import { FONT_UI } from '../theme';
import type { Milestone } from './progression';

/**
 * Transient milestone toasts (P15 M1) — shown after a game unlocks a new
 * achievement (first win vs a tier, first perfect clear). Auto-dismisses after a
 * few seconds; click to dismiss early. Purely presentational: the parent owns the
 * list (from useProgressionRecorder) and the dismiss.
 */

const TOAST_MS = 5200;

export function MilestoneToasts({
  items,
  onDismiss,
}: {
  items: Milestone[];
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (items.length === 0) return;
    const id = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(id);
  }, [items, onDismiss]);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      {items.map((m) => (
        <button
          key={m.id}
          data-testid="milestone-toast"
          onClick={onDismiss}
          className="ob-toast"
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: '90vw',
            border: '1px solid var(--brass)',
            background: 'var(--pnl)',
            color: 'var(--ink)',
            borderRadius: 999,
            padding: '10px 16px',
            fontFamily: FONT_UI,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 12px 28px rgba(15, 9, 3, 0.4)',
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>
            🏅
          </span>
          <span>
            <strong>{m.label}</strong>
            {m.detail && <span style={{ color: 'var(--mut)' }}> — {m.detail}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
