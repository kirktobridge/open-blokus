import { useSyncExternalStore } from 'react';
import type { ScoringVariant, Variant } from '../../game/types';
import { DIFFICULTIES, type Difficulty } from '../ai/difficulty';

/**
 * Local progression (product P15 M1). Purely client-side: a small localStorage
 * store of lifetime stats (games, win rate per tier, best score, streaks) plus
 * one-time milestone unlocks (first win vs each tier, first perfect clear). The
 * fold logic (`applyResult`) is pure and unit-tested; the store around it mirrors
 * settings.ts (useSyncExternalStore + JSON in localStorage), so it's node-safe
 * (no-op without localStorage) and needs no server.
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Outcome of one finished game, from the local player's ("you", seat 0) view. */
export interface GameResult {
  /** You won (or tied for the win). */
  won: boolean;
  /** Your final score (per-player total; variant-aware, so it can be negative). */
  score: number;
  /**
   * The variant that number was scored under — which also fixes which direction
   * is "best": `basic` counts squares left (lower wins), `advanced` counts points
   * (higher wins), GAME_SPEC §6. Without it the fold can only guess, and guessing
   * `max` is what made the tile report your worst game (P51).
   */
  scoring: ScoringVariant;
  /**
   * Which game it was. Classic and Duo are different games — a tier's strength,
   * a "perfect clear", and an advanced-scoring total all mean something different
   * on 14×14 with two colors — so every per-variant bucket below is keyed by this
   * rather than blended (P56).
   */
  variant: Variant;
  /** Hardest AI opponent tier faced, or null if the game had no AI opponent. */
  hardestTier: Difficulty | null;
  /** You placed all 21 of your pieces. */
  perfectClear: boolean;
}

export interface TierStat {
  played: number;
  won: number;
}

export interface ProgressionState {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  /**
   * Best "your score" per scoring variant; null until a game is recorded under
   * that variant. Kept apart because the two aren't the same quantity — 32 squares
   * left and 32 points share no scale, so one slot could only ever mix units.
   */
  bestScores: Record<Variant, Record<ScoringVariant, number | null>>;
  perTier: Record<Variant, Record<Difficulty, TierStat>>;
  /** Tiers a first-win milestone already fired for, per variant (toast fires once each). */
  firstWinTiers: Record<Variant, Difficulty[]>;
  perfectClears: Record<Variant, number>;
}

/** Every variant a bucket exists for. Order = display order. */
export const VARIANT_KEYS: readonly Variant[] = ['classic', 'duo'];

/** Human name for a variant, for milestone copy and panel headings. */
export const VARIANT_LABEL: Record<Variant, string> = { classic: 'Classic', duo: 'Duo' };

/** Whether any finished game has been folded in under `v` (every game sets a best). */
export const hasGames = (p: ProgressionState, v: Variant): boolean =>
  Object.values(p.bestScores[v]).some((x) => x != null);

const emptyTiers = (): Record<Difficulty, TierStat> => {
  const perTier = {} as Record<Difficulty, TierStat>;
  for (const d of DIFFICULTIES) perTier[d] = { played: 0, won: 0 };
  return perTier;
};

const byVariant = <T>(make: () => T): Record<Variant, T> =>
  Object.fromEntries(VARIANT_KEYS.map((v) => [v, make()])) as Record<Variant, T>;

/** A newly-unlocked achievement, surfaced as a transient toast. */
export interface Milestone {
  id: string;
  label: string;
  detail?: string;
}

export function emptyProgression(): ProgressionState {
  return {
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    bestScores: byVariant(() => ({ basic: null, advanced: null })),
    perTier: byVariant(emptyTiers),
    firstWinTiers: byVariant<Difficulty[]>(() => []),
    perfectClears: byVariant(() => 0),
  };
}

/** The strongest tier among those faced (DIFFICULTIES is ordered easy→extreme). */
export function hardestTier(tiers: Difficulty[]): Difficulty | null {
  let best: Difficulty | null = null;
  let bestRank = -1;
  for (const t of tiers) {
    const rank = DIFFICULTIES.indexOf(t);
    if (rank > bestRank) {
      bestRank = rank;
      best = t;
    }
  }
  return best;
}

/** The better of a stored best and a new result, in that variant's direction. */
const bestOf = (prev: number | null, r: GameResult): number =>
  prev == null ? r.score : r.scoring === 'basic' ? Math.min(prev, r.score) : Math.max(prev, r.score);

/** What the unit is called next to the number (mirrors the history rows, P15 M2). */
const UNIT: Record<ScoringVariant, string> = { basic: 'left', advanced: 'pts' };

/**
 * The single "Best score" tile from the per-variant bests. One slot, two possible
 * quantities: show `basic` (the default variant) when you've played it, else
 * `advanced`. The unit travels with the number — a bare "32" reads as points
 * earned, which is the opposite of what basic counts (P51).
 */
export function bestScoreTile(
  p: ProgressionState,
  variant: Variant = 'classic',
): { value: string; title: string } | null {
  const bests = p.bestScores[variant];
  const scoring: ScoringVariant | null =
    bests.basic != null ? 'basic' : bests.advanced != null ? 'advanced' : null;
  if (!scoring) return null;
  const score = bests[scoring] as number;
  const other = scoring === 'basic' ? bests.advanced : null;
  return {
    value: `${score} ${UNIT[scoring]}`,
    title:
      (scoring === 'basic'
        ? `${score} squares left — lower is better`
        : `${score} points — higher is better`) +
      (other != null ? ` · best under advanced scoring: ${other} pts` : ''),
  };
}

/**
 * Fold one finished game into progression. Pure — returns the next state and any
 * newly-unlocked milestones. A game is bucketed under its hardest opponent tier;
 * first-win-vs-tier and first-perfect-clear each unlock exactly once (ever).
 */
export function applyResult(
  prev: ProgressionState,
  r: GameResult,
): { state: ProgressionState; unlocked: Milestone[] } {
  const unlocked: Milestone[] = [];
  const v = r.variant;
  const label = VARIANT_LABEL[v];

  const tiers = { ...prev.perTier[v] };
  const firstWins = [...prev.firstWinTiers[v]];
  if (r.hardestTier) {
    const t = tiers[r.hardestTier];
    tiers[r.hardestTier] = { played: t.played + 1, won: t.won + (r.won ? 1 : 0) };
    if (r.won && !firstWins.includes(r.hardestTier)) {
      firstWins.push(r.hardestTier);
      unlocked.push({
        id: `first-win-${v}-${r.hardestTier}`,
        label: `First ${label} win vs ${cap(r.hardestTier)}`,
        detail: 'Your first victory at this tier',
      });
    }
  }

  if (r.perfectClear && prev.perfectClears[v] === 0) {
    unlocked.push({
      id: `perfect-clear-${v}`,
      label: 'Perfect clear!',
      detail: `You placed all 21 pieces in ${label}`,
    });
  }

  const currentStreak = r.won ? prev.currentStreak + 1 : 0;
  const state: ProgressionState = {
    gamesPlayed: prev.gamesPlayed + 1,
    wins: prev.wins + (r.won ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(prev.bestStreak, currentStreak),
    bestScores: {
      ...prev.bestScores,
      [v]: { ...prev.bestScores[v], [r.scoring]: bestOf(prev.bestScores[v][r.scoring], r) },
    },
    perTier: { ...prev.perTier, [v]: tiers },
    firstWinTiers: { ...prev.firstWinTiers, [v]: firstWins },
    perfectClears: { ...prev.perfectClears, [v]: prev.perfectClears[v] + (r.perfectClear ? 1 : 0) },
  };

  return { state, unlocked };
}

/** Win rate in [0,1], or null when no games are recorded (avoids 0/0). */
export function winRate(played: number, won: number): number | null {
  return played > 0 ? won / played : null;
}

// --- localStorage store (mirrors settings.ts) --------------------------------

const STORAGE_KEY = 'openblokus-progression';

const store: Pick<Storage, 'getItem' | 'setItem'> | null =
  typeof localStorage !== 'undefined' ? localStorage : null;

function sanitizeBests(parsed: unknown): Record<ScoringVariant, number | null> {
  const p = (parsed ?? {}) as Partial<Record<ScoringVariant, unknown>>;
  const one = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return { basic: one(p.basic), advanced: one(p.advanced) };
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function sanitizeTiers(parsed: unknown): Record<Difficulty, TierStat> {
  const out = emptyTiers();
  if (parsed && typeof parsed === 'object') {
    for (const d of DIFFICULTIES) {
      const t = (parsed as Record<string, unknown>)[d] as Partial<TierStat> | undefined;
      if (t && typeof t === 'object') out[d] = { played: num(t.played, 0), won: num(t.won, 0) };
    }
  }
  return out;
}

const sanitizeTierList = (parsed: unknown): Difficulty[] =>
  Array.isArray(parsed)
    ? parsed.filter((t): t is Difficulty => DIFFICULTIES.includes(t as Difficulty))
    : [];

/**
 * A stored bucket keyed by variant, tolerating the pre-variant shape.
 *
 * Every blob written before P56 holds one un-keyed bucket, and every game in it
 * was Classic (Duo did not exist), so it is *attributed* to `classic` rather than
 * dropped — the P51 rule is attribute-or-drop, and here the attribution is a fact
 * about when the data was written, not a guess.
 */
function sanitizeByVariant<T>(parsed: unknown, one: (raw: unknown) => T): Record<Variant, T> {
  const out = byVariant(() => one(undefined));
  const rec = parsed as Record<string, unknown> | null | undefined;
  const keyed =
    !!rec && typeof rec === 'object' && !Array.isArray(rec) && VARIANT_KEYS.some((v) => v in rec);
  if (!keyed) return { ...out, classic: one(parsed) };
  for (const v of VARIANT_KEYS) out[v] = one(rec[v]);
  return out;
}

/** Overlay a parsed blob onto a fresh state, keeping only well-typed fields. */
export function sanitize(parsed: Partial<ProgressionState>): ProgressionState {
  return {
    gamesPlayed: num(parsed.gamesPlayed, 0),
    wins: num(parsed.wins, 0),
    currentStreak: num(parsed.currentStreak, 0),
    bestStreak: num(parsed.bestStreak, 0),
    // A pre-P51 blob carries a single `bestScore` that is a max-fold across
    // scoring systems: under `basic` that's the *worst* game, and nothing stored
    // says which system it came from, so it can't be repaired — only dropped. The
    // tile reads "—" until your next game, then it's right. Everything else in
    // the blob (games, wins, streaks, tiers) was never wrong and survives.
    bestScores: sanitizeByVariant(parsed.bestScores, sanitizeBests),
    perTier: sanitizeByVariant(parsed.perTier, sanitizeTiers),
    firstWinTiers: sanitizeByVariant(parsed.firstWinTiers, sanitizeTierList),
    perfectClears: sanitizeByVariant(parsed.perfectClears, (v) => num(v, 0)),
  };
}

function load(): ProgressionState {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return emptyProgression();
    return sanitize(JSON.parse(raw) as Partial<ProgressionState>);
  } catch {
    return emptyProgression();
  }
}

let state: ProgressionState = load();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((cb) => cb());
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): ProgressionState {
  return state;
}
function commit(next: ProgressionState) {
  state = next;
  store?.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
}

/** Fold a finished game into the persisted store; returns unlocked milestones. */
export function recordGameResult(r: GameResult): Milestone[] {
  const { state: next, unlocked } = applyResult(state, r);
  commit(next);
  return unlocked;
}

export function resetProgression(): void {
  commit(emptyProgression());
}

export function useProgression(): ProgressionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
