import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.argv[2] || ROOT + '/tests/screenshots';
const b = await chromium.launch();
for (const [name, vp, mobile] of [['desk',{width:1280,height:720},false],['phone',{width:390,height:844},true],['phone-land',{width:844,height:390},true]]) {
  const ctx = await b.newContext({viewport:vp, isMobile:mobile, hasTouch:mobile});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text())});
  await p.goto('file://'+ROOT+'/dist/preview/full.html?debug=1');
  await p.waitForTimeout(300);
  await p.screenshot({path:`${OUT}/${name}-start.png`});
  await p.click('#btnPlay'); await p.waitForTimeout(500);
  await p.screenshot({path:`${OUT}/${name}-l1.png`});
  console.log(name, errs);
}
await b.close();
