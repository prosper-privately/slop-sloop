const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

async function startStaticServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const normalized = requestPath === '/' ? '/index.html' : requestPath;
      const requestedFile = path.join(rootDir, path.normalize(normalized));

      if (!requestedFile.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const body = await fs.readFile(requestedFile);
      res.writeHead(200, { 'content-type': contentTypeFor(requestedFile) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`
  };
}

function parseDeg(text) {
  const match = text.match(/(\d{1,3})°/);
  return match ? Number(match[1]) : null;
}

function signedDegDelta(target, current) {
  return ((target - current + 540) % 360) - 180;
}

async function readHud(page) {
  const [scoreText, headingText, windText, sailText, distanceText, taskText, statusText] = await Promise.all([
    page.locator('#scoreValue').innerText(),
    page.locator('#headingValue').innerText(),
    page.locator('#windValue').innerText(),
    page.locator('#sailValue').innerText(),
    page.locator('#distanceValue').innerText(),
    page.locator('#taskValue').innerText(),
    page.locator('#statusBox').innerText()
  ]);

  return {
    score: Number(scoreText.trim()),
    headingDeg: parseDeg(headingText),
    windDeg: parseDeg(windText),
    sailDeg: parseDeg(sailText),
    distanceM: Number((distanceText.match(/\d+/) || ['0'])[0]),
    targetDeg: Number((taskText.match(/Steer\s+(\d{1,3})°/) || [null, NaN])[1]),
    status: statusText
  };
}

async function roundBuoyUsingPhysics(page, budgetMs) {
  const deadline = Date.now() + budgetMs;
  let turnRightKey = 'd';
  let turnLeftKey = 'a';
  let previousDistance = Infinity;

  while (Date.now() < deadline) {
    const hud = await readHud(page);
    if (hud.score > 0) return true;

    if (/collision|shipwrecked/i.test(hud.status)) {
      await page.keyboard.press('r');
      await page.waitForTimeout(800);
      continue;
    }

    if (!Number.isFinite(hud.headingDeg) || !Number.isFinite(hud.targetDeg) || !Number.isFinite(hud.windDeg)) {
      await page.waitForTimeout(100);
      continue;
    }

    const previousHeading = hud.headingDeg;
    const deltaToMark = signedDegDelta(hud.targetDeg, hud.headingDeg);

    if (/in irons/i.test(hud.status)) {
      await page.keyboard.press(' ');
    }

    if (Math.abs(deltaToMark) > 6) {
      const key = deltaToMark > 0 ? turnRightKey : turnLeftKey;
      const turnHoldMs = Math.min(360, 120 + Math.abs(deltaToMark) * 2.5);
      await page.keyboard.down(key);
      await page.waitForTimeout(turnHoldMs);
      await page.keyboard.up(key);

      const newHeading = (await readHud(page)).headingDeg;
      if (Number.isFinite(newHeading)) {
        const progress = Math.abs(signedDegDelta(hud.targetDeg, previousHeading)) - Math.abs(signedDegDelta(hud.targetDeg, newHeading));
        if (progress < -2) {
          [turnRightKey, turnLeftKey] = [turnLeftKey, turnRightKey];
        }
      }
    }

    const absWind = Math.abs(signedDegDelta(hud.windDeg, hud.headingDeg));
    const targetSail = Math.max(5, Math.min(72, absWind * 0.55));

    if (hud.sailDeg > targetSail + 3) {
      await page.keyboard.down('w');
      await page.waitForTimeout(80);
      await page.keyboard.up('w');
    } else if (hud.sailDeg < targetSail - 3) {
      await page.keyboard.down('s');
      await page.waitForTimeout(80);
      await page.keyboard.up('s');
    }

    if (hud.distanceM > previousDistance + 30) {
      await page.keyboard.press(' ');
    }
    previousDistance = Math.min(previousDistance, hud.distanceM);

    if (hud.distanceM < 70) {
      await page.waitForTimeout(280);
    } else {
      await page.waitForTimeout(80);
    }
  }

  return false;
}

test('rounds at least one buoy in the browser using steering and sail controls', { timeout: 120_000 }, async () => {
  const { server, url } = await startStaticServer(process.cwd());
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#scoreValue');

    const initialHud = await readHud(page);
    assert.equal(initialHud.score, 0);

    let rounded = false;
    for (let attempt = 0; attempt < 4 && !rounded; attempt += 1) {
      if (attempt > 0) {
        await page.keyboard.press('r');
        await page.waitForTimeout(800);
      }
      rounded = await roundBuoyUsingPhysics(page, 25_000);
    }
    assert.equal(rounded, true, 'expected the boat to round at least one buoy using game controls and physics');

    const finalHud = await readHud(page);
    assert.ok(finalHud.score > 0, `expected score to increase after rounding a buoy, got ${finalHud.score}`);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
