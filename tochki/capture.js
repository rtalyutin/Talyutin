// Exact geometry for the ordinary-capture stage of TZ 0.3.
// No pixel data, approximate winner, or arbitrary tie-breaking is used.
export class CapturePending extends Error {
  constructor(code) { super(code); this.code = code; }
}

const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const same = (a, b) => a.x === b.x && a.y === b.y;
const on = (p, a, b) => orient(a, b, p) === 0 &&
  p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) &&
  p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
const edges = p => p.map((a, i) => [a, p[(i + 1) % p.length]]);

export function segmentRelation(a, b, c, d) {
  const u = orient(a, b, c), v = orient(a, b, d);
  const s = orient(c, d, a), t = orient(c, d, b);
  if (u * v < 0 && s * t < 0) return 'cross';
  if (on(c, a, b) || on(d, a, b) || on(a, c, d) || on(b, c, d)) return 'touch';
  return 'none';
}

// Boundary is deliberately distinct from the interior: boundary dots are not captured.
export function pointLocation(point, contour) {
  let inside = false;
  for (const [a, b] of edges(contour)) {
    if (on(point, a, b)) return 'boundary';
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

export function contourArea(contour) {
  return Math.abs(edges(contour).reduce((s, [a, b]) => s + a.x * b.y - b.x * a.y, 0)) / 2;
}

export function validContour(contour) {
  if (!Array.isArray(contour) || contour.length < 3 ||
      contour.some(p => !p || !Number.isInteger(p.x) || !Number.isInteger(p.y))) return false;
  if (new Set(contour.map(p => `${p.x},${p.y}`)).size !== contour.length) return false;
  const e = edges(contour);
  if (e.some(([a, b]) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) !== 1)) return false;
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) {
    if (j === i + 1 || (i === 0 && j === e.length - 1)) continue;
    if (segmentRelation(...e[i], ...e[j]) !== 'none') return false;
  }
  return contourArea(contour) > 0;
}

const coordinates = (game, i) => ({ x: i % game.width, y: Math.floor(i / game.width) });
function interiorIndices(game, contour) {
  const minX = Math.min(...contour.map(p => p.x)), maxX = Math.max(...contour.map(p => p.x));
  const minY = Math.min(...contour.map(p => p.y)), maxY = Math.max(...contour.map(p => p.y));
  const result = [];
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (pointLocation({ x, y }, contour) === 'inside') result.push(y * game.width + x);
  }
  return result;
}

function canonical(contour) {
  const keys = contour.map(p => `${p.x},${p.y}`);
  const first = keys.reduce((a, v, i) => v < keys[a] ? i : a, 0);
  const forward = keys.map((_, i) => keys[(first + i) % keys.length]).join(';');
  const backward = keys.map((_, i) => keys[(first - i + keys.length) % keys.length]).join(';');
  return forward < backward ? forward : backward;
}

// Enumerate simple cycles containing the newly placed dot. Every new cycle
// must contain it. A resource limit reports incomplete search; it never picks
// a smaller area from an incomplete list. Large dense graphs need a later solver.
export function findNewContours(game, move, { searchBudget = 200000 } = {}) {
  if (!Number.isSafeInteger(searchBudget) || searchBudget < 1) throw new RangeError('searchBudget');
  const anchor = move.y * game.width + move.x;
  const graph = new Map();
  for (let i = 0; i < game.points.length; i++) {
    if (game.points[i] !== move.side || game.inactive?.[i]) continue;
    const { x, y } = coordinates(game, i), neighbours = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= game.width || ny >= game.height) continue;
      const n = ny * game.width + nx;
      if (game.points[n] === move.side && !game.inactive?.[n]) neighbours.push(n);
    }
    graph.set(i, neighbours);
  }
  if (!graph.has(anchor)) return [];
  // Only the connected component through the new point matters; iteratively
  // remove leaves, which cannot belong to any cycle.
  const component = new Set([anchor]), queue = [anchor];
  for (let k = 0; k < queue.length; k++) for (const n of graph.get(queue[k])) {
    if (!component.has(n)) { component.add(n); queue.push(n); }
  }
  const degrees = new Map([...component].map(i => [i, graph.get(i).filter(n => component.has(n)).length]));
  const leaves = [...component].filter(i => degrees.get(i) < 2);
  for (let k = 0; k < leaves.length; k++) {
    const i = leaves[k];
    if (!component.delete(i)) continue;
    for (const n of graph.get(i)) if (component.has(n)) {
      degrees.set(n, degrees.get(n) - 1);
      if (degrees.get(n) === 1) leaves.push(n);
    }
  }
  if (!component.has(anchor)) return [];
  const found = new Map(), path = [anchor], visited = new Set(path);
  let visits = 0;
  function walk(current) {
    if (++visits > searchBudget) throw new CapturePending('capture-search-limit');
    for (const next of graph.get(current)) {
      if (!component.has(next)) continue;
      if (next === anchor) {
        if (path.length < 3 || path[1] > path[path.length - 1]) continue;
        const contour = path.map(i => coordinates(game, i));
        if (!validContour(contour)) continue;
        const interior = interiorIndices(game, contour);
        if (interior.length) found.set(canonical(contour), { contour, interior, area: contourArea(contour) });
        continue;
      }
      if (visited.has(next)) continue;
      const a = coordinates(game, current), b = coordinates(game, next);
      let intersects = false;
      for (let k = 0; k < path.length - 2; k++) {
        if (segmentRelation(a, b, coordinates(game, path[k]), coordinates(game, path[k + 1])) !== 'none') {
          intersects = true; break;
        }
      }
      if (intersects) continue;
      visited.add(next); path.push(next); walk(next); path.pop(); visited.delete(next);
    }
  }
  walk(anchor);
  return [...found.values()];
}

function regionRelation(contour, old) {
  let touch = false;
  for (const e of edges(contour)) for (const previous of edges(old.contour)) {
    const relation = segmentRelation(...e, ...previous);
    if (relation === 'cross') return 'cross';
    if (relation === 'touch') touch = true;
  }
  if (touch) return 'touch';
  if (pointLocation(contour[0], old.contour) === 'inside' ||
      pointLocation(old.contour[0], contour) === 'inside') return 'nested';
  return 'separate';
}

export function isClosedPoint(game, x, y) {
  return (game.regions ?? []).some(region => region.state === 'active' &&
    pointLocation({ x, y }, region.contour) === 'inside');
}

// Input is the immutable state AFTER placement. Output is a new state.
// Crossing old contours is prohibited. Touch/nesting/tied maxima are explicitly
// pending in this stage, rather than silently defining the unresolved D-06 cases.
export function resolveCaptures(game, move, options = {}) {
  const regions = (game.regions ?? []).map(r => ({ ...r, captured: [...r.captured] }));
  const capturedBy = game.capturedBy?.slice() ?? Array(game.points.length).fill(null);
  const inactive = game.inactive?.slice() ?? Array(game.points.length).fill(false);
  const placed = move.y * game.width + move.x;
  const house = regions.find(r => r.side !== move.side && r.state === 'waiting' &&
    pointLocation(move, r.contour) === 'inside');
  function activate(region, interior) {
    region.state = 'active';
    for (const i of interior) {
      if (game.points[i] && game.points[i] !== region.side && !inactive[i]) {
        capturedBy[i] = region.side; inactive[i] = true; region.captured.push(i);
      }
    }
  }
  if (house) {
    activate(house, interiorIndices(game, house.contour));
  } else {
    const candidates = findNewContours(game, move, options);
    const oldKeys = new Set(regions.map(r => canonical(r.contour)));
    const acceptable = [], pending = [];
    for (const candidate of candidates) {
      if (oldKeys.has(canonical(candidate.contour))) continue;
      const relations = regions.map(r => regionRelation(candidate.contour, r));
      if (relations.includes('cross')) continue;
      if (relations.includes('touch') || relations.includes('nested')) {
        pending.push(candidate); continue;
      }
      acceptable.push(candidate);
    }
    const maxArea = Math.max(0, ...acceptable.map(c => c.area));
    if (pending.some(c => c.area >= maxArea)) throw new CapturePending('contour-relationship-pending');
    const largest = acceptable.filter(c => c.area === maxArea);
    if (largest.length > 1) throw new CapturePending('equal-area-contours-pending');
    if (largest.length) {
      const { contour, interior, area } = largest[0];
      const region = { id: game.moves.length, side: move.side, createdMove: game.moves.length,
        contour, area, captured: [], state: 'waiting' };
      if (interior.some(i => game.points[i] && game.points[i] !== move.side && !inactive[i])) {
        activate(region, interior);
      }
      regions.push(region);
    }
  }
  const score = { human: 0, computer: 0 };
  for (const owner of capturedBy) if (owner) score[owner]++;
  // The entered dot must never form a capture after it has fallen into a house.
  if (house && !inactive[placed]) throw new Error('house activation did not capture entering dot');
  return { ...game, regions, capturedBy, inactive, score };
}
