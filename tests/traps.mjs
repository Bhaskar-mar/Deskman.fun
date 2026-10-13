// Each level's signature surprise must kill a player who plays the "obvious"
// way, at the place it is designed to. Uses the same plan runner.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const TRAPS = [
  {level:1, name:'door moves, spikes pop up where it stood', plan:[{hold:'right'},{jumpAt:466},{jumpAt:800},{jumpAt:1080},{until:'false'}], reason:'spike', xMin:1800, xMax:1970},
  {level:2, name:'last tile collapses almost instantly', plan:[{hold:'right'},{moveTo:1590},{until:"P[8].cx <= 1631 && P[8].waitT > 0.15"},{hold:'right'},{until:'p.x >= 1645'},{release:'right'},{until:'P[8].cx >= 1849'},{hold:'right'},{until:'false'}], reason:'fall', xMin:2380, xMax:2600},
  {level:2, name:'stopping on a disappearing tile drops you', plan:[{hold:'right'},{until:'p.x >= 900'},{release:'right'},{until:'false'}], reason:'fall', xMin:880, xMax:1000},
  {level:3, name:'hidden spike after the visible one', plan:[{hold:'right'},{jumpAt:230},{until:'false'}], reason:'spike', xMin:560, xMax:660},
  {level:3, name:'dashing under the crusher', plan:[{hold:'right'},{jumpAt:230},{jumpAt:575},{jumpAt:870},{moveTo:1090},{until:"H[2].dir < 0 && H[2].cx < 1460 && H[2].cx > 1250"},{hold:'right'},{jumpWhen:"H[2].cx - (p.x + p.w) < 90"},{jumpAt:1600},{until:'false'}], reason:'crush', xMin:2100, xMax:2300},
  {level:4, name:'stopping lets the wall catch you', plan:[{hold:'right'},{jumpAt:560},{until:'p.x >= 800'},{release:'right'},{until:'false'}], reason:'chaser', xMin:700, xMax:900},
  {level:5, name:'floor under the first door collapses', plan:[{hold:'right'},{jumpAt:670},{moveTo:975},{until:"P[3].cx <= 1001 && P[3].waitT > 0.15"},{hold:'right'},{until:'p.x >= 1012'},{release:'right'},{until:'P[3].cx >= 1239'},{hold:'right'},{jumpAt:1500},{jumpAt:1795},{jumpAt:2020},{jumpWhen:"(H[2].cx - (p.x + p.w)) < 110 && (H[2].cx - (p.x + p.w)) > 0 && p.x > 2420"},{until:'false'}], reason:'fall', xMin:3080, xMax:3340},
  {level:5, name:'tile before the real exit drops', plan:[{hold:'right'},{jumpAt:670},{moveTo:975},{until:"P[3].cx <= 1001 && P[3].waitT > 0.15"},{hold:'right'},{until:'p.x >= 1012'},{release:'right'},{until:'P[3].cx >= 1239'},{hold:'right'},{jumpAt:1500},{jumpAt:1795},{jumpAt:2020},{jumpWhen:"(H[2].cx - (p.x + p.w)) < 110 && (H[2].cx - (p.x + p.w)) > 0 && p.x > 2420"},{jumpAt:3060},{jumpAt:3440},{until:'false'}], reason:'fall', xMin:3660, xMax:3790},
];

const runner = (await import('./playthrough.mjs'));
export async function traps(page){
  const out = [];
  for (const tr of TRAPS) {
    const r = await runner.runPlanExported(page, tr.level - 1, tr.plan, {maxSec: 30});
    const d = r.deaths[0];
    const ok = !!d && d.reason === tr.reason && d.x >= tr.xMin && d.x <= tr.xMax;
    out.push({level:tr.level, trap:tr.name, ok, death:d || null, won:r.won});
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.goto('file://' + ROOT + '/dist/preview/full.html?debug=1');
  const res = await traps(page);
  res.forEach(r => console.log(r.ok ? 'PASS' : 'FAIL', 'L' + r.level, r.trap, JSON.stringify(r.death)));
  await b.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}
