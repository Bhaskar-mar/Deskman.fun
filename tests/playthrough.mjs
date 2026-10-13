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
const PLANS = {
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
    {jumpAt:2330},
    {until:"false"}
  ],
  3: [
    {hold:'right'},
    {jumpAt:230}, {jumpAt:575}, {jumpAt:870},
    {moveTo:1090},
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
    {jumpAt:2440},
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
  ]
};

export async function runPlanExported(page, levelIndex, plan, opts){ return runPlan(page, levelIndex, plan, opts); }
async function runPlan(page, levelIndex, plan, opts = {}) {
  return page.evaluate(({levelIndex, plan, startCheckpoint, maxSec}) => {
    const D = window.Razebait.debug;
    D.setLoopPaused(true);
    D.start(levelIndex);
    if (startCheckpoint) { /* not used */ }
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
      if (st === 'won') return {won:true, t:+t.toFixed(2), deaths, log};
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
  }, {levelIndex, plan, startCheckpoint: opts.cp, maxSec: opts.maxSec || 40});
}

export async function playthroughs(page) {
  const results = {};
  for (let i = 0; i < 5; i++) {
    const r = await runPlan(page, i, PLANS[i + 1]);
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
