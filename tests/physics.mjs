// Physics checks: frame-rate independence, moving-platform riding at low
// frame rates, jump metrics, and a random-input fuzz that asserts the player
// never ends a step embedded in solid geometry or with NaN state.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export async function physics(page) {
  return page.evaluate(() => {
    const D = window.Razebait.debug;
    D.setLoopPaused(false); // frame() drives the accumulator directly
    const results = {};
    const keysOff = () => { D.press('left', false); D.press('right', false); D.press('jump', false); };

    // 1) Frame-rate independence: same inputs, different display rates.
    const runAt = (hz, secs) => {
      D.setLoopPaused(true); D.start(0); D.setLoopPaused(false); keysOff();
      D.frame(0); // prime lastFrame
      D.press('right', true); D.press('jump', true);
      const frames = Math.round(secs * hz);
      for (let f = 0; f < frames; f++) D.frame(1000 / hz);
      const p = D.level().player; keysOff();
      return {x: p.x, y: p.y, vy: p.vy};
    };
    const rates = [30, 60, 120, 144, 240];
    const pos = rates.map(hz => runAt(hz, 0.5));
    const maxDx = Math.max(...pos.map(p => Math.abs(p.x - pos[1].x)));
    const maxDy = Math.max(...pos.map(p => Math.abs(p.y - pos[1].y)));
    results.frameRateIndependence = {rates, positions: pos.map(p => ({x:+p.x.toFixed(2), y:+p.y.toFixed(2)})), maxDx:+maxDx.toFixed(2), maxDy:+maxDy.toFixed(2), pass: maxDx < 4 && maxDy < 8};

    // 2) Jump metrics (full hold vs tap) on level 1 flat ground.
    D.setLoopPaused(true);
    const jumpHeight = (holdSteps) => {
      D.start(0); keysOff(); D.step(10);
      const y0 = D.level().player.y; let minY = y0;
      D.press('jump', true);
      for (let i = 0; i < 160; i++) { if (i === holdSteps) D.press('jump', false); D.step(1); minY = Math.min(minY, D.level().player.y); }
      keysOff();
      return +(y0 - minY).toFixed(1);
    };
    const full = jumpHeight(1000), tap = jumpHeight(4);
    results.jump = {fullHeight: full, tapHeight: tap, pass: full > 150 && full < 170 && tap < 70 && tap > 15};

    // 3) Riding fast vertical / horizontal platforms at a low frame rate.
    const LEVELS = D.LEVELS;
    const testLevel = {
      id: 99, name: 'TEST', width: 1600, height: 900, spawn: {x: 410, y: 300},
      platforms: [
        {x: 0, y: 860, w: 300, h: 40, type: 'solid'},
        {x: 400, y: 700, w: 140, h: 30, type: 'moving', path: {x1: 400, y1: 700, x2: 400, y2: 300, speed: 420, pauseStart: 0, pause: 0.2}},
        {x: 800, y: 600, w: 140, h: 30, type: 'moving', path: {x1: 800, y1: 600, x2: 1200, y2: 600, speed: 420, pauseStart: 0, pause: 0.2}}
      ],
      hazards: [], goal: {x: 1500, y: 100, w: 70, h: 100, type: 'normal'}, annotations: []
    };
    LEVELS.push(testLevel);
    const idx = LEVELS.length - 1;
    const rideTest = (spawnX, spawnY, hz) => {
      testLevel.spawn = {x: spawnX, y: spawnY};
      D.setLoopPaused(true); D.start(idx); keysOff();
      D.step(30); // settle onto the platform
      D.setLoopPaused(false); D.frame(0);
      let grounded = 0, total = 0, died = false;
      for (let f = 0; f < hz * 4; f++) {
        D.frame(1000 / hz);
        if (D.state() !== 'playing') { died = true; break; }
        total++; if (D.level().player.grounded) grounded++;
      }
      D.setLoopPaused(true);
      return {hz, groundedRatio: +(grounded / Math.max(1, total)).toFixed(3), died};
    };
    results.ridingVertical = [20, 30, 60, 144].map(hz => rideTest(450, 600, hz));
    results.ridingHorizontal = [20, 30, 60, 144].map(hz => rideTest(850, 500, hz));
    results.riding = {pass: results.ridingVertical.concat(results.ridingHorizontal).every(r => !r.died && r.groundedRatio > 0.97)};

    // 4) Fuzz: random inputs on every real level; after each step a live
    //    player must not overlap any solid by more than 1px on both axes.
    LEVELS.pop();
    let rng = 12345;
    const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const fuzz = [];
    for (let li = 0; li < window.Razebait.levels.length; li++) {
      D.start(li); keysOff();
      let embedded = 0, nan = 0, deaths = 0, steps = 0, worst = 0;
      for (let s = 0; s < 120 * 45; s++) { // 45 simulated seconds per level (30 levels)
        if (s % 12 === 0) {
          const r = rand();
          D.press('right', r < 0.65); D.press('left', r > 0.85);
          D.press('jump', rand() < 0.3);
        }
        D.step(1); steps++;
        const st = D.state();
        if (st === 'dead') { deaths++; D.respawn(); continue; }
        if (st === 'won') { D.start(li); continue; }
        const p = D.level().player;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) nan++;
        for (const sd of D.solids()) {
          const ox = Math.min(p.x + p.w, sd.x + sd.w) - Math.max(p.x, sd.x);
          const oy = Math.min(p.y + p.h, sd.y + sd.h) - Math.max(p.y, sd.y);
          if (ox > 1 && oy > 1) { embedded++; worst = Math.max(worst, Math.min(ox, oy)); }
        }
      }
      fuzz.push({level: li + 1, steps, deaths, embedded, worstPenetration: +worst.toFixed(2), nan});
    }
    keysOff();
    results.fuzz = {levels: fuzz, pass: fuzz.every(f => f.embedded === 0 && f.nan === 0)};
    return results;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = await chromium.launch();
  const page = await b.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + ROOT + '/dist/preview/full.html?debug=1');
  const r = await physics(page);
  console.log(JSON.stringify(r, null, 1));
  console.log('page errors:', errors);
  await b.close();
  const ok = ['frameRateIndependence','jump','riding','fuzz'].every(k => r[k].pass) && !errors.length;
  process.exit(ok ? 0 : 1);
}
