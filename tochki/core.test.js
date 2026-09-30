import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, playHumanTurn, resign, legalMove } from './core.js';

test('a human move and a computer reply occupy different intersections', () => {
  const initial = createGame();
  const { game, error } = playHumanTurn(initial, 21, 30);
  assert.equal(error, null);
  assert.equal(initial.moves.length, 0);
  assert.deepEqual(game.moves.map(({ side }) => side), ['human', 'computer']);
  assert.equal(game.points.filter(Boolean).length, 2);
  assert.equal(game.turn, 'human');
  assert.equal(game.width, 43);
  assert.equal(game.height, 60);
});

test('invalid and repeated moves leave the game untouched', () => {
  const initial = createGame();
  assert.equal(playHumanTurn(initial, 43, 0).error, 'outside');
  assert.equal(playHumanTurn(initial, 1.5, 0).error, 'outside');
  const { game } = playHumanTurn(initial, 10, 10);
  const result = playHumanTurn(game, 10, 10);
  assert.equal(result.error, 'occupied');
  assert.equal(result.game, game);
  assert.equal(legalMove(game, 10, 10), 'occupied');
});

test('resignation ends play and blocks further input', () => {
  const { game } = resign(createGame());
  assert.equal(game.winner, 'computer');
  assert.equal(playHumanTurn(game, 2, 2).error, 'finished');
});

test('the same state produces the same computer answer', () => {
  const initial = createGame();
  assert.deepEqual(playHumanTurn(initial, 4, 8), playHumanTurn(initial, 4, 8));
});
