import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, playMove } from './core.js';
import { findNewContours, CapturePending } from './capture.js';

test('dense 4x4 exact search completes at the unchanged default budget', () => {
  const game = createGame();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    game.points[y * game.width + x] = 'human';
  }
  const snapshot = structuredClone(game);
  const contours = findNewContours(game, { side: 'human', x: 2, y: 2 });
  assert.equal(contours.length, 15124);
  assert.equal(Math.max(...contours.map(c => c.area)), 8.5);
  assert.deepEqual(game, snapshot);
  assert.throws(() => findNewContours(game, { side: 'human', x: 2, y: 2 },
    { searchBudget: 10000 }), error => error instanceof CapturePending &&
      error.code === 'capture-search-limit');
});

test('pruned search still reports incomplete transactions atomically', () => {
  const game = createGame();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    if (x !== 2 || y !== 2) game.points[y * game.width + x] = 'human';
  }
  const snapshot = structuredClone(game);
  const result = playMove(game, 'human', 2, 2, { searchBudget: 100 });
  assert.equal(result.error, 'capture-search-limit');
  assert.equal(result.game, game);
  assert.deepEqual(game, snapshot);
});
