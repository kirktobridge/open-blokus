import { useState } from 'react';
import { SECONDARY_BTN } from '../theme';
import { inviteUrl } from './config';

/**
 * Copies a match's shareable invite URL to the clipboard, flipping to a
 * confirmation for ~1.5s. If the clipboard API is unavailable/denied, reveals
 * the URL in a selectable field as a fallback.
 */
export function CopyInvite({
  matchID,
  compact = false,
}: {
  matchID: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  const url = inviteUrl(matchID);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFallback(url);
    }
  };

  if (fallback) {
    return (
      <input
        data-testid={`invite-url-${matchID}`}
        readOnly
        value={fallback}
        onFocus={(e) => e.currentTarget.select()}
        style={{ ...SECONDARY_BTN, cursor: 'text', minWidth: 220, fontSize: 12 }}
      />
    );
  }

  return (
    <button
      data-testid={`copy-invite-${matchID}`}
      onClick={copy}
      style={{ ...SECONDARY_BTN, padding: compact ? '6px 12px' : '9px 16px', fontSize: 13 }}
    >
      {copied ? 'Copied ✓' : compact ? 'Copy link' : 'Copy invite link'}
    </button>
  );
}
