const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_NO_GO_ANGLE,
  pointOfSail,
  playerPointFactor,
  advanceMarkRounding,
  computeSailingStep,
  applySailingStep,
  computeAndApplySailingStep
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


test('applySailingStep updates heading and damps velocity with drag', () => {
  const result = applySailingStep({
    heading: 0,
    vx: 1,
    vy: 0,
    trueWindRel: 1,
    sailStep: {
      turnRate: 0.5,
      surge: 2,
      leeway: 1,
      drag: 0.4
    },
    dt: 0.2
  });

  assert.ok(result.heading > 0.09 && result.heading < 0.11);
  assert.ok(result.vx > 1);
  assert.ok(result.vy > 0);
});

test('computeAndApplySailingStep produces forward motion from standstill on a reach', () => {
  let state = {
    heading: 0.6,
    sail: 0.75,
    vx: 0,
    vy: 0,
    rudder: 0,
    absWindAngle: 1.05,
    apparentWindDir: 1.65,
    apparentWindSpeed: 12,
    trueWindRel: 1.05
  };

  for (let i = 0; i < 60; i++) {
    const speed = Math.hypot(state.vx, state.vy);
    const { sailStep, motion } = computeAndApplySailingStep({
      heading: state.heading,
      sail: state.sail,
      speed,
      apparentWindDir: state.apparentWindDir,
      apparentWindSpeed: state.apparentWindSpeed,
      absWindAngle: state.absWindAngle,
      trueWindRel: state.trueWindRel,
      rudder: state.rudder,
      vx: state.vx,
      vy: state.vy,
      dt: 0.1,
      settings: {
        surgeScale: 0.082,
        sideForceScale: 0.14,
        keelGrip: 0.92,
        hullDrag: 0.2,
        speedDrag: 0.013,
        heelDrag: 0.012,
        rudderGrip: 0.22,
        inIronsDrive: 0.12
      }
    });

    state.heading = motion.heading;
    state.vx = motion.vx;
    state.vy = motion.vy;
    state.sail = sailStep.bestSail;
  }

  assert.ok(Math.hypot(state.vx, state.vy) > 1.5);
});

test('AI and player sailing settings both maintain motion in steady wind', () => {
  const runModel = (settings) => {
    let heading = 0.4;
    let sail = 0.6;
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < 80; i++) {
      const absWindAngle = 1.2;
      const apparentWindDir = heading + absWindAngle;
      const trueWindRel = absWindAngle;
      const speed = Math.hypot(vx, vy);
      const { sailStep, motion } = computeAndApplySailingStep({
        heading,
        sail,
        speed,
        apparentWindDir,
        apparentWindSpeed: 11.5,
        absWindAngle,
        trueWindRel,
        rudder: 0.05,
        vx,
        vy,
        dt: 0.1,
        settings
      });
      heading = motion.heading;
      vx = motion.vx;
      vy = motion.vy;
      sail = sailStep.bestSail;
    }
    return Math.hypot(vx, vy);
  };

  const playerSpeed = runModel({
    surgeScale: 0.082,
    sideForceScale: 0.14,
    keelGrip: 0.92,
    hullDrag: 0.2,
    speedDrag: 0.013,
    heelDrag: 0.012,
    rudderGrip: 0.22,
    inIronsDrive: 0.12
  });

  const aiSpeed = runModel({
    surgeScale: 0.074,
    sideForceScale: 0.13,
    keelGrip: 0.88,
    hullDrag: 0.22,
    speedDrag: 0.014,
    heelDrag: 0.011,
    rudderGrip: 0.2,
    inIronsDrive: 0.11
  });

  assert.ok(playerSpeed > 1.3, `player speed too low: ${playerSpeed}`);
  assert.ok(aiSpeed > 1.0, `ai speed too low: ${aiSpeed}`);
});


test('computeSailingStep retains meaningful downwind surge (run does not stall)', () => {
  const beamReach = computeSailingStep({
    heading: 0,
    sail: 0.95,
    speed: 1,
    apparentWindDir: Math.PI / 2,
    apparentWindSpeed: 12,
    absWindAngle: Math.PI / 2,
    rudder: 0
  });

  const deadRun = computeSailingStep({
    heading: 0,
    sail: 1.15,
    speed: 1,
    apparentWindDir: Math.PI,
    apparentWindSpeed: 12,
    absWindAngle: Math.PI,
    rudder: 0
  });

  assert.ok(deadRun.surge > 0.2, `downwind surge too low: ${deadRun.surge}`);
  assert.ok(deadRun.surge < beamReach.surge, 'run should be slower than beam reach');
});

test('computeAndApplySailingStep accelerates boat from standstill on dead run', () => {
  let heading = 0;
  let sail = 1.1;
  let vx = 0;
  let vy = 0;

  for (let i = 0; i < 100; i++) {
    const speed = Math.hypot(vx, vy);
    const absWindAngle = Math.PI;
    const apparentWindDir = heading + Math.PI;
    const { sailStep, motion } = computeAndApplySailingStep({
      heading,
      sail,
      speed,
      apparentWindDir,
      apparentWindSpeed: 11,
      absWindAngle,
      trueWindRel: Math.PI,
      rudder: 0,
      vx,
      vy,
      dt: 0.1
    });

    heading = motion.heading;
    vx = motion.vx;
    vy = motion.vy;
    sail = sailStep.bestSail;
  }

  assert.ok(Math.hypot(vx, vy) > 0.8, `dead run failed to build speed: ${Math.hypot(vx, vy)}`);
});
