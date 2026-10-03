import test from 'node:test';
import assert from 'node:assert/strict';
import { profileCaptureSearch } from './capture-profile.js';

test('capture profile records deterministic outcomes without a wall-clock gate', () => {
  let clock = 0;
  const profiles = profileCaptureSearch({ budgets: [1, 8, 100, 1_000], now: () => clock++ });
  assert.deepEqual(profiles.map(profile => profile.id), [
    'ordinary-diamond', 'dense-3x3-center', 'dense-4x4-inner',
  ]);
  const ordinary = profiles[0].samples.find(sample => sample.searchBudget === 8);
  assert.deepEqual(ordinary, {
    searchBudget: 8,
    outcome: 'complete',
    contourCount: 1,
    maximumArea: 2,
    elapsedMs: 1,
  });
  for (const profile of profiles) for (const sample of profile.samples) {
    assert.ok(sample.outcome === 'complete' || sample.outcome === 'capture-search-limit');
    assert.equal(sample.elapsedMs, 1);
  }
});

test('invalid budget ladders are rejected', () => {
  assert.throws(() => profileCaptureSearch({ budgets: [] }), /budgets/);
  assert.throws(() => profileCaptureSearch({ budgets: [8, 8] }), /budgets/);
  assert.throws(() => profileCaptureSearch({ budgets: [1, 0] }), /budgets/);
  const sparse = [1];
  sparse[2] = 8;
  assert.throws(() => profileCaptureSearch({ budgets: sparse }), /budgets/);
});
