import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, legalMove, playMove } from './core.js';
import { contourArea, pointLocation, validContour } from './capture.js';

function position(own, enemy = [], side = 'human') {
  const game = createGame();
  for (const [x, y] of own) game.points[y * game.width + x] = side;
  for (const [x, y] of enemy) game.points[y * game.width + x] = side === 'human' ? 'computer' : 'human';
  game.turn = side;
  return game;
}
const diamond = [[1, 0], [2, 1], [1, 2], [0, 1]];
function square(min, max) {
  const points = [];
  for (let x = min; x < max; x++) points.push([x, min]);
  for (let y = min; y < max; y++) points.push([max, y]);
  for (let x = max; x > min; x--) points.push([x, max]);
  for (let y = max; y > min; y--) points.push([min, y]);
  return points;
}

for (const side of ['human', 'computer']) test(`${side}: diagonal ring captures one point and returns polygon`, () => {
  const initial = position(diamond.slice(0, -1), [[1, 1]], side);
  const original = JSON.stringify(initial);
  const result = playMove(initial, side, 0, 1);
  assert.equal(result.error, null);
  assert.equal(result.game.score[side], 1);
  assert.equal(result.game.regions[0].state, 'active');
  assert.equal(result.game.regions[0].area, 2);
  assert.deepEqual(result.game.regions[0].captured, [44]);
  assert.equal(result.game.inactive[44], true);
  assert.equal(result.game.capturedBy[44], side);
  assert.equal(JSON.stringify(initial), original);
  assert.equal(result.game.turn, side === 'human' ? 'computer' : 'human');
});

test('largest-area square wins over its diagonal shortcuts; boundary dots are not captured', () => {
  const ring = square(1, 3);
  const initial = position(ring.slice(0, -1), [[2, 2]]);
  const { game, error } = playMove(initial, 'human', ...ring.at(-1));
  assert.equal(error, null);
  assert.equal(game.regions[0].area, 4);
  assert.equal(game.regions[0].contour.length, 8);
  assert.equal(game.score.human, 1);
  for (const [x, y] of ring) assert.equal(game.inactive[y * game.width + x], false);
  assert.equal(pointLocation({ x: 1, y: 2 }, game.regions[0].contour), 'boundary');
});

test('empty house waits without score, then captures immediately and closes remaining interior', () => {
  const ring = square(1, 4), initial = position(ring.slice(0, -1));
  const waiting = playMove(initial, 'human', ...ring.at(-1));
  assert.equal(waiting.error, null);
  assert.equal(waiting.game.regions[0].area, 9);
  assert.equal(waiting.game.regions[0].state, 'waiting');
  assert.equal(waiting.game.score.human, 0);
  assert.equal(legalMove(waiting.game, 3, 3), null);
  const result = playMove(waiting.game, 'computer', 2, 2);
  assert.equal(result.error, null);
  assert.equal(result.game.regions.length, 1);
  assert.equal(result.game.regions[0].state, 'active');
  assert.equal(result.game.score.human, 1);
  assert.equal(result.game.score.computer, 0);
  assert.equal(legalMove(result.game, 3, 3), 'closed-zone');
  const blocked = playMove(result.game, 'human', 3, 3);
  assert.equal(blocked.error, 'closed-zone');
  assert.equal(blocked.game, result.game);
  assert.equal(waiting.game.regions[0].state, 'waiting');
});

test('open chain against the board edge does not capture', () => {
  const initial = position([[0, 0], [1, 0], [2, 1]], [[1, 1]]);
  const { game, error } = playMove(initial, 'human', 2, 2);
  assert.equal(error, null);
  assert.deepEqual(game.regions, []);
  assert.equal(game.score.human, 0);
});

test('self-crossing diagonals, repeated vertices and two-cell links cannot be contours', () => {
  const points = list => list.map(([x, y]) => ({ x, y }));
  assert.equal(validContour(points([[0, 0], [1, 1], [0, 1], [1, 0]])), false);
  assert.equal(validContour(points([[0, 0], [1, 0], [0, 0]])), false);
  assert.equal(validContour(points([[0, 0], [2, 0], [2, 2], [0, 2]])), false);
  assert.equal(validContour(points(diamond)), true);
  assert.equal(contourArea(points(diamond)), 2);
});

test('a triangle with no interior grid points creates no house', () => {
  const { game, error } = playMove(position([[0, 0], [1, 0]]), 'human', 0, 1);
  assert.equal(error, null);
  assert.equal(game.regions.length, 0);
});

test('a new contour crossing an earlier house is ignored', () => {
  const initial = position(diamond.slice(0, -1), [[1, 1]]);
  initial.regions = [{ id: 1, side: 'computer', createdMove: 1, state: 'waiting', area: 2,
    captured: [], contour: [{ x: 2, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 1 }] }];
  const { game, error } = playMove(initial, 'human', 0, 1);
  assert.equal(error, null);
  assert.equal(game.regions.length, 1);
  assert.equal(game.score.human, 0);
});

test('equal-area alternative rings return a diagnostic without committing a move', () => {
  const initial = position([[0, 2], [1, 1], [1, 3], [3, 1], [4, 2], [3, 3]]);
  const result = playMove(initial, 'human', 2, 2);
  assert.equal(result.error, 'equal-area-contours-pending');
  assert.equal(result.game, initial);
  assert.equal(initial.points[2 * initial.width + 2], null);
});

test('exhausted search never returns a submaximal capture or partially changes state', () => {
  const initial = position(diamond.slice(0, -1), [[1, 1]]);
  const result = playMove(initial, 'human', 0, 1, { searchBudget: 1 });
  assert.equal(result.error, 'capture-search-limit');
  assert.equal(result.game, initial);
  assert.equal(initial.score.human, 0);
});

test('same starting position and command give the same contour and score', () => {
  const initial = position(diamond.slice(0, -1), [[1, 1]]);
  assert.deepEqual(playMove(initial, 'human', 0, 1), playMove(initial, 'human', 0, 1));
});

test('capture of the last available interior ends the game by score', () => {
  const initial = position(diamond.slice(0, -1), [[1, 1]]);
  initial.width = 3; initial.height = 3;
  initial.points = Array(9).fill('computer');
  initial.capturedBy = Array(9).fill(null);
  initial.inactive = Array(9).fill(false);
  for (const [x, y] of diamond.slice(0, -1)) initial.points[y * 3 + x] = 'human';
  initial.points[3] = null;
  const result = playMove(initial, 'human', 0, 1);
  assert.equal(result.error, null);
  assert.equal(result.game.phase, 'finished');
  assert.equal(result.game.turn, null);
  assert.equal(result.game.winner, 'human');
  assert.deepEqual(result.game.score, { human: 1, computer: 0 });
});

test('exhaustion immediately after the computer move permits a draw', () => {
  const initial = createGame();
  initial.width = 1; initial.height = 1; initial.turn = 'computer';
  initial.points = [null]; initial.inactive = [false]; initial.capturedBy = [null];
  const result = playMove(initial, 'computer', 0, 0);
  assert.equal(result.error, null);
  assert.equal(result.game.phase, 'finished');
  assert.equal(result.game.winner, 'draw');
});
