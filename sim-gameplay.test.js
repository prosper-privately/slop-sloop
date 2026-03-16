const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_NO_GO_ANGLE,
  pointOfSail,
  playerPointFactor,
  advanceMarkRounding,
  computeSailingStep
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


test('computeSailingStep produces stronger surge when trim is near best sail', () => {
  const poorlyTrimmed = computeSailingStep({
    heading: 0,
    sail: 0.2,
    speed: 2,
    apparentWindDir: 1.2,
    apparentWindSpeed: 12,
    absWindAngle: 1.2,
    rudder: 0.1
  });

  const wellTrimmed = computeSailingStep({
    heading: 0,
    sail: poorlyTrimmed.bestSail,
    speed: 2,
    apparentWindDir: 1.2,
    apparentWindSpeed: 12,
    absWindAngle: 1.2,
    rudder: 0.1
  });

  assert.ok(wellTrimmed.trimEfficiency > poorlyTrimmed.trimEfficiency);
  assert.ok(wellTrimmed.surge > poorlyTrimmed.surge);
});

test('computeSailingStep strongly reduces surge in irons', () => {
  const inIrons = computeSailingStep({
    heading: 0,
    sail: 0.3,
    speed: 1,
    apparentWindDir: 0.12,
    apparentWindSpeed: 11,
    absWindAngle: 0.12,
    rudder: 0
  });

  const reaching = computeSailingStep({
    heading: 0,
    sail: 0.75,
    speed: 1,
    apparentWindDir: 1.1,
    apparentWindSpeed: 11,
    absWindAngle: 1.1,
    rudder: 0
  });

  assert.equal(inIrons.inIrons, true);
  assert.ok(inIrons.surge < reaching.surge * 0.3);
});

test('computeSailingStep scales turn rate with rudder direction and speed', () => {
  const leftTurn = computeSailingStep({
    heading: 0,
    sail: 0.7,
    speed: 4,
    apparentWindDir: 1,
    apparentWindSpeed: 13,
    absWindAngle: 1,
    rudder: -0.5
  });
  const rightTurn = computeSailingStep({
    heading: 0,
    sail: 0.7,
    speed: 4,
    apparentWindDir: 1,
    apparentWindSpeed: 13,
    absWindAngle: 1,
    rudder: 0.5
  });

  assert.ok(leftTurn.turnRate < 0);
  assert.ok(rightTurn.turnRate > 0);
  assert.ok(Math.abs(rightTurn.turnRate) > Math.abs(computeSailingStep({
    heading: 0,
    sail: 0.7,
    speed: 0.2,
    apparentWindDir: 1,
    apparentWindSpeed: 13,
    absWindAngle: 1,
    rudder: 0.5
  }).turnRate));
});
