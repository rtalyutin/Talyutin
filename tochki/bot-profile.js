import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { createGame, playMove, analyzeComputerMove } from './core.js';

// Full 43x60 state in every scenario. Dense states are deliberately constructed
// stress fixtures, not a claim that normal play already resolves these graphs.
export function planningProfileScenarios() {
  const opening = playMove(createGame(), 'human', 21, 30).game;
  const mid = createGame(); mid.turn = 'computer';
  for (let y = 10; y < 18; y++) for (let x = 10; x < 18; x++) {
    if ((x + y) % 3 === 0) mid.points[y * mid.width + x] = (x * 7 + y) % 3 === 0 ? 'computer' : 'human';
  }
  const scenarios = [{ id: 'opening-actual-human-move', game: opening }, { id: 'constructed-mid-21-dots', game: mid }];
  for (const size of [3, 4, 5, 6, 10]) {
    const game = createGame(); game.turn = 'computer';
    for (let y = 10; y < 10 + size; y++) for (let x = 10; x < 10 + size; x++) game.points[y * game.width + x] = 'computer';
    game.points[9 * game.width + 11] = 'human';
    scenarios.push({ id: `constructed-dense-${size}x${size}`, game });
  }
  return scenarios;
}

export function profilePlanning({ repeats = 3 } = {}) {
  if (!Number.isSafeInteger(repeats) || repeats < 1 || repeats > 10) throw new RangeError('repeats');
  return planningProfileScenarios().map(({ id, game }) => ({
    id, board: { width: game.width, height: game.height }, activeDots: game.points.filter(Boolean).length,
    samples: Array.from({ length: repeats }, () => {
      const started = performance.now();
      const result = analyzeComputerMove(game);
      const elapsedMs = Number((performance.now() - started).toFixed(3));
      const validated = result.move ? playMove(game, 'computer', result.move.x, result.move.y) : null;
      return { elapsedMs, ...result, validationError: validated?.error ?? null };
    }),
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version,
    note: 'Measured Node time only; no portable/mobile latency claim. Geometry-incomplete stress fixtures can end at static leaves before the nominal iteration depth.',
    scenarios: profilePlanning() }, null, 2)}\n`);
}
