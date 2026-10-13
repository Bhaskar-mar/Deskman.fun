// Automated play-throughs: drives the real engine in Chromium with scripted
// inputs on the deterministic fixed-step debug hook and asserts each of the
// five levels can be completed. Also checks that the traps actually fire
// (the naive "just hold right" run must die on every level).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Plan actions (see runPlan below):
//   {hold:'right'} {release:'right'} {jumpAt:X} {jumpWhen:'expr'} {until:'expr'} {moveTo:X}
// Expressions see: p (player), H (hazards), P (platforms), g (goal), ls.
export const PLANS = {
  1: [
    {hold:'right'},
    {jumpAt:466}, {jumpAt:800}, {jumpAt:1080}, {jumpAt:1800},
    {until:"false"}
  ],
  2: [
    {hold:'right'},
    {moveTo:1590},
    {until:"P[8].cx <= 1631 && P[8].waitT > 0.15"},
    {hold:'right'}, {until:"p.x >= 1645"}, {release:'right'},
    {until:"P[8].cx >= 1849"},
    {hold:'right'},
    {jumpAt:2170},
    {jumpAt:2360},
    {until:"false"}
  ],
  3: [
    {hold:'right'},
    {jumpAt:230}, {jumpAt:575}, {jumpAt:940},
    {moveTo:1150},
    {until:"H[2].dir < 0 && H[2].cx < 1460 && H[2].cx > 1250"},
    {hold:'right'},
    {jumpWhen:"H[2].cx - (p.x + p.w) < 90"},
    {jumpAt:1600},
    {until:"p.x >= 2006"}, {release:'right'}, {hold:'left'},
    {until:"H[3].state === 'rested'"}, {release:'left'},
    {hold:'right'}, {jumpAt:2060},
    {jumpAt:3060},
    {until:"false"}
  ],
  4: [
    {hold:'right'},
    {jumpAt:560}, {jumpAt:890}, {jumpAt:1790},
    {moveTo:2200},
    {until:"H[1].dir < 0 && H[1].cy < 580"},
    {hold:'right'},
    {jumpAt:2440}, {jumpAt:2925}, {jumpAt:3170},
    {until:"false"}
  ],
  5: [
    {hold:'right'},
    {jumpAt:670},
    {moveTo:975},
    {until:"P[3].cx <= 1001 && P[3].waitT > 0.15"},
    {hold:'right'}, {until:"p.x >= 1012"}, {release:'right'},
    {until:"P[3].cx >= 1239"},
    {hold:'right'},
    {jumpAt:1500}, {jumpAt:1795}, {jumpAt:2020},
    {jumpWhen:"(H[2].cx - (p.x + p.w)) < 110 && (H[2].cx - (p.x + p.w)) > 0 && p.x > 2420"},
    {jumpAt:3060}, {jumpAt:3440}, {jumpAt:3650},
    {until:"false"}
  ],
  6: [
    {hold:'right'},
    {jumpAt:150}, {jumpAt:450}, {jumpAt:950},
    {jumpWhen:"H[1].cx - (p.x + p.w) < 170 && H[1].cx > p.x"},
    {tapAt:2340},
    {jumpAt:2850},
    {until:"p.x >= 3170"}, {release:'right'}, {hold:'left'},
    {until:"H[4].state === 'rested'"}, {release:'left'},
    {hold:'right'}, {jumpAt:3220},
    {until:"false"}
  ],
  7: [
    {hold:'right'},
    {jumpAt:560}, {jumpAt:980}, {jumpAt:1975},
    {jumpWhen:"H[1].cx - (p.x + p.w) < 170 && H[1].cx > p.x"},
    {jumpAt:2590},
    {tapAt:3075},
    {jumpAt:3350},
    {until:"false"}
  ],
  8: [
    {hold:'right'},
    {jumpAt:470}, {jumpAt:890},
    {jumpWhen:"H[1].cx - (p.x + p.w) < 170 && H[1].cx > p.x"},
    {moveTo:1960},
    {until:"P[5].cx <= 2001 && P[5].waitT > 0.15"},
    {hold:'right'}, {until:"p.x >= 2015"}, {release:'right'},
    {until:"P[5].cx >= 2289"},
    {hold:'right'},
    {until:"p.x >= 2570"}, {release:'right'},
    {until:"H[3].state === 'rested'"},
    {hold:'right'}, {jumpAt:2640},
    {moveTo:3330},
    {until:"H[4].dir < 0 && H[4].cx < 3580 && H[4].cx > 3450"},
    {hold:'right'},
    {jumpWhen:"H[4].cx - (p.x + p.w) < 90"},
    {jumpAt:3640},
    {jumpAt:4630}, {jumpAt:4915}, {jumpAt:5030},
    {until:"false"}
  ]
};

export async function runPlanExported(page, levelIndex, plan, opts){ return runPlan(page, levelIndex, plan, opts); }
async function runPlan(page, levelIndex, plan, opts = {}) {
  return page.evaluate(({levelIndex, plan, startCheckpoint, maxSec, jitter, seed, trackChaser}) => {
    let minChaserGap = Infinity;
    let rs = seed || 1;
    const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    // optional human-like timing error: shift each jump threshold by ±jitter units
    plan = plan.map(a => (jitter && (a.jumpAt != null || a.tapAt != null))
      ? Object.assign({}, a, a.jumpAt != null ? {jumpAt: a.jumpAt + (rnd() * 2 - 1) * jitter} : {tapAt: a.tapAt + (rnd() * 2 - 1) * jitter}) : a);
    const D = window.DeskmanFun.debug;
    D.setLoopPaused(true);
    ['left', 'right', 'jump'].forEach(k => D.press(k, false)); // no keys carried over from a previous run
    if (startCheckpoint != null && startCheckpoint >= 0) D.startAt(levelIndex, startCheckpoint);
    else D.start(levelIndex);
    const STEP = D.consts.STEP;
    const ctxFn = (expr) => new Function('p','H','P','g','ls', 'return (' + expr + ');');
    let i = 0, t = 0, jumpRelease = -1;
    const log = [];
    const deaths = [];
    let lastState = D.state();
    let movingTo = null;
    while (t < maxSec) {
      const ls = D.level();
      const p = ls.player, H = ls.hazards, P = ls.plats, g = ls.goal;
      const st = D.state();
      if (trackChaser) { const ch = H.find(h => h.type === 'chaser' && h.running && h.front < h.stopX); if (ch) minChaserGap = Math.min(minChaserGap, p.x - ch.front); }
      if (st === 'won') return {won:true, t:+t.toFixed(2), deaths, log, minChaserGap: Number.isFinite(minChaserGap) ? Math.round(minChaserGap) : null};
      if (st === 'dead' && lastState !== 'dead') deaths.push({reason: ls.deathReason, x: Math.round(p.x), y: Math.round(p.y), t:+t.toFixed(2)});
      lastState = st;
      if (st === 'dead') return {won:false, t:+t.toFixed(2), deaths, step:i, log};
      // auto-release jump
      if (jumpRelease >= 0 && t >= jumpRelease) { D.press('jump', false); jumpRelease = -1; }
      // run actions that complete instantly, stop at the first blocking one
      let guard = 0;
      while (i < plan.length && guard++ < 50) {
        const a = plan[i];
        if (a.hold) { D.press(a.hold, true); i++; continue; }
        if (a.release) { D.press(a.release, false); i++; continue; }
        if (a.tapAt != null) { // short hop: release jump after 4 sim steps
          if (p.x >= a.tapAt && p.grounded && jumpRelease < 0) { D.press('jump', true); jumpRelease = t + 4 * STEP - 1e-6; log.push('tap@' + Math.round(p.x)); i++; }
          break;
        }
        if (a.jumpAt != null) {
          if (p.x >= a.jumpAt && p.grounded && jumpRelease < 0) { D.press('jump', true); jumpRelease = t + 0.4; log.push('jump@' + Math.round(p.x)); i++; }
          break;
        }
        if (a.jumpWhen) {
          if (ctxFn(a.jumpWhen)(p,H,P,g,ls) && p.grounded && jumpRelease < 0) { D.press('jump', true); jumpRelease = t + 0.4; log.push('jumpWhen@' + Math.round(p.x)); i++; }
          break;
        }
        if (a.until) { if (ctxFn(a.until)(p,H,P,g,ls)) { i++; continue; } break; }
        if (a.moveTo != null) {
          if (movingTo === null) { movingTo = a.moveTo; D.press('right', true); }
          if (p.x >= a.moveTo - 24) { D.press('right', false); }
          if (p.x >= a.moveTo - 24 && Math.abs(p.vx) < 1 && p.grounded) { movingTo = null; i++; continue; }
          break;
        }
        i++;
      }
      D.step(1); t += STEP;
    }
    const p = D.level().player;
    return {won:false, timeout:true, t, step:i, x:p.x, y:p.y, deaths, log};
  }, {levelIndex, plan, startCheckpoint: opts.cp, maxSec: opts.maxSec || 40, jitter: opts.jitter || 0, seed: opts.seed || 1, trackChaser: !!opts.trackChaser});
}

// Levels 9+ are built from segments and carry their own winning route.
export async function levelRoutes(page) {
  return page.evaluate(() => window.DeskmanFun.debug.LEVELS.map(l => l.route || null));
}

// Difficulty curve: for every timed jump in a level's winning route, sweep
// the take-off point (others at nominal) and measure the width of the window
// that still clears the level. Fewer/narrower windows = harder.
export async function difficulty(page, range = 160, stepSize = 4) {
  const out = {};
  const routes = await levelRoutes(page);
  const ids = routes.map((r, i) => i + 1);
  for (const id of ids) {
    const plan = PLANS[id] || routes[id - 1];
    const windows = [];
    for (let k = 0; k < plan.length; k++) {
      const a = plan[k];
      const key = a.jumpAt != null ? 'jumpAt' : a.tapAt != null ? 'tapAt' : null;
      if (!key) continue;
      const tryOff = async off => (await runPlan(page, +id - 1, plan.map((b, m) => m === k ? Object.assign({}, b, {[key]: b[key] + off}) : b), {maxSec: 120})).won;
      let lo = 0, hi = 0;
      while (lo > -range && await tryOff(lo - stepSize)) lo -= stepSize;
      while (hi < range && await tryOff(hi + stepSize)) hi += stepSize;
      windows.push({at: a[key], type: key === 'tapAt' ? 'tap' : 'jump', width: hi - lo + stepSize, capped: lo <= -range || hi >= range});
    }
    // score: sum of 100/width over timed jumps (a 50-unit window ≈ 130 ms adds 2)
    const score = +windows.reduce((sum, w) => sum + 100 / w.width, 0).toFixed(2);
    // Everything that is hard for reasons other than jump timing:
    //  - crumbling tiles: 1 per stretch + 10 / (hesitation slack in units at run speed)
    //  - chasing wall: 3 + (wall speed - 340) / 5
    //  - reactive hazards (rushers, saws, crushers, rides): fixed weights
    const extra = await page.evaluate(i => {
      const L = window.DeskmanFun.debug.LEVELS[i];
      let tiles = 0, react = 0;
      const groups = {};
      // tiles you must run across (ones that drop faster than you can cross are jumped, and scored as jumps)
      L.platforms.forEach(p => { if (p.type === 'disappearing') { const slackMs = p.delay - p.w / 380 * 1000; if (slackMs > 0) groups[p.delay + ':' + p.w] = 10 / (slackMs * 0.38); } });
      const tileGroups = {};
      L.platforms.forEach((p, i) => { if (p.type === 'disappearing' && p.delay - p.w / 380 * 1000 > 0) tileGroups[Math.round(p.x / 1000)] = 1; });
      tiles = Object.keys(tileGroups).length + Object.values(groups).reduce((a, b) => a + b, 0);
      L.hazards.forEach(h => {
        if (h.type === 'spike' && h.idle) react += 0.6 + (h.path.speed - 480) / 200;
        if (h.type === 'saw') react += 0.5 + (h.path.speed - 200) / 200;
        if (h.type === 'fallingCeiling') react += 0.6;
        if (h.type === 'hiddenSpike') react += 0.4;
      });
      L.platforms.forEach(p => { if (p.type === 'moving') react += 0.5; if (p.type === 'invisible') react += 0.3; });
      if (L.goal.type === 'fake') react += 0.3;
      return {tiles: +tiles.toFixed(2), react: +react.toFixed(2), chase: L.hazards.some(h => h.type === 'chaser')};
    }, +id - 1);
    // chasing wall: how little speed advantage you have (run speed 380)
    const chaseSpeed = await page.evaluate(i => { const c = window.DeskmanFun.debug.LEVELS[i].hazards.find(h => h.type === 'chaser'); return c ? c.speed : 0; }, +id - 1);
    const chaseScore = chaseSpeed ? +(3 + (chaseSpeed - 340) / 5).toFixed(2) : 0;
    const composite = +(score + extra.tiles + extra.react + chaseScore).toFixed(2);
    out[id] = {composite, score, tiles: extra.tiles, react: extra.react, chase: chaseScore, timedJumps: windows.length, tightest: Math.min(...windows.map(w => w.width)), windows};
  }
  return out;
}

export async function playthroughs(page) {
  const results = {};
  const count = await page.evaluate(() => window.DeskmanFun.levels.length);
  const routes = await levelRoutes(page);
  for (let i = 0; i < count; i++) {
    const r = await runPlan(page, i, PLANS[i + 1] || routes[i], {maxSec: 120});
    const naive = await runPlan(page, i, [{hold:'right'}, {until:'false'}], {maxSec: 20});
    results[i + 1] = {completed: r.won, time: r.t, deaths: r.deaths, step: r.step, jumps: r.log,
      naiveHoldRightDies: !naive.won && naive.deaths.length > 0, naiveDeath: naive.deaths[0]};
    if (!r.won) results[i + 1].debug = r;
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = await chromium.launch();
  const page = await b.newPage({viewport:{width:1280, height:720}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + ROOT + '/dist/preview/full.html?debug=1');
  const res = await playthroughs(page);
  console.log(JSON.stringify(res, null, 1));
  console.log('page errors:', errors);
  await b.close();
  const ok = Object.values(res).every(r => r.completed && r.naiveHoldRightDies) && !errors.length;
  process.exit(ok ? 0 : 1);
}
