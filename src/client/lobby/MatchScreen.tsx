import { useMemo } from 'react';
import { makeNetworkedClient } from '../BlokusClient';
import { SERVER_URL, type Session } from './config';
import { SessionActionsContext } from './sessionContext';
import { CopyInvite } from './CopyInvite';

export function MatchScreen({
  session,
  onLeave,
  onPlayAgain,
}: {
  session: Session;
  onLeave: () => void;
  onPlayAgain: () => void;
}) {
  // The client is fixed to a player count, so rebuild it if numPlayers changes.
  const NetClient = useMemo(
    () => makeNetworkedClient(SERVER_URL, session.numPlayers),
    [session.numPlayers],
  );

  return (
    <SessionActionsContext.Provider value={{ onPlayAgain, onLeave }}>
      <div>
        <div
          style={{
            padding: 8,
            fontFamily: 'system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span data-testid="match-id">Match: {session.matchID}</span>
          <span>· you are P{session.playerID}</span>
          <CopyInvite matchID={session.matchID} compact />
          <button data-testid="leave" onClick={onLeave}>
            Leave
          </button>
        </div>
        <NetClient
          matchID={session.matchID}
          playerID={session.playerID}
          credentials={session.credentials}
        />
      </div>
    </SessionActionsContext.Provider>
  );
}
