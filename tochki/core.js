// Pure game state for the first playable turn. Capture resolution follows in
// the next stage; callers must keep the board marked as a prototype until then.
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
  };
}

const index = (game, x, y) => y * game.width + x;

export function legalMove(game, x, y) {
  if (game.phase !== 'playing') return 'finished';
  if (!Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || y < 0 || x >= game.width || y >= game.height) return 'outside';
  if (game.points[index(game, x, y)] !== null) return 'occupied';
  return null;
}

function place(game, side, x, y) {
  const points = game.points.slice();
  points[index(game, x, y)] = side;
  const moves = [...game.moves, { number: game.moves.length + 1, side, x, y }];
  return { ...game, points, moves, turn: side === 'human' ? 'computer' : 'human' };
}

// A deterministic, reproducible baseline opponent. This is a legal-move
// selector, not the eventual strategic difficulty setting.
export function chooseComputerMove(game) {
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

export function playHumanTurn(game, x, y) {
  if (game.phase !== 'playing') return { game, error: 'finished' };
  if (game.turn !== 'human') return { game, error: 'not-your-turn' };
  const error = legalMove(game, x, y);
  if (error) return { game, error };
  const afterHuman = place(game, 'human', x, y);
  const computerMove = chooseComputerMove(afterHuman);
  if (!computerMove) return { game: { ...afterHuman, phase: 'finished', turn: null,
    winner: 'draw' }, error: null };
  return { game: place(afterHuman, 'computer', computerMove.x, computerMove.y), error: null };
}

export function resign(game) {
  if (game.phase !== 'playing') return { game, error: 'finished' };
  return { game: { ...game, phase: 'finished', turn: null, winner: 'computer' }, error: null };
}
