import type { Color, GameMode } from '../../game/types';
import { COLOR_ORDER } from '../../game/types';
import { ownersFor } from '../../game/modes';
import { resolveExtremeForBlitz, type Difficulty } from '../ai/difficulty';
import type { BlitzSeconds } from '../blitz/blitz';
import { loadQuickPlay, saveQuickPlay } from './config';

/** A complete vs-AI setup — what Quick Play launches and Custom Game edits (P29). */
export interface AiSetup {
  mode: GameMode;
  aiCount: number;
  botDifficulties: Record<string, Difficulty>;
  blitzSeconds: BlitzSeconds;
}

export const DEFAULT_SETUP: AiSetup = {
  mode: 4,
  aiCount: 3,
  botDifficulties: {},
  blitzSeconds: null,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Bot seats (last `aiCount` playerIDs) and the label for each — the color(s) that
 * seat owns per `ownersFor(mode)`. A seat may own two colors (2p). The 3p 'shared'
 * color belongs to no fixed seat, so it doesn't add a label. If a seat owns a
 * shared color's turns too (3p), we note it. Returned in seat order.
 */
export function botSeatLabels(mode: GameMode, aiCount: number): { seat: string; label: string }[] {
  const humanCount = Math.max(0, mode - aiCount);
  const owners = ownersFor(mode);
  const colorsForSeat = (seat: string): Color[] =>
    COLOR_ORDER.filter((c) => owners[c] === seat);
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

/**
 * Human-readable one-liner for a setup: who's playing · the bots' tier(s) · the
 * clock. Collapses a uniform lineup to "all easy" and names the clock as "untimed"
 * when off, so the summary reads like a sentence, not a debug dump. It's the
 * subtitle under Quick Play — the one thing that says what that button will start.
 */
export function setupSummary({ mode, aiCount, botDifficulties, blitzSeconds }: AiSetup): string {
  const humanCount = mode - aiCount;
  const tiers = botSeatLabels(mode, aiCount).map(({ seat }) => botDifficulties[seat] ?? 'easy');
  const uniform = tiers.length > 0 && tiers.every((t) => t === tiers[0]);

  return [
    aiCount === mode
      ? `Watch — ${mode} bots`
      : `You${humanCount > 1 ? ` +${humanCount - 1}` : ''} vs ${aiCount} ${aiCount === 1 ? 'bot' : 'bots'}`,
    tiers.length === 0 ? null : uniform ? `all ${tiers[0]}` : tiers.join(', '),
    // The clock only ever runs on a human seat, so a watch game stays silent on it.
    humanCount > 0 ? (blitzSeconds != null ? `blitz ${blitzSeconds}s` : 'untimed') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Every seat in `mode`/`aiCount` gets a tier (default 'easy') and stale seats are
 * dropped, so a setup carried across a player-count change never keeps a phantom
 * seat. Then extreme is retired on a blitz clock — it has no time budget and can't
 * race one (P25).
 */
export function normalizeSetup(setup: AiSetup): AiSetup {
  const seats = botSeatLabels(setup.mode, setup.aiCount);
  const tiers: Record<string, Difficulty> = {};
  for (const { seat } of seats) tiers[seat] = setup.botDifficulties[seat] ?? 'easy';
  return {
    ...setup,
    aiCount: Math.min(setup.aiCount, setup.mode),
    botDifficulties: resolveExtremeForBlitz(tiers, setup.blitzSeconds),
  };
}

/** The pinned setup (or the built-in default), normalized — what Quick Play starts. */
export function loadSetup(): AiSetup {
  const saved = loadQuickPlay();
  if (!saved) return DEFAULT_SETUP;
  return normalizeSetup({
    mode: saved.mode,
    aiCount: saved.aiCount,
    botDifficulties: saved.botDifficulties ?? {},
    blitzSeconds: saved.blitzSeconds ?? null,
  });
}

/**
 * Normalize at the launch boundary, so no invalid setup can ever start (P17's
 * guard). Deliberately does *not* save: starting a game says nothing about what
 * you want next time, and it was that write which let one odd experiment become
 * the one-click default (P46).
 */
export function launchSetup(setup: AiSetup): AiSetup {
  return normalizeSetup(setup);
}

/** Pin a setup as the Quick Play default — the only thing that writes it (P46). */
export function pinSetup(setup: AiSetup): AiSetup {
  const normalized = normalizeSetup(setup);
  saveQuickPlay(normalized);
  return normalized;
}

/**
 * Canonical identity of a setup, for "is this already my default?". Compares what
 * a game would actually start with, so the two sides are normalized first and the
 * per-seat tiers are ordered — an equivalent setup reached by a different route
 * still counts as the same one.
 */
export function setupKey(setup: AiSetup): string {
  const { mode, aiCount, blitzSeconds, botDifficulties } = normalizeSetup(setup);
  const tiers = Object.keys(botDifficulties)
    .sort()
    .map((seat) => `${seat}:${botDifficulties[seat]}`);
  return [mode, aiCount, blitzSeconds ?? 'off', ...tiers].join('|');
}
