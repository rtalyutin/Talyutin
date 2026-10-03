import { CapturePending, isClosedPoint, resolveCaptures } from './capture.js';
import { planComputerMove } from './bot.js';
// Prototype stage 2: ordinary captures and houses. D-06 diagnostics are
// explicit errors; this is not yet a complete implementation of all positions.
export const WIDTH = 43;
export const HEIGHT = 60;

export function createGame() {
  return {
    width: WIDTH,
    height: HEIGHT,
    phase: 'playing',
    turn: 'human',
    winner: null,
    moves: [],
    points: Array(WIDTH * HEIGHT).fill(null),
    score: { human: 0, computer: 0 },
    regions: [],
    capturedBy: Array(WIDTH * HEIGHT).fill(null),
    inactive: Array(WIDTH * HEIGHT).fill(false),
  };
}

const index = (game, x, y) => y * game.width + x;

export function legalMove(game, x, y) {
  if (game.phase !== 'playing') return 'finished';
  if (!Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || y < 0 || x >= game.width || y >= game.height) return 'outside';
  if (game.points[index(game, x, y)] !== null) return 'occupied';
  if (isClosedPoint(game, x, y)) return 'closed-zone';
  return null;
}

// One side's transactional move, also used by deterministic engine scenarios.
export function playMove(game, side, x, y, options = {}) {
  if (game.phase !== 'playing') return { game, error: 'finished' };
  if ((side !== 'human' && side !== 'computer') || side !== game.turn) return { game, error: 'not-your-turn' };
  const error = legalMove(game, x, y);
  if (error) return { game, error };
  try {
    const points = game.points.slice();
    points[index(game, x, y)] = side;
    const moves = [...game.moves, { number: game.moves.length + 1, side, x, y }];
    const next = resolveCaptures({ ...game, points, moves,
      turn: side === 'human' ? 'computer' : 'human' }, moves[moves.length - 1], options);
    // Capture can close the last empty points; exhaustion is checked after
    // either side's move, not only before the computer replies.
    const hasMove = next.points.some((point, i) => point === null &&
      !isClosedPoint(next, i % next.width, Math.floor(i / next.width)));
    const completed = hasMove ? next : { ...next, phase: 'finished', turn: null,
      winner: next.score.human === next.score.computer ? 'draw' :
        next.score.human > next.score.computer ? 'human' : 'computer' };
    return { game: completed, error: null };
  } catch (error) {
    if (error instanceof CapturePending) return { game, error: error.code };
    throw error;
  }
}

// A deterministic, reproducible baseline opponent. This is a legal-move
// selector, not the eventual strategic difficulty setting.
export function chooseBaselineComputerMove(game) {
  if (game.phase !== 'playing' || game.turn !== 'computer') return null;
  const human = game.moves.filter(move => move.side === 'human');
  let best = null;
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) {
      if (legalMove(game, x, y)) continue;
      const distance = human.length
        ? Math.min(...human.map(move => Math.max(Math.abs(x - move.x), Math.abs(y - move.y))))
        : 0;
      const rank = [distance, Math.abs(x - (game.width - 1) / 2) +
        Math.abs(y - (game.height - 1) / 2), y, x];
      if (!best || rank.some((value, i) => value !== best.rank[i] &&
          rank.slice(0, i).every((v, j) => v === best.rank[j]) && value < best.rank[i])) {
        best = { x, y, rank };
      }
    }
  }
  return best && { x: best.x, y: best.y };
}

// Strategy changes only move choice; all simulated and real actions use this
// same transactional rules engine. No circular module import is needed.
export function analyzeComputerMove(game, options = {}) {
  return planComputerMove(game, { legalMove, playMove }, options);
}

export function chooseComputerMove(game) {
  return analyzeComputerMove(game).move;
}

export function playHumanTurn(game, x, y) {
  if (game.phase !== 'playing') return { game, error: 'finished' };
  if (game.turn !== 'human') return { game, error: 'not-your-turn' };
  const error = legalMove(game, x, y);
  if (error) return { game, error };
  const humanResult = playMove(game, 'human', x, y);
  if (humanResult.error) return humanResult;
  const afterHuman = humanResult.game;
  const computerMove = chooseComputerMove(afterHuman);
  if (!computerMove) return { game: { ...afterHuman, phase: 'finished', turn: null,
    winner: afterHuman.score.human === afterHuman.score.computer ? 'draw' :
      afterHuman.score.human > afterHuman.score.computer ? 'human' : 'computer' }, error: null };
  const computerResult = playMove(afterHuman, 'computer', computerMove.x, computerMove.y);
  // The public two-move action remains atomic even when geometry is pending.
  return computerResult.error ? { game, error: computerResult.error } : computerResult;
}

export function resign(game) {
  if (game.phase !== 'playing') return { game, error: 'finished' };
  return { game: { ...game, phase: 'finished', turn: null, winner: 'computer' }, error: null };
}
