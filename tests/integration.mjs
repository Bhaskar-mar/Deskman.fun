// Browser integration checks against the built preview pages (served over
// HTTP so localStorage behaves as on a real site).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOTS = ROOT + '/tests/screenshots';

export function serve(dir) {
  const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css'};
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(dir, u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({srv, base: 'http://127.0.0.1:' + srv.address().port})));
}

const results = [];
function check(name, pass, detail) { results.push({name, pass: !!pass, detail}); }

export async function integration(browser, base) {
  fs.mkdirSync(SHOTS, {recursive: true});

  /* ---- 1. Inline embed: page keeps working ---- */
  {
    const ctx = await browser.newContext({viewport: {width: 1280, height: 800}});
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(base + '/preview/embed.html?debug=1');
    await p.waitForTimeout(200);
    const st = await p.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflowY,
      htmlLocked: document.documentElement.classList.contains('dgm-lock-scroll'),
      appPos: getComputedStyle(document.getElementById('app')).position,
      appRect: document.getElementById('app').getBoundingClientRect().toJSON(),
      hostBtnBorder: getComputedStyle(document.getElementById('hostBtn')).borderTopWidth,
      hostBoxSizing: getComputedStyle(document.querySelector('.host-p')).boxSizing,
      gameBtnBorder: getComputedStyle(document.getElementById('btnPlay')).borderTopWidth,
      gameBoxSizing: getComputedStyle(document.getElementById('btnPlay')).boxSizing
    }));
    check('embed: page not scroll-locked', st.bodyOverflow !== 'hidden' && !st.htmlLocked && st.appPos === 'relative', st);
    check('embed: game box fits content column (<=960px wide, 16:9)', st.appRect.width <= 960 && Math.abs(st.appRect.width / st.appRect.height - 16 / 9) < 0.02, st.appRect);
    check('CSS isolation: game CSS does not restyle host elements', st.hostBtnBorder === '1px' && st.hostBoxSizing === 'content-box', st);
    check('CSS isolation: host CSS does not break game buttons', st.gameBtnBorder === '0px' && st.gameBoxSizing === 'border-box', st);

    await p.mouse.move(200, 300);
    await p.mouse.wheel(0, 600); await p.waitForTimeout(250);
    check('embed: mouse wheel scrolls the page', (await p.evaluate(() => scrollY)) > 100);
    await p.evaluate(() => scrollTo(0, 0));

    // Space on the page (game never touched) must keep its default action.
    const spacePrevented = await p.evaluate(() => new Promise(res => {
      window.addEventListener('keydown', e => res(e.defaultPrevented), {once: true});
      document.body.focus();
    }).then ? null : null);
    await p.evaluate(() => { window.__lastPrevented = null; window.addEventListener('keydown', e => { setTimeout(() => { window.__lastPrevented = e.defaultPrevented; }, 0); }); });
    await p.click('h1');
    await p.keyboard.press('Space'); await p.waitForTimeout(50);
    check('embed: Space not hijacked before the game is used', (await p.evaluate(() => window.__lastPrevented)) === false);

    // Typing in a comment box while the game is running.
    await p.click('#btnPlay'); await p.waitForTimeout(100);
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(400); await p.keyboard.up('ArrowRight');
    const moved = await p.evaluate(() => window.Razebait.debug.level().player.x);
    check('embed: arrow keys control the game after clicking it', moved > 120, {x: moved});
    await p.click('#comment');
    await p.keyboard.type('wasd jump!');
    const val = await p.inputValue('#comment');
    check('embed: typing in a textarea is never intercepted', val === 'wasd jump!', {val});
    await p.waitForTimeout(400); // let any deceleration finish
    const xBefore = await p.evaluate(() => window.Razebait.debug.level().player.x);
    await p.click('h1'); await p.keyboard.down('KeyD'); await p.waitForTimeout(250); await p.keyboard.up('KeyD');
    const xAfter = await p.evaluate(() => window.Razebait.debug.level().player.x);
    check('embed: keys ignored after clicking elsewhere on the page', Math.abs(xAfter - xBefore) < 1, {xBefore, xAfter});
    await p.screenshot({path: SHOTS + '/embed-desktop.png', fullPage: false});
    check('embed: no console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ---- 2. Viewport matrix (fullscreen mode) ---- */
  const VPS = [
    ['desktop-1920', {width: 1920, height: 1080}, false],
    ['laptop-1280', {width: 1280, height: 720}, false],
    ['ultrawide-2560', {width: 2560, height: 1080}, false],
    ['tablet-portrait', {width: 768, height: 1024}, true],
    ['tablet-landscape', {width: 1024, height: 768}, true],
    ['phone-portrait', {width: 390, height: 844}, true],
    ['phone-landscape', {width: 844, height: 390}, true],
    ['phone-small', {width: 360, height: 640}, true]
  ];
  for (const [name, vp, touch] of VPS) {
    const ctx = await browser.newContext({viewport: vp, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1});
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/preview/full.html?debug=1');
    await p.waitForTimeout(150);
    await p.screenshot({path: `${SHOTS}/${name}-start.png`});
    await p.click('#btnPlay');
    await p.evaluate(() => { const D = window.Razebait.debug; D.setLoopPaused(true); D.start(2); D.step(60); });
    await p.waitForTimeout(120);
    const m = await p.evaluate(() => {
      const D = window.Razebait.debug, v = D.view(), pl = D.level().player;
      const stage = document.getElementById('stage').getBoundingClientRect();
      const rect = id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return {l: r.left, t: r.top, r: r.right, b: r.bottom, vis: getComputedStyle(e).display !== 'none' && r.width > 0}; };
      const camX = D.camera().x;
      // player rect in CSS px, relative to the viewport
      const px = stage.left + (pl.x - camX) * v.scale, py = stage.top + (pl.y + v.offY) * v.scale;
      return {
        scrollW: document.scrollingElement.scrollWidth, innerW: innerWidth, scrollH: document.scrollingElement.scrollHeight, innerH: innerHeight,
        stage: {l: stage.left, t: stage.top, r: stage.right, b: stage.bottom},
        playerCss: {l: px, t: py, r: px + pl.w * v.scale, b: py + pl.h * v.scale, h: pl.h * v.scale},
        worldBottomCss: stage.top + (900 + v.offY) * v.scale,
        controls: rect('touchControls'), jump: rect('btnJump'), dpad: rect('dpad'),
        levelCard: rect('levelCard'), buttons: rect('btnPause'), restart: rect('btnRestart'),
        scale: v.scale, viewW: v.w
      };
    });
    await p.screenshot({path: `${SHOTS}/${name}-play.png`});
    const goalCss = await p.evaluate(() => {
      const D = window.Razebait.debug; const ls = D.level(); const v = D.view();
      ls.player.x = ls.data.width - 60; D.step(1); D.layout();
      for (let i = 0; i < 400; i++) D.step(1); // let the camera settle at the level end
      const cam = D.camera().x, g = ls.goal, st = document.getElementById('stage').getBoundingClientRect();
      const l = st.left + (g.x - cam) * v.scale, t = st.top + (g.y + v.offY) * v.scale;
      return {l, t, r: l + g.w * v.scale, b: t + g.h * v.scale};
    });
    const ov = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    check(`${name}: no page scroll / overflow`, m.scrollW <= m.innerW && m.scrollH <= m.innerH, {scrollW: m.scrollW, innerW: m.innerW, scrollH: m.scrollH, innerH: m.innerH});
    check(`${name}: stage inside viewport`, m.stage.l >= -0.5 && m.stage.t >= -0.5 && m.stage.r <= vp.width + 0.5 && m.stage.b <= vp.height + 0.5, m.stage);
    check(`${name}: player readable size (>=26px tall)`, m.playerCss.h >= 26, {playerPx: +m.playerCss.h.toFixed(1), viewW: Math.round(m.viewW)});
    check(`${name}: HUD buttons inside viewport and clear of level card`, m.buttons.r <= vp.width && m.restart.l >= 0 && !ov(m.levelCard, m.restart), {card: m.levelCard, restart: m.restart});
    if (touch) {
      check(`${name}: touch controls visible`, m.controls.vis && m.jump.vis && m.dpad.vis);
      check(`${name}: touch buttons >= 56px`, (m.jump.r - m.jump.l) >= 56 && (m.dpad.b - m.dpad.t) >= 56, {jump: m.jump.r - m.jump.l});
      check(`${name}: controls do not cover the player at spawn`, !ov(m.jump, m.playerCss) && !ov(m.dpad, m.playerCss), {player: m.playerCss, dpad: m.dpad, jump: m.jump});
      check(`${name}: controls do not cover the exit at level end`, !ov(m.jump, goalCss) && !ov(m.dpad, goalCss), {goal: goalCss, jump: m.jump});
    } else {
      check(`${name}: touch controls hidden on desktop`, !m.controls.vis);
    }
    check(`${name}: no page errors`, errs.length === 0, errs);
    await ctx.close();
  }

  /* ---- 3. Real touch input via CDP (d-pad hold + slide, jump) ---- */
  {
    const ctx = await browser.newContext({viewport: {width: 844, height: 390}, isMobile: true, hasTouch: true});
    const p = await ctx.newPage();
    await p.goto(base + '/preview/full.html?debug=1');
    await p.tap('#btnPlay'); await p.waitForTimeout(200);
    const cdp = await ctx.newCDPSession(p);
    const center = async sel => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; }, sel);
    const R = await center('#btnRight'), L = await center('#btnLeft'), J = await center('#btnJump');
    const x0 = await p.evaluate(() => window.Razebait.debug.level().player.x);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: R.x, y: R.y, id: 1}]});
    await p.waitForTimeout(500);
    const x1 = await p.evaluate(() => window.Razebait.debug.level().player.x);
    // second finger on jump while still holding right
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: R.x, y: R.y, id: 1}, {x: J.x, y: J.y, id: 2}]});
    await p.waitForTimeout(90);
    const air = await p.evaluate(() => { const pl = window.Razebait.debug.level().player; return {vy: pl.vy, grounded: pl.grounded}; });
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: [{x: R.x, y: R.y, id: 1}]});
    await p.waitForTimeout(500);
    // slide from right to left without lifting
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: R.x, y: R.y, id: 3}]});
    await p.waitForTimeout(100);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: L.x, y: L.y, id: 3}]});
    await p.waitForTimeout(80);
    const keysSlide = await p.evaluate(() => Object.assign({}, window.Razebait.debug.keys));
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await p.waitForTimeout(80);
    const keysEnd = await p.evaluate(() => Object.assign({}, window.Razebait.debug.keys));
    check('touch: holding → moves right', x1 - x0 > 80, {x0, x1});
    check('touch: jump works while holding a direction (multi-touch)', !air.grounded && air.vy < 0, air);
    check('touch: sliding thumb from → to ← switches direction', keysSlide.left && !keysSlide.right, keysSlide);
    check('touch: lifting releases all keys', !keysEnd.left && !keysEnd.right && !keysEnd.jump, keysEnd);
    await ctx.close();
  }

  /* ---- 4. Death → quick auto-respawn, pause, win → next ---- */
  {
    const ctx = await browser.newContext({viewport: {width: 1280, height: 720}});
    const p = await ctx.newPage();
    await p.goto(base + '/preview/full.html?debug=1');
    await p.click('#btnPlay'); await p.waitForTimeout(100);
    await p.keyboard.down('ArrowRight');
    let died = false; const t0 = Date.now();
    while (Date.now() - t0 < 4000) { if (await p.evaluate(() => window.Razebait.getState()) === 'dead') { died = true; break; } await p.waitForTimeout(20); }
    await p.keyboard.up('ArrowRight');
    const overlayOnDeath = await p.evaluate(() => !!document.querySelector('#deskman-fun-root .overlay.show'));
    const tDead = Date.now();
    let back = false;
    while (Date.now() - tDead < 1500) { if (await p.evaluate(() => window.Razebait.getState()) === 'playing') { back = true; break; } await p.waitForTimeout(20); }
    const respawnMs = Date.now() - tDead;
    check('death: no blocking overlay', died && !overlayOnDeath);
    check('death: auto-respawns quickly (<900ms)', back && respawnMs < 900, {respawnMs});
    // skip with jump
    await p.keyboard.down('ArrowRight');
    const t1 = Date.now(); while (Date.now() - t1 < 4000) { if (await p.evaluate(() => window.Razebait.getState()) === 'dead') break; await p.waitForTimeout(15); }
    await p.keyboard.up('ArrowRight');
    await p.waitForTimeout(160);
    const tSkip = Date.now(); await p.keyboard.press('Space');
    await p.waitForTimeout(30);
    check('death: jump key skips the respawn wait', await p.evaluate(() => window.Razebait.getState()) === 'playing', {ms: Date.now() - tSkip});

    await p.keyboard.press('Escape');
    const paused = await p.evaluate(() => window.Razebait.getState() === 'paused' && document.getElementById('pauseOverlay').classList.contains('show'));
    await p.keyboard.press('Escape');
    const resumed = await p.evaluate(() => window.Razebait.getState() === 'playing' && !document.querySelector('#deskman-fun-root .overlay.show'));
    check('pause: Esc pauses and resumes', paused && resumed);

    // win via debug teleport into the door, then Enter → level 2
    await p.evaluate(() => { const D = window.Razebait.debug; const ls = D.level(); ls.goal.x = ls.player.x - 18; ls.goal.y = ls.player.y - 38; });
    await p.waitForTimeout(700);
    const winShown = await p.evaluate(() => document.getElementById('winOverlay').classList.contains('show'));
    await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    const lvl = await p.evaluate(() => window.Razebait.debug.level().data.id);
    check('win: overlay shown, Enter advances to level 2', winShown && lvl === 2, {winShown, lvl});
    const prog = await p.evaluate(() => window.Razebait.getProgress());
    check('win: progress saved (level 2 unlocked)', prog.unlockedLevel >= 2 && prog.completedLevels.includes(1), prog);
    await ctx.close();
  }

  /* ---- 5. Save migration and corruption ---- */
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('deskmanfun_save_v1', JSON.stringify({unlockedLevel: 4, completedLevels: [1, 2, 3], totalDeaths: 77,
          settings: {sound: false, music: false, vibration: true, reducedMotion: true}, futureField: {keep: 'me'}}));
      }
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/preview/full.html?debug=1');
    await p.click('#btnLevelSelectStart');
    const menuOnTop = await p.evaluate(() => { const r = document.getElementById('btnCloseMenu').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && el.id === 'btnCloseMenu'; });
    check('start screen: LEVELS menu opens on top of the start screen', menuOnTop);
    await p.click('#btnCloseMenu');
    await p.click('#btnSettingsStart');
    const setOnTop = await p.evaluate(() => { const r = document.getElementById('btnCloseSettings').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && el.id === 'btnCloseSettings'; });
    check('start screen: SETTINGS opens on top of the start screen', setOnTop);
    await p.click('#btnCloseSettings');
    await p.click('#btnLevelSelectStart');
    const tiles = await p.evaluate(() => [...document.querySelectorAll('#levelGrid .lvl-tile')].map(t => !t.disabled));
    check('save v1: existing unlocks shown (levels 1-4 open, 5-8 locked)', JSON.stringify(tiles) === JSON.stringify([true, true, true, true, false, false, false, false]), tiles);
    // complete level 1 again → unlockedLevel must not drop to 2
    await p.evaluate(() => { const D = window.Razebait.debug; D.start(0); const ls = D.level(); ls.goal.x = ls.player.x - 18; ls.goal.y = ls.player.y - 38; D.step(2); });
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('deskmanfun_save_v1')));
    check('save v1: replaying an old level never lowers progress', stored.unlockedLevel === 4, stored);
    check('save v1: unknown fields and settings preserved', stored.futureField && stored.futureField.keep === 'me' && stored.settings.sound === false && stored.settings.reducedMotion === true && stored.totalDeaths === 77, stored);
    check('save v1: new stats stored alongside', stored.levelStats && stored.levelStats['1'] && stored.levelStats['1'].clears === 1, stored.levelStats);
    // A player who finished all five original levels: level 6 opens, Play continues there.
    await p.evaluate(() => localStorage.setItem('deskmanfun_save_v1', JSON.stringify({unlockedLevel: 5, completedLevels: [1, 2, 3, 4, 5], totalDeaths: 300, settings: {}})));
    await p.reload(); await p.waitForTimeout(100);
    await p.click('#btnLevelSelectStart');
    const tiles8 = await p.evaluate(() => [...document.querySelectorAll('#levelGrid .lvl-tile')].map(t => !t.disabled));
    await p.click('#btnCloseMenu');
    await p.click('#btnPlay');
    const lvlAfter = await p.evaluate(() => window.Razebait.debug.level().data.id);
    check('new levels: finishing the old 5 unlocks level 6 and Play continues there', JSON.stringify(tiles8) === JSON.stringify([true, true, true, true, true, true, false, false]) && lvlAfter === 6, {tiles8, lvlAfter});
    await p.evaluate(() => localStorage.setItem('deskmanfun_save_v1', '{not json'));
    await p.reload(); await p.waitForTimeout(100);
    check('save: corrupted data falls back to defaults without errors', errs.length === 0 && (await p.evaluate(() => window.Razebait.getProgress().unlockedLevel)) === 1, errs);
    await ctx.close();
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {srv, base} = await serve(ROOT + '/dist');
  const browser = await chromium.launch();
  const res = await integration(browser, base);
  for (const r of res) console.log(r.pass ? 'PASS' : 'FAIL', r.name, r.pass ? '' : JSON.stringify(r.detail));
  await browser.close(); srv.close();
  process.exit(res.every(r => r.pass) ? 0 : 1);
}
