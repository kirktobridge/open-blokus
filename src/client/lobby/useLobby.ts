import { useMemo } from 'react';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_NAME } from '../../shared/constants';
import type { GameMode, ScoringVariant } from '../../game/types';
import { SERVER_URL, type MatchInfo, type Session } from './config';

/** Thin wrapper around boardgame.io's LobbyClient for OpenBlokus matches. */
export function useLobby() {
  const client = useMemo(() => new LobbyClient({ server: SERVER_URL }), []);

  return useMemo(
    () => ({
      async createMatch(mode: GameMode, scoring: ScoringVariant): Promise<string> {
        const { matchID } = await client.createMatch(GAME_NAME, {
          numPlayers: mode,
          setupData: { mode, scoring },
        });
        return matchID;
      },

      async listMatches(): Promise<MatchInfo[]> {
        const { matches } = await client.listMatches(GAME_NAME);
        return matches as unknown as MatchInfo[];
      },

      /** Join the first free seat of a match. */
      async join(matchID: string): Promise<Session> {
        const match = (await client.getMatch(GAME_NAME, matchID)) as unknown as MatchInfo;
        const free = match.players.find((p) => !p.name);
        const seat = free ? String(free.id) : undefined;
        const { playerID, playerCredentials } = await client.joinMatch(GAME_NAME, matchID, {
          playerID: seat,
          playerName: `Player ${seat ?? '?'}`,
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
