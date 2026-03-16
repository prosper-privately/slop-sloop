const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TAU,
  clamp,
  lerp,
  len,
  normalizeAngle,
  angleTo,
  normalizePositiveAngle,
  islandRadiusAtAngle,
  compassDeg
} = require('./sim-math.js');

test('clamp constrains values to bounds', () => {
  assert.equal(clamp(10, 0, 5), 5);
  assert.equal(clamp(-2, 0, 5), 0);
  assert.equal(clamp(3, 0, 5), 3);
});

test('lerp interpolates endpoints and midpoint', () => {
  assert.equal(lerp(0, 100, 0), 0);
  assert.equal(lerp(0, 100, 1), 100);
  assert.equal(lerp(0, 100, 0.25), 25);
});

test('len returns euclidean length', () => {
  assert.equal(len(3, 4), 5);
  assert.equal(len(0, 0), 0);
});

test('normalizeAngle maps values into (-PI, PI]', () => {
  const tiny = 1e-10;
  assert.ok(Math.abs(normalizeAngle(Math.PI * 3) - Math.PI) < tiny);
  assert.ok(Math.abs(normalizeAngle(-Math.PI * 3) - Math.PI) < tiny);
  const input = -Math.PI + 0.2;
  assert.ok(Math.abs(normalizeAngle(input) - input) < tiny);
});

test('angleTo computes direction between points', () => {
  assert.equal(angleTo(0, 0, 1, 0), 0);
  assert.equal(angleTo(0, 0, 0, 1), Math.PI / 2);
});

test('normalizePositiveAngle maps values into [0, TAU)', () => {
  const tiny = 1e-10;
  assert.ok(Math.abs(normalizePositiveAngle(-Math.PI / 2) - (TAU - Math.PI / 2)) < tiny);
  assert.ok(Math.abs(normalizePositiveAngle(TAU * 2 + Math.PI / 3) - Math.PI / 3) < tiny);
});

test('islandRadiusAtAngle interpolates and wraps final segment', () => {
  const island = {
    baseR: 100,
    maxR: 180,
    outline: [
      { angle: 0, radiusMul: 1 },
      { angle: Math.PI / 2, radiusMul: 2 },
      { angle: Math.PI, radiusMul: 1.5 },
      { angle: Math.PI * 1.5, radiusMul: 1 }
    ]
  };

  assert.equal(islandRadiusAtAngle(island, 0), 100);
  assert.equal(islandRadiusAtAngle(island, Math.PI / 2), 200);

  const wrappedAngle = TAU - Math.PI / 4;
  const wrappedRadius = islandRadiusAtAngle(island, wrappedAngle);
  assert.ok(Math.abs(wrappedRadius - 100) < 1e-8);
});

test('compassDeg converts radians to compass heading', () => {
  assert.equal(compassDeg(0), 90);
  assert.equal(compassDeg(Math.PI / 2), 180);
  assert.equal(compassDeg(-Math.PI / 2), 0);
});
