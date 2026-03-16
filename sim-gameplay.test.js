const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_NO_GO_ANGLE,
  pointOfSail,
  playerPointFactor,
  advanceMarkRounding
} = require('./sim-gameplay.js');

test('pointOfSail classifies key wind-angle bands', () => {
  assert.equal(pointOfSail(0.2), 'In irons');
  assert.equal(pointOfSail(0.9), 'Close hauled');
  assert.equal(pointOfSail(1.4), 'Beam reach');
  assert.equal(pointOfSail(2.1), 'Broad reach');
  assert.equal(pointOfSail(2.8), 'Run');
});

test('playerPointFactor returns expected drive multipliers by angle bucket', () => {
  assert.equal(playerPointFactor(DEFAULT_NO_GO_ANGLE - 0.001), 0);
  assert.equal(playerPointFactor(0.9), 0.65);
  assert.equal(playerPointFactor(1.2), 1.0);
  assert.equal(playerPointFactor(2.2), 0.82);
  assert.equal(playerPointFactor(2.8), 0.58);
});

test('advanceMarkRounding returns null when mark is not rounded', () => {
  const result = advanceMarkRounding({
    distanceToMark: 61,
    timer: 40,
    lastMarkTime: 20,
    combo: 2,
    markWorth: 120
  });

  assert.equal(result, null);
});

test('advanceMarkRounding increments combo within combo window', () => {
  const result = advanceMarkRounding({
    distanceToMark: 42,
    timer: 30,
    lastMarkTime: 20,
    combo: 2,
    markWorth: 150
  });

  assert.deepEqual(result, {
    combo: 3,
    gained: 450,
    lastMarkTime: 30
  });
});

test('advanceMarkRounding resets combo after combo window elapses', () => {
  const result = advanceMarkRounding({
    distanceToMark: 30,
    timer: 49,
    lastMarkTime: 30,
    combo: 4,
    markWorth: 200
  });

  assert.deepEqual(result, {
    combo: 1,
    gained: 200,
    lastMarkTime: 49
  });
});
