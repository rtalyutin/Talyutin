import { createGame, playHumanTurn, resign } from './core.js';
let game = createGame();
self.onmessage = ({ data }) => {
  const { id, action, x, y } = data;
  try {
    let result;
    if (action === 'new') result = { game: createGame(), error: null };
    else if (action === 'move') result = playHumanTurn(game, x, y);
    else if (action === 'resign') result = resign(game);
    else throw new Error('Unknown action');
    game = result.game;
    self.postMessage({ id, ...result });
  } catch {
    self.postMessage({ id, game, error: 'engine-error' });
  }
};
