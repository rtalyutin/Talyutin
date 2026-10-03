import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './core.js';
import { evaluateSafeLead, prepareSafeLeadSnapshot } from './early-finish.js';

const proof = overrides => evaluateSafeLead({
  leader: 'human',
  trailing: 'computer',
  leaderScore: 9,
  trailingScore: 2,
  unscoredLeaderPoints: 2,
  emptyIntersections: 1,
  liberatableTrailingPoints: 3,
  ...overrides,
});

test('strictly smaller optimistic score proves a safe winner', () => {
  assert.deepEqual(proof({}), {
    leader: 'human', trailing: 'computer', upperBound: 5, lowerBound: 6, proven: true,
  });
});

test('equality preserves the trailing side chance to draw', () => {
  assert.deepEqual(proof({ emptyIntersections: 2 }), {
    leader: 'human', trailing: 'computer', upperBound: 6, lowerBound: 6, proven: false,
  });
});

test('each potentially liberated dot lowers the leader bound once', () => {
  assert.equal(proof({ liberatableTrailingPoints: 4 }).lowerBound, 5);
});

test('empty board has no leader and no early-finish snapshot', () => {
  assert.equal(prepareSafeLeadSnapshot(createGame()), null);
});

test('snapshot counts every empty intersection, including a closed region', () => {
  const game = createGame();
  game.points[0] = 'human';
  game.points[1] = 'computer';
  game.score.human = 1;
  game.capturedBy[1] = 'human';
  game.regions.push({ state: 'active', side: 'human', captured: [1], contour: [
    { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
  ] });
  const snapshot = prepareSafeLeadSnapshot(game);
  assert.equal(snapshot.emptyIntersections, game.width * game.height - 2);
  assert.equal(snapshot.unscoredLeaderPoints, 1);
});

test('invalid or internally impossible bounds are rejected', () => {
  assert.throws(() => proof({ emptyIntersections: -1 }), /emptyIntersections/);
  assert.throws(() => proof({ liberatableTrailingPoints: 10 }), /liberatableTrailingPoints/);
  assert.throws(() => proof({ leader: 'human', trailing: 'human' }), /sides/);
  assert.throws(() => proof({
    trailingScore: Number.MAX_SAFE_INTEGER,
    unscoredLeaderPoints: 1,
  }), /upperBound/);
});
