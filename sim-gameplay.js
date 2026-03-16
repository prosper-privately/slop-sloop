(function (globalScope) {
  const DEFAULT_ROUNDING_RADIUS = 60;
  const DEFAULT_COMBO_WINDOW_SECONDS = 18;
  const DEFAULT_NO_GO_ANGLE = 35 * Math.PI / 180;

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

  const api = {
    DEFAULT_ROUNDING_RADIUS,
    DEFAULT_COMBO_WINDOW_SECONDS,
    DEFAULT_NO_GO_ANGLE,
    pointOfSail,
    playerPointFactor,
    advanceMarkRounding
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  globalScope.SimGameplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
