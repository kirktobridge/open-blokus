import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { BlokusGame } from '../bgio/BlokusGame';
import { BlokusBoardView } from './BlokusBoardView';

/**
 * Dev client: single-player with the boardgame.io debug panel. Use the panel to
 * dispatch placePiece and step turns through all four colors.
 */
export const BlokusClient = Client({
  game: BlokusGame,
  board: BlokusBoardView,
  numPlayers: 4,
});

/**
 * Networked client factory (used by the lobby in Phase 8). Connects to the
 * boardgame.io server over Socket.IO; pass matchID/playerID/credentials as props.
 */
export function makeNetworkedClient(server: string, numPlayers: number) {
  return Client({
    game: BlokusGame,
    board: BlokusBoardView,
    numPlayers,
    multiplayer: SocketIO({ server }),
  });
}
