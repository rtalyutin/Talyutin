// Exact arithmetic for the D-05 sufficient condition. This module deliberately
// does not decide which captured dots are liberatable: that classification
// depends on the still-open D-06 nesting rules.

const sides = ['human', 'computer'];

function count(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name);
  return value;
}

export function evaluateSafeLead({
  leader,
  trailing,
  leaderScore,
  trailingScore,
  unscoredLeaderPoints,
  emptyIntersections,
  liberatableTrailingPoints,
}) {
  if (!sides.includes(leader) || !sides.includes(trailing) || leader === trailing) {
    throw new RangeError('sides');
  }
  const safeLeaderScore = count(leaderScore, 'leaderScore');
  const safeTrailingScore = count(trailingScore, 'trailingScore');
  const safeUnscored = count(unscoredLeaderPoints, 'unscoredLeaderPoints');
  const safeEmpty = count(emptyIntersections, 'emptyIntersections');
  const safeLiberatable = count(liberatableTrailingPoints, 'liberatableTrailingPoints');
  const upperBound = safeTrailingScore + safeUnscored + safeEmpty;
  if (!Number.isSafeInteger(upperBound)) throw new RangeError('upperBound');
  if (safeLiberatable > safeLeaderScore) throw new RangeError('liberatableTrailingPoints');
  const lowerBound = safeLeaderScore - safeLiberatable;
  return {
    leader,
    trailing,
    upperBound,
    lowerBound,
    proven: upperBound < lowerBound,
  };
}

// A conservative snapshot provides every term except C_T. All empty board
// intersections are counted, including those inside closed regions, exactly as
// required by TZ 0.3. Integration must supply C_T only after D-06 can classify
// potentially liberatable captured dots without guessing.
export function prepareSafeLeadSnapshot(game) {
  const humanScore = count(game.score?.human, 'humanScore');
  const computerScore = count(game.score?.computer, 'computerScore');
  if (humanScore === computerScore) return null;
  const leader = humanScore > computerScore ? 'human' : 'computer';
  const trailing = leader === 'human' ? 'computer' : 'human';
  let unscoredLeaderPoints = 0;
  let emptyIntersections = 0;
  for (let i = 0; i < game.points.length; i++) {
    const owner = game.points[i];
    if (owner === null) emptyIntersections++;
    if (owner === leader && game.capturedBy?.[i] !== trailing) unscoredLeaderPoints++;
  }
  return {
    leader,
    trailing,
    leaderScore: game.score[leader],
    trailingScore: game.score[trailing],
    unscoredLeaderPoints,
    emptyIntersections,
  };
}
