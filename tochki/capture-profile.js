import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { createGame } from './core.js';
import { CapturePending, findNewContours } from './capture.js';

export const DEFAULT_PROFILE_BUDGETS = [1, 8, 100, 1_000, 10_000, 200_000];

function gameWith(points) {
  const game = createGame();
  for (const [x, y] of points) game.points[y * game.width + x] = 'human';
  return game;
}

function block(size) {
  const points = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) points.push([x, y]);
  return points;
}

export function captureProfileScenarios() {
  return [
    {
      id: 'ordinary-diamond',
      game: gameWith([[1, 0], [2, 1], [1, 2], [0, 1]]),
      move: { side: 'human', x: 0, y: 1 },
    },
    {
      id: 'dense-3x3-center',
      game: gameWith(block(3)),
      move: { side: 'human', x: 1, y: 1 },
    },
    {
      id: 'dense-4x4-inner',
      game: gameWith(block(4)),
      move: { side: 'human', x: 2, y: 2 },
    },
  ];
}

function signature(contours) {
  return {
    contourCount: contours.length,
    maximumArea: Math.max(0, ...contours.map(contour => contour.area)),
  };
}

export function profileCaptureSearch({ budgets = DEFAULT_PROFILE_BUDGETS, now = performance.now.bind(performance) } = {}) {
  if (!Array.isArray(budgets) || budgets.length === 0) throw new RangeError('budgets');
  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i];
    if (!Number.isSafeInteger(budget) || budget < 1 ||
        (i > 0 && budget <= budgets[i - 1])) throw new RangeError('budgets');
  }
  return captureProfileScenarios().map(({ id, game, move }) => ({
    id,
    samples: budgets.map(searchBudget => {
      const started = now();
      try {
        const contours = findNewContours(game, move, { searchBudget });
        return { searchBudget, outcome: 'complete', ...signature(contours),
          elapsedMs: Number((now() - started).toFixed(3)) };
      } catch (error) {
        if (!(error instanceof CapturePending) || error.code !== 'capture-search-limit') throw error;
        return { searchBudget, outcome: 'capture-search-limit',
          elapsedMs: Number((now() - started).toFixed(3)) };
      }
    }),
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    board: { width: 43, height: 60 },
    note: 'Elapsed time is observational, not an acceptance threshold.',
    scenarios: profileCaptureSearch(),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
