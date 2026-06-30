import { Server, Origins } from 'boardgame.io/server';
import { BlokusGame } from '../bgio/BlokusGame';

const PORT = Number(process.env.PORT ?? 8000);

const server = Server({
  games: [BlokusGame],
  origins: [Origins.LOCALHOST_IN_DEVELOPMENT],
});

server.run(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`OpenBlokus server listening on :${PORT}`);
});
