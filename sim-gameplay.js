(function (globalScope) {
  const DEFAULT_ROUNDING_RADIUS = 60;
  const DEFAULT_COMBO_WINDOW_SECONDS = 18;
  const DEFAULT_NO_GO_ANGLE = 35 * Math.PI / 180;
  const DEFAULT_SAIL_SETTINGS = {
    noGoAngle: DEFAULT_NO_GO_ANGLE,
    sailCenterBias: 0.08,
    sailAngleGain: 0.74,
    maxSailAngle: 1.22,
    trimWindow: 0.34,
    closeHauledTrimPenalty: 1.2,
    maxHeel: 32,
    heelResponse: 1.6,
    keelGrip: 0.9,
    hullDrag: 0.2,
    speedDrag: 0.013,
    heelDrag: 0.012,
    surgeScale: 0.082,
    sideForceScale: 0.14,
    rudderGrip: 0.22,
    inIronsDrive: 0.12
  };

  function pointOfSail(absWindAngle) {
    const degs = absWindAngle * 180 / Math.PI;
    if (degs < 35) return 'In irons';
    if (degs < 60) return 'Close hauled';
    if (degs < 100) return 'Beam reach';
    if (degs < 145) return 'Broad reach';
    return 'Run';
  }

  function playerPointFactor(absWindAngle, noGoAngle = DEFAULT_NO_GO_ANGLE) {
    if (absWindAngle < noGoAngle) return 0;
    if (absWindAngle < Math.PI / 3) return 0.65;
    if (absWindAngle < Math.PI / 2) return 1.0;
    if (absWindAngle < 2.5) return 0.82;
    return 0.58;
  }

  function advanceMarkRounding({
    distanceToMark,
    timer,
    lastMarkTime,
    combo,
    markWorth,
    roundingRadius = DEFAULT_ROUNDING_RADIUS,
    comboWindowSeconds = DEFAULT_COMBO_WINDOW_SECONDS
  }) {
    if (distanceToMark >= roundingRadius) {
      return null;
    }

    const elapsed = timer - lastMarkTime;
    const nextCombo = elapsed < comboWindowSeconds ? combo + 1 : 1;
    const gained = markWorth * nextCombo;
    return {
      combo: nextCombo,
      gained,
      lastMarkTime: timer
    };
  }

  function sailForces({
    apparentWindDir,
    apparentWindSpeed,
    heading,
    sail,
    speed,
    trimEfficiency,
    absWindAngle,
    inIrons,
    settings = {}
  }) {
    const config = { ...DEFAULT_SAIL_SETTINGS, ...settings };
    const sailSide = apparentWindDir >= heading ? 1 : -1;
    const sailAngle = heading + sailSide * sail;
    const angleOfAttack = Math.abs(normalizeSigned(apparentWindDir - sailAngle));
    const effectiveAoa = Math.min(Math.PI / 2, Math.max(0.06, angleOfAttack));
    const liftCoeff = Math.sin(effectiveAoa * 2);
    const dragCoeff = 0.2 + (1 - Math.cos(effectiveAoa));
    const dynamicPressure = apparentWindSpeed * apparentWindSpeed;
    const driveBase = dynamicPressure * (liftCoeff * 0.8 + dragCoeff * 0.2);
    const windSlotEfficiency = Math.sin(Math.min(Math.PI, absWindAngle));
    const inIronsPenalty = inIrons ? config.inIronsDrive : 1;
    const surge = driveBase * windSlotEfficiency * trimEfficiency * config.surgeScale * inIronsPenalty;
    const sideForce = dynamicPressure * Math.sin(effectiveAoa) * trimEfficiency * config.sideForceScale;
    const drag = config.hullDrag + speed * config.speedDrag;
    return { surge, sideForce, drag };
  }

  function normalizeSigned(a) {
    const tau = Math.PI * 2;
    let out = a;
    while (out <= -Math.PI) out += tau;
    while (out > Math.PI) out -= tau;
    return out;
  }

  function computeSailingStep({
    heading,
    sail,
    speed,
    apparentWindDir,
    apparentWindSpeed,
    absWindAngle,
    rudder,
    settings = {}
  }) {
    const config = { ...DEFAULT_SAIL_SETTINGS, ...settings };
    const bestSail = Math.min(config.maxSailAngle, absWindAngle * config.sailAngleGain + config.sailCenterBias);
    const trimError = Math.abs(bestSail - sail);
    const closeHauledPenalty = absWindAngle < Math.PI / 3 ? config.closeHauledTrimPenalty : 1;
    const trimEfficiency = Math.max(0, Math.min(1, 1 - (trimError / config.trimWindow) * closeHauledPenalty));
    const inIrons = absWindAngle < config.noGoAngle;
    const { surge, sideForce, drag: baseDrag } = sailForces({
      apparentWindDir,
      apparentWindSpeed,
      heading,
      sail,
      speed,
      trimEfficiency,
      absWindAngle,
      inIrons,
      settings: config
    });

    const leeway = sideForce * (1 - Math.min(0.95, config.keelGrip * (0.35 + speed * 0.04)));
    const heelTarget = Math.min(config.maxHeel, sideForce * 1.8);
    const drag = baseDrag + Math.max(0, heelTarget - 16) * config.heelDrag;
    const turnRate = rudder * Math.max(0.22, Math.min(1.25, config.rudderGrip + speed * 0.02));

    return {
      inIrons,
      bestSail,
      trimEfficiency,
      surge,
      leeway,
      heelTarget,
      drag,
      turnRate,
      heelResponse: config.heelResponse
    };
  }

  function applySailingStep({
    heading,
    vx,
    vy,
    trueWindRel,
    sailStep,
    dt
  }) {
    const nextHeading = normalizeSigned(heading + sailStep.turnRate * dt);
    let nextVx = vx + Math.cos(nextHeading) * sailStep.surge * dt;
    let nextVy = vy + Math.sin(nextHeading) * sailStep.surge * dt;

    const leewayDir = Math.sign(Math.sin(trueWindRel)) || 1;
    nextVx += Math.cos(nextHeading + Math.PI / 2 * leewayDir) * sailStep.leeway * dt;
    nextVy += Math.sin(nextHeading + Math.PI / 2 * leewayDir) * sailStep.leeway * dt;

    const dragFactor = Math.max(0, 1 - sailStep.drag * dt);
    nextVx *= dragFactor;
    nextVy *= dragFactor;

    return {
      heading: nextHeading,
      vx: nextVx,
      vy: nextVy
    };
  }

  function computeAndApplySailingStep({
    heading,
    sail,
    speed,
    apparentWindDir,
    apparentWindSpeed,
    absWindAngle,
    trueWindRel,
    rudder,
    vx,
    vy,
    dt,
    settings = {}
  }) {
    const sailStep = computeSailingStep({
      heading,
      sail,
      speed,
      apparentWindDir,
      apparentWindSpeed,
      absWindAngle,
      rudder,
      settings
    });
    const motion = applySailingStep({ heading, vx, vy, trueWindRel, sailStep, dt });
    return { sailStep, motion };
  }

  const api = {
    DEFAULT_ROUNDING_RADIUS,
    DEFAULT_COMBO_WINDOW_SECONDS,
    DEFAULT_NO_GO_ANGLE,
    DEFAULT_SAIL_SETTINGS,
    pointOfSail,
    playerPointFactor,
    advanceMarkRounding,
    computeSailingStep,
    applySailingStep,
    computeAndApplySailingStep
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  globalScope.SimGameplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
