// Each trick must kill a player who plays it the "obvious" way, at the place
// it is designed to, and the documented answer must get through it. Every
// trick is tested on its own in a one-segment level built with the game's
// own builder (segments start at x=400).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const NAIVE = [{hold:'right'}, {until:'false'}];
const TRAPS = [
  {seg:['trapdoor:200'], name:'trapdoor drops out from under a runner', plan:NAIVE, reason:'fall', xMin:600, xMax:950},
  {seg:['skyspike'], name:'sky spike lands on a runner', plan:NAIVE, reason:'spike', xMin:700, xMax:860},
  {seg:['leaper'], name:'jumping spike leaps into the obvious jump', plan:[{hold:'right'}, {jumpAt:700}, {until:'false'}], reason:'spike', xMin:600, xMax:860},
  {seg:['leaper'], name:'jumping spike: running under it is safe', plan:NAIVE, wins:true},
  {seg:['riser'], name:'rising wall: jumping as it rises gets over it', route:true, wins:true},
  {seg:['gap:150'], exit:'runaway', name:'runaway door leaves a spike where it stood', plan:[{hold:'right'}, {jumpAt:660}, {until:'false'}], reason:'spike', xMin:1100, xMax:1320},
  {seg:['ambush:150'], name:'ambush spike rises where a normal jump lands', plan:[{hold:'right'}, {jumpAt:640}, {until:'false'}], reason:'spike', xMin:900, xMax:1010},
  {seg:['popup'], name:'pop-up spikes rise in front of a runner', plan:NAIVE, reason:'spike', xMin:600, xMax:760},
  {seg:['crumble:200:120'], name:'crumbling pillar drops a player who lingers', plan:[{hold:'right'}, {jumpAt:660}, {until:'p.grounded && p.x > 900'}, {release:'right'}, {until:'false'}], reason:'fall', xMin:880, xMax:1060},
  {seg:['dropceiling'], name:'full jump under the dropping ceiling', plan:[{hold:'right'}, {jumpAt:740}, {until:'false'}], reason:'spike', xMin:700, xMax:1000},
  {seg:['rusher:650'], name:'rushing spike hits a runner', plan:NAIVE, reason:'spike', xMin:700, xMax:1250},
  {seg:['slide:230'], name:'sliding floor drops a runner', plan:NAIVE, reason:'fall', xMin:680, xMax:1000},
  {seg:['tiles:4:100:40'], name:'stopping on crumbling tiles', plan:[{hold:'right'}, {until:'p.x >= 760'}, {release:'right'}, {until:'false'}], reason:'fall', xMin:700, xMax:900},
];

export async function traps(page){
  const out = [];
  for (const tr of TRAPS) {
    const r = await page.evaluate(async ({tr}) => {
      const D = window.DeskmanFun.debug;
      D.LEVELS.push(D.buildLevel({id:99, name:'TRAP', segments:tr.seg, exit:tr.exit || 'plain'}));
      return D.LEVELS.length - 1;
    }, {tr});
    const runner = await import('./playthrough.mjs');
    const plan = tr.route ? await page.evaluate(i => window.DeskmanFun.debug.LEVELS[i].route, r) : tr.plan;
    const res = await runner.runPlanExported(page, r, plan, {maxSec: 30});
    await page.evaluate(() => { window.DeskmanFun.debug.LEVELS.pop(); });
    const d = res.deaths[0];
    const ok = tr.wins ? res.won : (!!d && d.reason === tr.reason && d.x >= tr.xMin && d.x <= tr.xMax);
    out.push({trap:tr.name, ok, death:d || null, won:res.won});
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.goto('file://' + ROOT + '/dist/preview/full.html?debug=1');
  const res = await traps(page);
  res.forEach(r => console.log(r.ok ? 'PASS' : 'FAIL', r.trap, JSON.stringify(r.death), r.won ? 'won' : ''));
  await b.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}
