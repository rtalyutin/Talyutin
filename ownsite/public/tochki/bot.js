// Planning is a client-side strategy. The injected engine remains the only
// authority on captures, turn order and supported geometry.
const other = side => side === 'computer' ? 'human' : 'computer';
const SCORE = 10000;
const DEFAULTS = Object.freeze({ maxDepth: 4, nodeBudget: 900, simulationBudget: 1300,
  captureSearchBudget: 2000, rootWidth: 18, replyWidth: 7 });

function settings(options) {
  const result = { ...DEFAULTS, ...options };
  for (const key of Object.keys(DEFAULTS)) {
    if (!Number.isSafeInteger(result[key]) || result[key] < 1) throw new RangeError(key);
  }
  // These are analysis controls, not game rules. Avoid accidental unbounded
  // public calls; callers can reduce every default deterministically.
  if (result.maxDepth > 8 || result.nodeBudget > 100000 || result.simulationBudget > 100000 ||
      result.captureSearchBudget > 200000 || result.rootWidth > 128 || result.replyWidth > 128) {
    throw new RangeError('search options');
  }
  return result;
}

function active(game, x, y) {
  if (x < 0 || y < 0 || x >= game.width || y >= game.height) return null;
  const i = y * game.width + x;
  return game.inactive?.[i] ? null : game.points[i];
}

function neighbours(game, x, y, side) {
  let own = 0, enemy = 0, ownOrth = 0, enemyOrth = 0, bridge = 0;
  const around = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const point = active(game, x + dx, y + dy);
    if (point === side) { own++; if (!dx || !dy) ownOrth++; around.push([dx, dy]); }
    else if (point) { enemy++; if (!dx || !dy) enemyOrth++; }
  }
  for (let i = 0; i < around.length; i++) for (let j = i + 1; j < around.length; j++) {
    if (Math.max(Math.abs(around[i][0] - around[j][0]), Math.abs(around[i][1] - around[j][1])) > 1) bridge++;
  }
  return { own, enemy, ownOrth, enemyOrth, bridge };
}

// The exact diamond pattern only orders candidates. A scored capture always
// comes from playMove, including non-diamond and maximum-area contours.
function diamondUrgency(game, x, y, side) {
  let urgency = 0;
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const cx = x + dx, cy = y + dy, victim = active(game, cx, cy);
    if (!victim) continue;
    const surround = other(victim);
    let count = 0;
    for (const [ox, oy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      if (active(game, cx + ox, cy + oy) === surround) count++;
    }
    if (count === 3) urgency += victim === side ? 1200 : 1000;
    else if (count === 2) urgency += victim === side ? 45 : 35;
  }
  return urgency;
}

function orderedCandidates(game, engine) {
  const pool = new Set();
  for (let i = 0; i < game.points.length; i++) {
    if (!game.points[i] || game.inactive?.[i]) continue;
    const px = i % game.width, py = Math.floor(i / game.width);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = px + dx, y = py + dy;
      if (x >= 0 && y >= 0 && x < game.width && y < game.height) pool.add(y * game.width + x);
    }
  }
  if (!pool.size) {
    // Opening close to the centre, derived from the current board, not history.
    for (let y = 0; y < game.height; y++) for (let x = 0; x < game.width; x++) pool.add(y * game.width + x);
  }
  const side = game.turn, candidates = [];
  for (const i of pool) {
    const x = i % game.width, y = Math.floor(i / game.width);
    if (engine.legalMove(game, x, y)) continue;
    const n = neighbours(game, x, y, side);
    const e = neighbours(game, x, y, other(side));
    const rank = diamondUrgency(game, x, y, side) + n.bridge * 9 + e.bridge * 8 +
      n.own * 5 + n.enemy * 7 + n.enemyOrth * 4 - (n.own > 5 ? 15 : 0);
    candidates.push({ x, y, rank, urgent: diamondUrgency(game, x, y, side) >= 1000, centre: Math.abs(x - (game.width - 1) / 2) + Math.abs(y - (game.height - 1) / 2) });
  }
  // Distant spare space remains available when all local points are closed.
  if (!candidates.length) {
    for (let y = 0; y < game.height; y++) for (let x = 0; x < game.width; x++) {
      if (!engine.legalMove(game, x, y)) candidates.push({ x, y, rank: 0,
        centre: Math.abs(x - (game.width - 1) / 2) + Math.abs(y - (game.height - 1) / 2) });
    }
  }
  candidates.sort((a, b) => b.rank - a.rank || a.centre - b.centre || a.y - b.y || a.x - b.x);
  return candidates;
}

function evaluate(game) {
  if (game.phase === 'finished') return game.winner === 'computer' ? 1e8 : game.winner === 'human' ? -1e8 : 0;
  let structure = 0;
  for (let i = 0; i < game.points.length; i++) {
    const side = game.points[i];
    if (!side || game.inactive?.[i]) continue;
    const x = i % game.width, y = Math.floor(i / game.width), n = neighbours(game, x, y, side);
    // Active connected dots and pressure are useful; being almost surrounded
    // is expensive. The positional term cannot outweigh one captured dot.
    const value = n.own * 3 + n.enemy * 2 - n.enemyOrth * n.enemyOrth * 12;
    structure += side === 'computer' ? value : -value;
  }
  return (game.score.computer - game.score.human) * SCORE + Math.max(-1000, Math.min(1000, structure));
}

function largestComponent(game) {
  const visited = new Set();
  let largest = 0;
  for (let i = 0; i < game.points.length; i++) {
    if (!game.points[i] || game.inactive?.[i] || visited.has(i)) continue;
    const side = game.points[i], queue = [i]; visited.add(i);
    for (let k = 0; k < queue.length; k++) {
      const x = queue[k] % game.width, y = Math.floor(queue[k] / game.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, index = ny * game.width + nx;
        if (active(game, nx, ny) !== side || visited.has(index)) continue;
        visited.add(index); queue.push(index);
      }
    }
    largest = Math.max(largest, queue.length);
  }
  return largest;
}

export function planComputerMove(game, engine, options = {}) {
  const config = settings(options);
  const componentSize = largestComponent(game);
  // Exact cycle enumeration grows sharply on dense connected graphs. Reduce
  // speculative effort there; incomplete geometry remains a diagnostic.
  if (componentSize > 24) config.captureSearchBudget = Math.min(config.captureSearchBudget, 400);
  if (componentSize > 64) {
    config.captureSearchBudget = Math.min(config.captureSearchBudget, 128);
    config.simulationBudget = Math.min(config.simulationBudget, 700);
  }
  const stats = { completedDepth: 0, nodes: 0, simulations: 0,
    nodeBudget: config.nodeBudget, simulationBudget: config.simulationBudget,
    captureSearchBudget: config.captureSearchBudget, largestComponent: componentSize,
    budgetExhausted: false, uncertainBranches: 0, uncertaintyCodes: {},
    selectedValue: null, principalVariation: [], candidateCount: 0, rootTacticalProbes: 0, fullValidations: 0,
    maxPlyReached: 0, iterationsCompleted: 0, geometryIncomplete: false,
    fallback: null, validated: false };
  if (game.phase !== 'playing' || game.turn !== 'computer') return { move: null, stats };
  const cache = new WeakMap();
  const ABORT = Symbol('budget');
  const rootCandidates = orderedCandidates(game, engine);
  stats.candidateCount = rootCandidates.length;
  if (!rootCandidates.length) return { move: null, stats };
  const rootResults = new Map();
  const tacticalBudget = Math.min(100, Math.floor(config.simulationBudget / 4));
  for (const candidate of rootCandidates) {
    for (const side of ['human', 'computer']) {
      if (stats.rootTacticalProbes >= tacticalBudget) break;
      if (neighbours(game, candidate.x, candidate.y, side).own < 2) continue;
      stats.rootTacticalProbes++; stats.simulations++;
      const state = side === game.turn ? game : { ...game, turn: side };
      const result = engine.playMove(state, side, candidate.x, candidate.y,
        { searchBudget: config.captureSearchBudget });
      if (side === 'computer') rootResults.set(`${candidate.x},${candidate.y}`, result);
      if (result.error) {
        stats.uncertainBranches++;
        stats.uncertaintyCodes[result.error] = (stats.uncertaintyCodes[result.error] ?? 0) + 1;
        continue;
      }
      const gain = result.game.score[side] - game.score[side];
      if (gain > 0) { candidate.urgent = true; candidate.rank += gain * 100000; }
    }
  }
  rootCandidates.sort((a, b) => b.rank - a.rank || a.centre - b.centre || a.y - b.y || a.x - b.x);

  function children(state) {
    const root = state === game;
    if (cache.has(state)) return cache.get(state);
    const candidates = root ? rootCandidates : orderedCandidates(state, engine);
    const width = root ? config.rootWidth : config.replyWidth;
    const probe = Math.min(candidates.length, width * 2);
    const result = [];
    let unknown = false;
    const probed = candidates.slice(0, probe);
    for (const candidate of candidates) if (candidate.urgent && !probed.includes(candidate)) probed.push(candidate);
    for (const move of probed) {
      if (stats.simulations >= config.simulationBudget) { stats.budgetExhausted = true; throw ABORT; }
      const existing = root && rootResults.get(`${move.x},${move.y}`);
      if (!existing) stats.simulations++;
      const played = existing || engine.playMove(state, state.turn, move.x, move.y,
        { searchBudget: config.captureSearchBudget });
      if (root) rootResults.set(`${move.x},${move.y}`, played);
      if (played.error) {
        unknown = true; if (!existing) stats.uncertainBranches++;
        if (!existing) stats.uncertaintyCodes[played.error] = (stats.uncertaintyCodes[played.error] ?? 0) + 1;
        continue;
      }
      result.push({ move: { x: move.x, y: move.y }, game: played.game, value: evaluate(played.game), urgent: move.urgent });
    }
    const direction = state.turn === 'computer' ? -1 : 1;
    result.sort((a, b) => direction * (a.value - b.value));
    const selected = result.slice(0, width);
    for (const child of result) if (child.urgent && !selected.includes(child)) selected.push(child);
    const stored = { list: selected, unknown };
    cache.set(state, stored);
    return stored;
  }

  let iterationDepth = 0;
  function search(state, depth, alpha, beta) {
    if (stats.nodes >= config.nodeBudget) { stats.budgetExhausted = true; throw ABORT; }
    stats.nodes++;
    stats.maxPlyReached = Math.max(stats.maxPlyReached, iterationDepth - depth);
    if (depth === 0 || state.phase !== 'playing') return { value: evaluate(state), pv: [], uncertain: false };
    const { list, unknown } = children(state);
    // A diagnostic is missing engine coverage, never a loss/no-move/win. Keep
    // it as an uncertain static leaf and don't award imaginary capture points.
    if (!list.length) return { value: evaluate(state), pv: [], uncertain: true };
    const maximizing = state.turn === 'computer';
    let best = { value: maximizing ? -Infinity : Infinity, pv: [], uncertain: unknown };
    for (const child of list) {
      const reply = search(child.game, depth - 1, alpha, beta);
      if (maximizing ? reply.value > best.value : reply.value < best.value) {
        best = { value: reply.value, pv: [{ side: state.turn, ...child.move }, ...reply.pv], uncertain: unknown || reply.uncertain };
      }
      if (maximizing) alpha = Math.max(alpha, best.value); else beta = Math.min(beta, best.value);
      if (beta <= alpha) break;
    }
    // Unknown opponent responses cannot certify a forced win. Restrict any
    // improvement to the current static value until engine coverage exists.
    if (unknown && !maximizing) best.value = Math.min(best.value, evaluate(state));
    return best;
  }

  let selected = null;
  for (let depth = 1; depth <= config.maxDepth; depth++) {
    try {
      iterationDepth = depth;
      const result = search(game, depth, -Infinity, Infinity);
      if (result.pv.length) {
        selected = result.pv[0]; stats.completedDepth = Math.min(depth, result.pv.length);
        stats.iterationsCompleted = depth;
        stats.selectedValue = result.value; stats.principalVariation = result.pv;
      }
    } catch (error) {
      if (error !== ABORT) throw error;
      break; // Retain the last completed iteration, not its partial successor.
    }
  }

  stats.geometryIncomplete = stats.uncertainBranches > 0;
  // Normal production geometry budget: speculative truncation never validates
  // a real move or changes an engine rule. Check alternatives if needed.
  const alternatives = selected ? [selected, ...rootCandidates] : rootCandidates;
  const checked = new Set();
  let forcedEntry = null;
  for (const candidate of alternatives) {
    if (stats.fullValidations >= 4) break;
    const key = `${candidate.x},${candidate.y}`;
    if (checked.has(key) || rootResults.get(key)?.error) continue;
    checked.add(key);
    stats.fullValidations++;
    const played = engine.playMove(game, 'computer', candidate.x, candidate.y);
    if (!played.error) {
      const move = { x: candidate.x, y: candidate.y };
      if (played.game.inactive?.[candidate.y * game.width + candidate.x]) {
        forcedEntry ??= { move, game: played.game }; continue;
      }
      stats.validated = true;
      if (!selected || move.x !== selected.x || move.y !== selected.y) {
        stats.fallback = 'validated-alternative'; stats.principalVariation = [{ side: 'computer', ...move }];
        stats.selectedValue = evaluate(played.game);
      }
      return { move, stats };
    }
    // Limit expensive full-budget retries, then try disconnected spare space.
    if (checked.size >= 4) break;
  }
  spareSpace: for (let y = 0; y < game.height; y++) for (let x = 0; x < game.width; x++) {
    if (engine.legalMove(game, x, y) || checked.has(`${x},${y}`)) continue;
    const n = neighbours(game, x, y, 'computer');
    if (n.own) continue;
    if (stats.fullValidations >= 8) break spareSpace;
    stats.fullValidations++;
    const played = engine.playMove(game, 'computer', x, y);
    if (!played.error) {
      if (played.game.inactive?.[y * game.width + x]) {
        forcedEntry ??= { move: { x, y }, game: played.game }; continue;
      }
      stats.validated = true; stats.fallback = 'validated-spare-space';
      stats.principalVariation = [{ side: 'computer', x, y }]; stats.selectedValue = evaluate(played.game);
      return { move: { x, y }, stats };
    }
  }
  if (forcedEntry) {
    stats.validated = true; stats.fallback = 'validated-forced-entry';
    stats.principalVariation = [{ side: 'computer', ...forcedEntry.move }]; stats.selectedValue = evaluate(forcedEntry.game);
    return { move: forcedEntry.move, stats };
  }
  // Legal coordinates can still be pending in this prototype. Returning them
  // lets the existing atomic transaction expose the diagnostic; null would
  // falsely announce exhaustion. No partial computer/human move is committed.
  stats.fallback = 'engine-pending';
  const first = rootCandidates[0];
  return { move: { x: first.x, y: first.y }, stats };
}
