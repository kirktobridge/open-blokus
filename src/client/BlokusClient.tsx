import { Client } from 'boardgame.io/react';
import { BlokusGame } from '../bgio/BlokusGame';
import { BlokusBoardView } from './BlokusBoardView';

/**
 * Dev client: single-player with the boardgame.io debug panel. Use the panel to
 * dispatch placePiece and step turns through all four colors.
 * (Local/SocketIO multiplayer is wired in later phases.)
 */
export const BlokusClient = Client({
  game: BlokusGame,
  board: BlokusBoardView,
  numPlayers: 4,
  debug: true,
});
