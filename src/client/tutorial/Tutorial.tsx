import { useMemo, useRef, useState } from 'react';
import { BOARD_SIZE } from '../../shared/constants';
import { applyPlacement } from '../../game/placement';
import { resolveCells } from '../../game/pieces';
import type { GameState } from '../../game/types';
import { Board } from '../board/Board';
import { LegalMoveHints, type Hint } from '../advisor/LegalMoveHints';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { CELL_PX, FONT_MONO, FONT_UI, PANEL, PRIMARY_BTN, SECONDARY_BTN } from '../theme';
import { buildTutorial, type TutHint } from './scenarios';

const BOARD_PX = BOARD_SIZE * CELL_PX;

type FeedbackTone = 'good' | 'bad' | 'warn';

/**
 * P4 interactive tutorial. A four-step scripted sequence on a real board: start
 * from your corner → an illegal edge-touch is rejected → see the many corner
 * options → compare a cramped move against one that keeps room to grow. Uses the
 * rules core for every judgement and the shared LegalMoveHints overlay for the
 * clickable spots.
 */
export function Tutorial({ onExit, onComplete }: { onExit: () => void; onComplete?: () => void }) {
  const steps = useMemo(() => buildTutorial(), []);
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  // Working copy of this step's board; the placed piece lands here on success.
  const [G, setG] = useState<GameState>(() => structuredClone(step.G));
  const [phase, setPhase] = useState<'acting' | 'done'>('acting');
  const [feedback, setFeedback] = useState<{ text: string; tone: FeedbackTone } | null>(null);

  const reduce = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const shake = () => {
    const el = frameRef.current;
    if (reduce || !el || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-in-out' },
    );
  };

  const resetTo = (i: number) => {
    setStepIndex(i);
    setG(structuredClone(steps[i].G));
    setPhase('acting');
    setFeedback(null);
  };

  const onPick = (id: string) => {
    if (phase === 'done') return;
    const hint = step.hints.find((h) => h.id === id) as TutHint | undefined;
    if (!hint) return;
    if (hint.advances && hint.placement) {
      const next = structuredClone(G);
      applyPlacement(next, step.color, hint.placement.pieceId, resolveCells(hint.placement));
      setG(next);
      setPhase('done');
      setFeedback({ text: step.success, tone: 'good' });
    } else {
      setFeedback({ text: hint.feedback, tone: hint.tone === 'illegal' ? 'bad' : 'warn' });
      shake();
    }
  };

  // Once a step is done, stop offering its hints (the piece has landed).
  const hints: Hint[] = phase === 'done' ? [] : step.hints.map((h) => ({ id: h.id, cells: h.cells, tone: h.tone }));

  const isLast = stepIndex === steps.length - 1;
  // Finishing the last step is a real completion (P35 (d)); the top-bar "Skip
  // tutorial" exit is not, so only this path marks the tutorial done.
  const next = () => {
    if (!isLast) return resetTo(stepIndex + 1);
    onComplete?.();
    onExit();
  };

  const fbColor =
    feedback?.tone === 'good' ? '#16a34a' : feedback?.tone === 'bad' ? '#dc2626' : '#b45309';

  return (
    <div style={{ background: 'var(--table-bg)', minHeight: '100vh', fontFamily: FONT_UI }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 26px' }}>
        <span style={{ fontWeight: 900, fontSize: 25, color: 'var(--top-ink)' }}>OpenBlokus</span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '.09em',
            color: 'var(--top-mut)',
            border: '1px solid var(--top-bd)',
            borderRadius: 999,
            padding: '5px 12px',
          }}
        >
          How to play
        </span>
        <span style={{ flex: 1 }} />
        <button
          data-testid="tutorial-exit"
          onClick={onExit}
          style={{ ...SECONDARY_BTN, padding: '6px 14px', fontSize: 13 }}
        >
          {isLast && phase === 'done' ? 'Done' : 'Skip tutorial'}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '8px 26px 32px',
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Board + hint overlay in a walnut frame. */}
        <div
          ref={frameRef}
          style={{
            background: 'linear-gradient(160deg, var(--frame-a), var(--frame-b))',
            borderRadius: 16,
            padding: 16,
            boxShadow: 'inset 0 1px 0 var(--frame-hi), 0 24px 48px rgba(15,9,3,.42)',
          }}
        >
          <div style={{ position: 'relative', width: BOARD_PX, height: BOARD_PX }}>
            <Board board={G.board} activeColor={step.color} lastMove={G.lastMove} />
            <LegalMoveHints hints={hints} onPick={onPick} pulse />
          </div>
        </div>

        {/* Guidance panel */}
        <div style={{ ...PANEL, padding: 22, width: 320, boxSizing: 'border-box' }}>
          <div
            data-testid="tutorial-progress"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '.12em',
              color: 'var(--mut)',
              marginBottom: 8,
            }}
          >
            STEP {stepIndex + 1} OF {steps.length}
          </div>
          <h2 data-testid="tutorial-title" style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 20 }}>
            {step.title}
          </h2>
          <p style={{ margin: '0 0 14px', color: 'var(--ink)', fontSize: 14.5, lineHeight: 1.5 }}>
            {step.lesson}
          </p>

          {feedback && (
            <p
              data-testid="tutorial-feedback"
              style={{
                margin: '0 0 14px',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--well)',
                borderLeft: `3px solid ${fbColor}`,
                color: 'var(--ink)',
                fontSize: 13.5,
                lineHeight: 1.45,
              }}
            >
              {feedback.text}
            </p>
          )}

          {phase === 'done' && (
            <button data-testid="tutorial-next" onClick={next} style={{ ...PRIMARY_BTN, width: '100%' }}>
              {isLast ? 'Finish — play a game' : 'Next step →'}
            </button>
          )}

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center' }}>
            {steps.map((s, i) => (
              <span
                key={s.id}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: i === stepIndex ? 'var(--brass)' : 'var(--pnl-bd)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
