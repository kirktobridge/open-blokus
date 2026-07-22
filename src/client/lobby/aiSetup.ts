import type { Color, GameMode, Variant } from '../../game/types';
import { VARIANTS, ownersFor } from '../../game/modes';
import { resolveExtremeForBlitz, type Difficulty } from '../ai/difficulty';
import type { BlitzSeconds } from '../blitz/blitz';
import { loadQuickPlay, saveQuickPlay } from './config';

/** A complete vs-AI setup — what Quick Play launches and Custom Game edits (P29). */
export interface AiSetup {
  mode: GameMode;
  aiCount: number;
  botDifficulties: Record<string, Difficulty>;
  blitzSeconds: BlitzSeconds;
  /** Rule set (P20 M2b). Duo is a fixed 2-seat game, so it pins `mode`. */
  variant: Variant;
}

export const DEFAULT_SETUP: AiSetup = {
  mode: 4,
  aiCount: 3,
  botDifficulties: {},
  blitzSeconds: null,
  variant: 'classic',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Bot seats (last `aiCount` playerIDs) and the label for each — the color(s) that
 * seat owns per `ownersFor(mode)`. A seat may own two colors (2p). The 3p 'shared'
 * color belongs to no fixed seat, so it doesn't add a label. If a seat owns a
 * shared color's turns too (3p), we note it. Returned in seat order.
 */
export function botSeatLabels(
  mode: GameMode,
  aiCount: number,
  variant: Variant = 'classic',
): { seat: string; label: string }[] {
  const humanCount = Math.max(0, mode - aiCount);
  const owners = ownersFor(mode, variant);
  const play = VARIANTS[variant].playColors;
  const colorsForSeat = (seat: string): Color[] => play.filter((c) => owners[c] === seat);
  const hasShared = play.some((c) => owners[c] === 'shared');

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
export function setupSummary({ mode, aiCount, botDifficulties, blitzSeconds, variant }: AiSetup): string {
  const humanCount = mode - aiCount;
  const tiers = botSeatLabels(mode, aiCount, variant).map(({ seat }) => botDifficulties[seat] ?? 'easy');
  const uniform = tiers.length > 0 && tiers.every((t) => t === tiers[0]);

  return [
    variant === 'duo' ? 'Duo' : null,
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
  const variant: Variant = setup.variant ?? 'classic';
  // Duo is exactly two seats (GAME_SPEC_DUO §5), so switching to it pins the player
  // count rather than leaving an unstartable 4-player Duo in the form.
  const modes = VARIANTS[variant].modes;
  const mode = modes.includes(setup.mode) ? setup.mode : modes[0];
  const aiCount = Math.min(setup.aiCount, mode);
  const seats = botSeatLabels(mode, aiCount, variant);
  const tiers: Record<string, Difficulty> = {};
  for (const { seat } of seats) tiers[seat] = setup.botDifficulties[seat] ?? 'easy';
  return {
    ...setup,
    variant,
    mode,
    aiCount,
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
    variant: saved.variant ?? 'classic',
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
  const { mode, aiCount, blitzSeconds, botDifficulties, variant } = normalizeSetup(setup);
  const tiers = Object.keys(botDifficulties)
    .sort()
    .map((seat) => `${seat}:${botDifficulties[seat]}`);
  return [variant, mode, aiCount, blitzSeconds ?? 'off', ...tiers].join('|');
}
