import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, analyzeComputerMove, chooseComputerMove, chooseBaselineComputerMove,
  legalMove, playMove, playHumanTurn } from './core.js';
import { planComputerMove } from './bot.js';

function position(computer = [], human = []) {
  const game = createGame(); game.turn = 'computer';
  for (const [side, points] of [['computer', computer], ['human', human]]) {
    for (const [x, y] of points) game.points[y * game.width + x] = side;
  }
  return game;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

const topDiamond = [[11, 10], [12, 11], [10, 11]];
test('finishes its supported capture through the actual engine', () => {
  const game = position(topDiamond, [[11, 11]]);
  const { move, stats } = analyzeComputerMove(game);
  assert.deepEqual(move, { x: 11, y: 12 });
  const result = playMove(game, 'computer', move.x, move.y);
  assert.equal(result.error, null);
  assert.equal(result.game.score.computer, 1);
  assert.equal(stats.validated, true);
});

test('human reply changes a greedy decision and stops an immediate capture', () => {
  const game = position([[11, 11]], topDiamond);
  const shallow = analyzeComputerMove(game, { maxDepth: 1 });
  const planned = analyzeComputerMove(game);
  assert.notDeepEqual(shallow.move, { x: 11, y: 12 });
  assert.deepEqual(planned.move, { x: 11, y: 12 });
  assert.ok(planned.stats.completedDepth >= 2);
  assert.ok(planned.stats.maxPlyReached >= 2);
  assert.ok(planned.stats.principalVariation.length >= 2);
  const greedy = playMove(game, 'computer', shallow.move.x, shallow.move.y).game;
  assert.equal(playMove(greedy, 'human', 11, 12).game.score.human, 1);
  const defended = playMove(game, 'computer', planned.move.x, planned.move.y).game;
  assert.equal(legalMove(defended, 11, 12), 'occupied');
  for (let y = 8; y <= 14; y++) for (let x = 8; x <= 14; x++) {
    if (legalMove(defended, x, y)) continue;
    const reply = playMove(defended, 'human', x, y);
    if (!reply.error) assert.equal(reply.game.score.human, 0);
  }
});

test('a longer maximum-area contour is considered before beam pruning', () => {
  const ring = [[19,19],[20,19],[21,19],[22,19],[22,20],[22,21],[21,21],[20,21],[19,21]];
  const game = position(ring, [[20,20],[21,20]]);
  const planned = analyzeComputerMove(game);
  const result = playMove(game, 'computer', planned.move.x, planned.move.y);
  assert.equal(result.error, null);
  assert.equal(result.game.score.computer, 2);
  assert.ok(planned.stats.rootTacticalProbes > 0);
});

test('avoids entering an opposing waiting house, including a tiny-budget fallback', () => {
  const game = position([], [[10,9],[11,10],[10,11],[9,10]]);
  game.regions.push({ id: 1, side: 'human', state: 'waiting', createdMove: 1, area: 2,
    captured: [], contour: [{x:10,y:9},{x:11,y:10},{x:10,y:11},{x:9,y:10}] });
  for (const options of [{}, { simulationBudget: 1, nodeBudget: 1 }]) {
    const planned = analyzeComputerMove(game, options);
    assert.notDeepEqual(planned.move, { x: 10, y: 10 });
    const result = playMove(game, 'computer', planned.move.x, planned.move.y);
    assert.equal(result.error, null);
    assert.equal(result.game.score.human, 0);
    assert.equal(planned.stats.validated, true);
  }
});

test('inactive dots and historical human coordinates do not steer planning', () => {
  const plain = position([[21,29]], [[21,30]]);
  const decorated = structuredClone(plain);
  for (const [x,y] of [[0,0],[1,0],[0,1],[1,1],[40,58],[41,59]]) {
    decorated.points[y * decorated.width + x] = 'human'; decorated.inactive[y * decorated.width + x] = true;
  }
  decorated.moves.push({number:1,side:'human',x:0,y:0});
  assert.deepEqual(analyzeComputerMove(decorated).move, analyzeComputerMove(plain).move);
});

test('planning is deterministic and accepts deeply frozen immutable states', () => {
  const game = freeze(position([[21,29]], [[21,30]]));
  const before = JSON.stringify(game), first = analyzeComputerMove(game);
  assert.deepEqual(analyzeComputerMove(game), first);
  assert.equal(JSON.stringify(game), before);
  assert.equal(legalMove(game, first.move.x, first.move.y), null);
  assert.deepEqual(chooseComputerMove(game), first.move);
});

test('finite deterministic budgets retain a validated legal alternative', () => {
  const game = position([[21,29]], [[21,30]]);
  const result = analyzeComputerMove(game, { nodeBudget: 1, simulationBudget: 1 });
  assert.ok(result.move); assert.equal(result.stats.validated, true);
  assert.ok(result.stats.nodes <= 1); assert.ok(result.stats.simulations <= 1);
  assert.ok(result.stats.fullValidations <= 8);
  assert.equal(result.stats.budgetExhausted, true);
  assert.equal(playMove(game, 'computer', result.move.x, result.move.y).error, null);
});

test('finished, human-turn and true exhausted positions have no computer answer', () => {
  const game = createGame();
  assert.equal(chooseComputerMove(game), null);
  game.turn = 'computer'; game.phase = 'finished';
  assert.equal(chooseComputerMove(game), null);
  game.phase = 'playing'; game.points.fill('computer');
  assert.equal(chooseComputerMove(game), null);
});

test('unknown speculative geometry is not a win or false exhaustion', () => {
  const game = position([[21,29]], [[21,30]]);
  const pending = 'contour-relationship-pending';
  const result = planComputerMove(game, { legalMove,
    playMove: state => ({ game: state, error: pending }) }, { simulationBudget: 60 });
  assert.ok(result.move);
  assert.equal(result.stats.validated, false);
  assert.equal(result.stats.fallback, 'engine-pending');
  assert.equal(result.stats.completedDepth, 0);
  assert.equal(result.stats.selectedValue, null);
  assert.ok(result.stats.uncertaintyCodes[pending] > 0);
  assert.ok(result.stats.fullValidations <= 8);
  assert.equal(game.phase, 'playing');
});

test('the baseline remains available unchanged for independent comparisons', () => {
  const game = position([], [[21,30]]);
  game.moves.push({ number:1, side:'human', x:21, y:30 });
  assert.deepEqual(chooseBaselineComputerMove(game), { x:21, y:29 });
});

test('a diagnostic on the human move still preserves the atomic transaction', () => {
  const game = position([], [[0,2],[1,1],[1,3],[3,1],[4,2],[3,3]]);
  game.turn = 'human'; const before = JSON.stringify(game);
  const result = playHumanTurn(game, 2, 2);
  assert.equal(result.error, 'equal-area-contours-pending');
  assert.equal(result.game, game); assert.equal(JSON.stringify(game), before);
});

test('many forced house entries respect the full validation cap', () => {
  const game = createGame(); game.width = 8; game.height = 8; game.turn = 'computer';
  game.points = Array(64).fill(null); game.inactive = Array(64).fill(false); game.capturedBy = Array(64).fill(null);
  const contour = [];
  for(let x=0;x<7;x++) contour.push({x,y:0});
  for(let y=0;y<7;y++) contour.push({x:7,y});
  for(let x=7;x>0;x--) contour.push({x,y:7});
  for(let y=7;y>0;y--) contour.push({x:0,y});
  for(const {x,y} of contour) game.points[y*8+x]='human';
  game.regions=[{id:1,side:'human',state:'waiting',createdMove:1,area:49,captured:[],contour}];
  const result=analyzeComputerMove(game,{nodeBudget:1,simulationBudget:1});
  assert.ok(result.move); assert.equal(result.stats.validated,true);
  assert.equal(result.stats.fallback,'validated-forced-entry');
  assert.ok(result.stats.fullValidations<=8);
  const actual=playMove(game,'computer',result.move.x,result.move.y);
  assert.equal(actual.error,null); assert.equal(actual.game.score.human,1);
});
