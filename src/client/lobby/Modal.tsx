import { useEffect, type ReactNode } from 'react';
import { FONT_UI, GHOST_BTN } from '../theme';

/**
 * Overlay dialog for the front door's *glances* — Play with Friends, Your Stats
 * (P29). A destination that leads into a game takes the whole view (Custom Game is
 * a screen); a destination you only look at overlays the board you came from.
 * Closes on Escape and on a backdrop click; the panel itself swallows the click.
 */
export function Modal({
  title,
  testid,
  onClose,
  children,
}: {
  title: string;
  testid: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        data-testid={testid}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--pnl)',
          color: 'var(--ink)',
          border: '1px solid var(--pnl-bd)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(15,9,3,.5)',
          fontFamily: FONT_UI,
          width: 'min(520px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px 0',
          }}
        >
          <h2 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 900 }}>{title}</h2>
          <button
            data-testid={`${testid}-close`}
            onClick={onClose}
            aria-label="Close"
            style={{ ...GHOST_BTN, fontSize: 18, lineHeight: 1, padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '12px 20px 20px' }}>{children}</div>
      </div>
    </div>
  );
}
