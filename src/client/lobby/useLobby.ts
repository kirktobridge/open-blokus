import { useMemo } from 'react';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_NAME } from '../../shared/constants';
import type { GameMode, ScoringVariant, Variant } from '../../game/types';
import { scoringFor } from '../../game/modes';
import { SERVER_URL, type MatchInfo, type Session } from './config';

/** Thin wrapper around boardgame.io's LobbyClient for OpenBlokus matches. */
export function useLobby() {
  const client = useMemo(() => new LobbyClient({ server: SERVER_URL }), []);

  return useMemo(
    () => ({
      async createMatch(
        mode: GameMode,
        scoring: ScoringVariant,
        variant: Variant = 'classic',
      ): Promise<string> {
        const { matchID } = await client.createMatch(GAME_NAME, {
          numPlayers: mode,
          // Duo pins its own scoring (GAME_SPEC_DUO §4), so resolve it here rather
          // than trusting whatever the form last had selected.
          setupData: { mode, scoring: scoringFor(variant, scoring), variant },
        });
        return matchID;
      },

      async listMatches(): Promise<MatchInfo[]> {
        const { matches } = await client.listMatches(GAME_NAME);
        return matches as unknown as MatchInfo[];
      },

      /**
       * Join the first free seat of a match. A trimmed `nickname` is sent as the
       * seat's name; when absent we fall back to `Player N` so the seat still
       * counts as occupied (MatchList) but reads as anonymous (see isRealName).
       */
      async join(matchID: string, nickname?: string): Promise<Session> {
        const match = (await client.getMatch(GAME_NAME, matchID)) as unknown as MatchInfo;
        const free = match.players.find((p) => !p.name);
        const seat = free ? String(free.id) : undefined;
        const name = nickname?.trim();
        const { playerID, playerCredentials } = await client.joinMatch(GAME_NAME, matchID, {
          playerID: seat,
          playerName: name || `Player ${seat ?? '?'}`,
        });
        return {
          matchID,
          playerID,
          credentials: playerCredentials,
          numPlayers: match.players.length,
        };
      },

      async leave(session: Session): Promise<void> {
        try {
          await client.leaveMatch(GAME_NAME, session.matchID, {
            playerID: session.playerID,
            credentials: session.credentials,
          });
        } catch {
          // best-effort; ignore if already gone
        }
      },

      async playAgain(session: Session): Promise<string> {
        const { nextMatchID } = await client.playAgain(GAME_NAME, session.matchID, {
          playerID: session.playerID,
          credentials: session.credentials,
        });
        return nextMatchID;
      },
    }),
    [client],
  );
}
