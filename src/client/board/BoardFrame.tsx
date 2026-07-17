import type { CSSProperties, ReactNode, Ref } from 'react';

/**
 * The walnut frame + recessed mat that surrounds the board grid — the "study
 * table" presentation. Extracted so the live table (BlokusBoardView) and the
 * post-game review table (recap/ReviewTable, P2 R0.2) frame the board
 * identically: the reviewed board *is* the play board, at full size, not a
 * scaled-down copy. Callers pass the (optionally rotated) `<Board>` as children.
 */
export function BoardFrame({
  children,
  outerRef,
  urgent = false,
}: {
  children: ReactNode;
  /** Live table only: the shake target for a rejected placement (P16). */
  outerRef?: Ref<HTMLDivElement>;
  /** Live table only: red glow ring in the final blitz seconds (P24). */
  urgent?: boolean;
}) {
  return (
    <div ref={outerRef} style={{ ...frameStyle, boxShadow: urgent ? URGENT_SHADOW : FRAME_SHADOW }}>
      <div style={matStyle}>{children}</div>
    </div>
  );
}

const FRAME_SHADOW =
  'inset 0 1px 0 var(--frame-hi), inset 0 -1px 0 rgba(0,0,0,.4), 0 24px 48px rgba(15,9,3,.42)';
const URGENT_SHADOW =
  'inset 0 1px 0 var(--frame-hi), inset 0 -1px 0 rgba(0,0,0,.4), 0 24px 48px rgba(15,9,3,.42), 0 0 0 3px rgba(220,38,38,.85), 0 0 26px 4px rgba(220,38,38,.5)';

const frameStyle: CSSProperties = {
  background: 'linear-gradient(160deg, var(--frame-a), var(--frame-b))',
  borderRadius: 16,
  padding: 19,
  transition: 'box-shadow 0.2s ease',
};

const matStyle: CSSProperties = {
  background: 'var(--mat)',
  borderRadius: 7,
  padding: 13,
  boxShadow: 'inset 0 2px 9px rgba(0,0,0,.26)',
};
