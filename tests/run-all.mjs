// Runs every browser test against dist/ (run tools/build.sh first).
//   node tests/run-all.mjs
// The WordPress end-to-end test is separate (needs a WordPress install):
//   see tests/wordpress/setup-wp.sh and tests/wordpress/wp-integration.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import { playthroughs } from './playthrough.mjs';
import { traps } from './traps.mjs';
import { physics } from './physics.mjs';
import { integration, serve } from './integration.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + ROOT + '/dist/preview/full.html?debug=1');
let fail = 0;
const line = (ok, msg) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + msg); };

console.log('\n== Level play-throughs ==');
const pt = await playthroughs(page);
for (const [id, r] of Object.entries(pt)) line(r.completed && r.naiveHoldRightDies, `Level ${id}: completed in ${r.time}s with ${r.jumps.length} jumps; naive run dies (${r.naiveDeath && r.naiveDeath.reason} @x=${r.naiveDeath && r.naiveDeath.x})`);

console.log('\n== Traps fire as designed ==');
for (const t of await traps(page)) line(t.ok, `L${t.level}: ${t.trap} → ${t.death ? t.death.reason + ' @x=' + t.death.x : 'no death'}`);

console.log('\n== Physics ==');
const ph = await physics(page);
line(ph.frameRateIndependence.pass, `frame-rate independence 30/60/120/144/240 Hz: max Δx=${ph.frameRateIndependence.maxDx}, Δy=${ph.frameRateIndependence.maxDy}`);
line(ph.jump.pass, `jump height: held ${ph.jump.fullHeight}, tapped ${ph.jump.tapHeight}`);
line(ph.riding.pass, `riding 420px/s platforms at 20-144 Hz: ${ph.ridingVertical.concat(ph.ridingHorizontal).map(r => r.groundedRatio).join(', ')}`);
line(ph.fuzz.pass, `fuzz (90s random input per level): ` + ph.fuzz.levels.map(f => `L${f.level} embedded=${f.embedded} nan=${f.nan}`).join('; '));
line(errors.length === 0, `no page errors during gameplay tests ${errors.join(' | ')}`);
await page.close();

console.log('\n== Browser integration ==');
const {srv, base} = await serve(ROOT + '/dist');
for (const r of await integration(browser, base)) line(r.pass, r.name + (r.pass ? '' : ' ' + JSON.stringify(r.detail)));
srv.close();
await browser.close();
console.log(`\n${fail ? fail + ' FAILED' : 'ALL PASSED'}`);
process.exit(fail ? 1 : 0);
