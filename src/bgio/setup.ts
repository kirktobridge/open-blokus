import type { Game } from 'boardgame.io';
import type { GameMode, GameState, ScoringVariant } from '../game/types';
import { createInitialState } from '../game/modes';

export interface BlokusSetupData {
  mode: GameMode;
  scoring: ScoringVariant;
}

type SetupFn = NonNullable<Game<GameState>['setup']>;
type ValidateFn = NonNullable<Game<GameState>['validateSetupData']>;

/** Build the initial G from setupData (falls back to ctx.numPlayers / basic). */
export const setup: SetupFn = ({ ctx }, setupData) => {
  const data = setupData as Partial<BlokusSetupData> | undefined;
  const mode = (data?.mode ?? ctx.numPlayers) as GameMode;
  const scoring: ScoringVariant = data?.scoring ?? 'basic';
  return createInitialState(mode, scoring);
};

/** Reject invalid setupData before a match is created (GAME_SPEC §7). */
export const validateSetupData: ValidateFn = (setupData, numPlayers) => {
  const data = setupData as Partial<BlokusSetupData> | undefined;
  const mode = data?.mode ?? numPlayers;
  if (![2, 3, 4].includes(mode)) return 'mode must be 2, 3, or 4';
  if (mode !== numPlayers) return 'mode must equal numPlayers';
  if (data?.scoring && !['basic', 'advanced'].includes(data.scoring))
    return 'invalid scoring variant';
  return undefined;
};
