(function (globalScope) {
  const TAU = Math.PI * 2;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const len = (x, y) => Math.hypot(x, y);

  function normalizeAngle(a) {
    while (a <= -Math.PI) a += TAU;
    while (a > Math.PI) a -= TAU;
    return a;
  }

  function angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  function normalizePositiveAngle(a) {
    let out = a % TAU;
    if (out < 0) out += TAU;
    return out;
  }

  function islandRadiusAtAngle(island, angle) {
    const a = normalizePositiveAngle(angle);
    const points = island.outline;
    for (let i = 0; i < points.length; i++) {
      const p0 = points[i];
      const p1 = points[(i + 1) % points.length];
      const a0 = p0.angle;
      const a1 = i === points.length - 1 ? p1.angle + TAU : p1.angle;
      const sample = (i === points.length - 1 && a < a0) ? a + TAU : a;
      if (sample >= a0 && sample <= a1) {
        const t = (sample - a0) / Math.max(0.0001, (a1 - a0));
        const mul = lerp(p0.radiusMul, p1.radiusMul, t);
        return island.baseR * mul;
      }
    }
    return island.maxR;
  }

  function compassDeg(rad) {
    let d = ((rad * 180 / Math.PI) + 90) % 360;
    if (d < 0) d += 360;
    return d;
  }

  const api = {
    TAU,
    clamp,
    lerp,
    len,
    normalizeAngle,
    angleTo,
    normalizePositiveAngle,
    islandRadiusAtAngle,
    compassDeg
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  globalScope.SimMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
