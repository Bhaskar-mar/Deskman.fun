// Regenerates src/plugin/deskman-fun/includes/min-times.php: the fastest
// plausible clear time per level for the leaderboard (75% of a near-perfect
// automated run). Run after changing levels: ./tools/build.sh && node tools/gen-min-times.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { playthroughs } from '../tests/playthrough.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + ROOT + '/dist/preview/full.html?debug=1');
const res = await playthroughs(p);
await b.close();
const rows = [];
for (const [id, r] of Object.entries(res)) {
  if (!r.completed) { console.error('level ' + id + ' not completed; aborting'); process.exit(1); }
  rows.push(`\t\t${id} => ${Math.floor(r.time * 0.75 * 1000)},`);
}
const php = `<?php
/**
 * Fastest plausible clear time per level in milliseconds: 75% of a
 * near-perfect automated run (tools/gen-min-times.mjs). Faster submissions
 * are rejected as tampered. Filter: deskman_fun_min_times.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
function deskman_fun_default_min_times() {
	return array(
${rows.join('\n')}
	);
}
`;
fs.writeFileSync(ROOT + '/src/plugin/deskman-fun/includes/min-times.php', php);
console.log('wrote min-times for', rows.length, 'levels');
console.log(Object.entries(res).map(([id, r]) => id + ':' + r.time + 's').join(' '));
