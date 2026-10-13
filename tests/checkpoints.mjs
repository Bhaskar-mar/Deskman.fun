// Every checkpoint in every level must lead to a completable run: respawn
// there (as after a death) and finish the level with the remaining route.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import { runPlanExported, levelRoutes, PLANS } from './playthrough.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Hand-built levels: the first route action to replay after each checkpoint.
const HAND = {
  3: ['{"until":"p.x >= 2006"}'],
  5: ['{"jumpAt":2020}'],
  6: ['{"tapAt":2340}', '{"jumpAt":2850}'],
  8: ['{"moveTo":1960}', '{"moveTo":3330}']
};

export async function checkpoints(page) {
  const routes = await levelRoutes(page);
  const cps = await page.evaluate(() => window.DeskmanFun.debug.LEVELS.map(l => l.checkpoints || []));
  const out = [];
  for (let i = 0; i < cps.length; i++) {
    for (let k = 0; k < cps[i].length; k++) {
      let rest;
      if (HAND[i + 1]) {
        const plan = PLANS[i + 1];
        const from = plan.findIndex(a => JSON.stringify(a) === HAND[i + 1][k]);
        rest = from >= 0 ? plan.slice(from) : null;
      } else if (routes[i] && cps[i][k].routeIndex != null) {
        rest = routes[i].slice(cps[i][k].routeIndex);
      }
      if (!rest) { out.push({level: i + 1, cp: k, ok: false, why: 'no route mapping'}); continue; }
      const r = await runPlanExported(page, i, [{hold: 'right'}].concat(rest), {cp: k, maxSec: 120});
      out.push({level: i + 1, cp: k, x: cps[i][k].x, ok: r.won, deaths: r.deaths, step: r.step});
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.goto('file://' + ROOT + '/dist/preview/full.html?debug=1');
  const res = await checkpoints(page);
  res.forEach(r => console.log(r.ok ? 'PASS' : 'FAIL', `L${r.level} checkpoint ${r.cp + 1} (x=${r.x})`, r.ok ? '' : JSON.stringify(r)));
  await b.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}
