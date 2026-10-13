// End-to-end test against a real WordPress install (PHP built-in server +
// SQLite). Simulates a live site on the original v1.2.0 plugin+theme with a
// player's saved progress, upgrades the files to the new build, and checks
// every plugin/theme combination.
//
// Usage: node wp-integration.mjs <wp-root> <base-url>
// Expects a fresh install with the v1.2.0 plugin/theme folders present.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');
const [WP, BASE] = process.argv.slice(2);
const SHOTS = REPO + '/tests/screenshots';
const wp = (...a) => execFileSync('php', [HERE + '/wp-helper.php', WP, ...a], {encoding: 'utf8'}).trim().split('\n').pop();
const results = [];
const check = (name, pass, detail) => { results.push({name, pass: !!pass}); console.log(pass ? 'PASS' : 'FAIL', name, pass ? '' : JSON.stringify(detail)); };
const debugLog = () => { const f = WP + '/wp-content/debug.log'; return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
// Only lines caused by our code: errors inside our folders, or WordPress
// notices about our theme's templates (e.g. a missing comments.php).
const ourLogLines = () => debugLog().split('\n').filter(l => /wp-content\/(plugins\/deskman-fun|themes\/deskman-fun-theme)\/|Theme without/.test(l));

const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 800}});
const page = await ctx.newPage();
const consoleErrors = [];
// The Playground WordPress build used in CI strips core static assets
// (jQuery etc.), so wp-login/wp-admin pages log core script errors that are
// unrelated to this project. Front-end pages are checked strictly.
const isCorePage = () => /\/wp-(login|admin)/.test(page.url());
page.on('pageerror', e => { if (!isCorePage() && /deskman/.test(e.stack || '')) consoleErrors.push(page.url() + ' :: ' + e.message); });
page.on('console', m => { const src = (m.location() && m.location().url) || ''; if (!isCorePage() && m.type() === 'error' && /deskman/.test(src)) consoleErrors.push(page.url() + ' :: ' + m.text() + ' @ ' + src); });
page.on('requestfailed', r => { if (/deskman/.test(r.url())) consoleErrors.push('requestfailed ' + r.url()); });
// Google Fonts is not reachable from the test sandbox; block it so pages load fast.
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

async function login() {
  await page.goto(BASE + '/wp-login.php');
  await page.fill('#user_login', 'admin');
  await page.fill('#user_pass', 'admin-test-pass');
  await Promise.all([page.waitForNavigation(), page.click('#wp-submit')]);
}
const gameAssets = async () => page.evaluate(() => ({
  js: [...document.scripts].map(s => s.src).filter(s => /deskman-game\.js/.test(s)),
  css: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href).filter(h => /deskman-game\.css/.test(h)),
  roots: document.querySelectorAll('#deskman-fun-root').length,
  version: window.Razebait ? window.Razebait.version : null
}));

/* ---------- Phase 1: the live site on v1.2.0 ---------- */
await login();
console.log('activate plugin 1.2.0:', wp('activate-plugin', 'deskman-fun/deskman-fun.php'));
console.log('switch theme 1.2.0:', wp('switch-theme', 'deskman-fun-theme'));
await page.goto(BASE + '/'); // runs after_switch_theme
await page.goto(BASE + '/wp-admin/');
const st1 = JSON.parse(wp('state'));
console.log('state after v1.2.0 setup', st1);
await page.goto(BASE + '/');
await page.waitForTimeout(300);
const a1 = await gameAssets();
check('v1.2.0 baseline: front page shows the game', a1.roots === 1 && a1.js.length === 1, a1);
// A returning player's progress as saved by v1.2.0.
await page.evaluate(() => localStorage.setItem('deskmanfun_save_v1', JSON.stringify({unlockedLevel: 3, completedLevels: [1, 2], totalDeaths: 41, settings: {sound: true, music: false, vibration: true, reducedMotion: false}})));
const embedId = wp('post', 'Embed test', 'embed-test', 'Intro paragraph.\n\n[deskman_game]\n\nOutro paragraph. <a href="#c">link</a>\n\n' + 'Long text. '.repeat(400));
const twoId = wp('post', 'Two games', 'two-games', '[deskman_game]\n\n[deskman_game]');
const injId = wp('post', 'Injection', 'injection', '[deskman_game max_width="500px;position:fixed;top:0;left:0;width:100vw"]');
const okId = wp('post', 'Width ok', 'width-ok', '[deskman_game max_width="720px"]');
const plainId = wp('post', 'Plain page', 'plain-page', 'No game here.', 'page');
console.log('posts', {embedId, twoId, injId, okId, plainId});
fs.writeFileSync(WP + '/wp-content/debug.log', ''); // only judge the new code's log output

/* ---------- Phase 2: upgrade files in place to the new build ---------- */
// Like WordPress's own upgrader: maintenance mode while files are replaced,
// and each folder swapped in one rename, so no request sees a half-updated
// plugin/theme (a queued wp-cron loopback could otherwise hit mid-swap).
fs.writeFileSync(WP + '/.maintenance', '<?php $upgrading = time();');
for (const [dir, zip] of [['plugins', 'deskman-fun'], ['themes', 'deskman-fun-theme']]) {
  const built = fs.readdirSync(REPO + '/dist').find(f => f.startsWith(zip + '-') && f.endsWith('.zip') && (zip === 'deskman-fun-theme' || !f.includes('theme')));
  const tmp = `${WP}/wp-content/${dir}/.upgrade-tmp`;
  fs.rmSync(tmp, {recursive: true, force: true});
  execFileSync('unzip', ['-q', '-o', REPO + '/dist/' + built, '-d', tmp]);
  fs.rmSync(`${WP}/wp-content/${dir}/${zip}`, {recursive: true, force: true});
  fs.renameSync(`${tmp}/${zip}`, `${WP}/wp-content/${dir}/${zip}`);
  fs.rmSync(tmp, {recursive: true, force: true});
}
fs.rmSync(WP + '/.maintenance', {force: true});
await page.goto(BASE + '/wp-admin/plugins.php');
const pluginRow = await page.textContent('tr[data-plugin="deskman-fun/deskman-fun.php"]').catch(() => '');
check('upgrade: plugin still active after file update, shows 1.4.0', /Version 1\.4\.0/.test(pluginRow) && /Deactivate/.test(pluginRow), pluginRow.slice(0, 200));
const st2 = JSON.parse(wp('state'));
check('upgrade: setup options untouched (no duplicate Play page, front page kept)', st2.page_on_front === st1.page_on_front && st2.play_plugin === st1.play_plugin && st2.play_theme === st1.play_theme, {st1, st2});

/* ---------- Phase 3: theme + plugin (the production setup) ---------- */
await page.goto(BASE + '/');
await page.waitForTimeout(400);
const a3 = await gameAssets();
check('theme+plugin: front page runs v1.4.0 exactly once', a3.version === '1.4.0' && a3.roots === 1 && a3.js.length === 1 && a3.css.length === 1, a3);
check('theme+plugin: plugin copy of assets wins the shared handle', a3.js[0] && a3.js[0].includes('/plugins/deskman-fun/') && a3.js[0].includes('ver=1.4.0'), a3.js);
const titles = await page.evaluate(() => document.querySelectorAll('head title').length);
check('theme template: exactly one <title>', titles === 1, titles);
await page.click('#btnLevelSelectStart');
const unlocked = await page.evaluate(() => [...document.querySelectorAll('#levelGrid .lvl-tile')].map(t => !t.disabled));
check('upgrade: v1.2.0 player progress kept (levels 1-3 open)', JSON.stringify(unlocked) === JSON.stringify([true, true, true, false, false, false, false, false]), unlocked);
await page.click('#btnCloseMenu');
await page.click('#btnPlay');
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
const lvl = await page.evaluate(() => document.getElementById('levelLabel').textContent);
check('theme+plugin: Play continues at the furthest unlocked level', lvl === 'LEVEL 3', lvl);
await page.screenshot({path: SHOTS + '/wp-front-fullscreen.png'});
await page.mouse.wheel(0, 800); await page.waitForTimeout(200);
const fs1 = await page.evaluate(() => ({locked: document.documentElement.classList.contains('dgm-lock-scroll'), scrollY, scrollX,
  app: document.getElementById('app').getBoundingClientRect().toJSON(), bar: (document.getElementById('wpadminbar') || {getBoundingClientRect: () => ({bottom: 0})}).getBoundingClientRect().bottom}));
check('theme+plugin: fullscreen page is scroll-locked', fs1.locked && fs1.scrollY === 0 && fs1.scrollX === 0, fs1);
check('theme+plugin: fullscreen game sits below the 32px admin bar and fills the rest', fs1.app.top === 32 && Math.abs(fs1.app.bottom - 800) < 1, fs1.app);

// Embedded in a normal post (theme's new singular.php renders the_content).
await page.goto(BASE + '/embed-test/');
await page.waitForTimeout(300);
const e = await page.evaluate(() => ({roots: document.querySelectorAll('#deskman-fun-root').length, locked: document.documentElement.classList.contains('dgm-lock-scroll'), overflow: getComputedStyle(document.body).overflowY, h: document.scrollingElement.scrollHeight, ih: innerHeight, app: document.getElementById('app').getBoundingClientRect().toJSON()}));
check('embed post: game rendered inline under the theme', e.roots === 1 && !e.locked && e.overflow !== 'hidden' && e.app.width > 300 && e.app.width <= 960, e);
await page.mouse.move(640, 700); await page.mouse.wheel(0, 1200); await page.waitForTimeout(300);
check('embed post: page scrolls normally', (await page.evaluate(() => scrollY)) > 300);
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({path: SHOTS + '/wp-embed-post.png'});

await page.goto(BASE + '/two-games/');
const two = await page.evaluate(() => ({roots: document.querySelectorAll('#deskman-fun-root').length, html: document.querySelector('.entry-content') ? document.querySelector('.entry-content').innerHTML : ''}));
check('two shortcodes: only one instance rendered (no duplicate IDs)', two.roots === 1 && two.html.includes('only one game instance'), two.roots);

await page.goto(BASE + '/injection/');
const inj = await page.evaluate(() => document.querySelector('#deskman-fun-root .dgm-wrap').getAttribute('style'));
check('max_width: CSS injection rejected (falls back to 960px)', inj === 'max-width:960px;', inj);
await page.goto(BASE + '/width-ok/');
const okw = await page.evaluate(() => document.querySelector('#deskman-fun-root .dgm-wrap').getAttribute('style'));
check('max_width: valid value kept', okw === 'max-width:720px;', okw);

await page.goto(BASE + '/plain-page/');
const plain = await gameAssets();
check('assets: plain pages load no game JS/CSS', plain.js.length === 0 && plain.css.length === 0 && plain.roots === 0, plain);
const plainText = await page.textContent('body');
check('theme: singular.php shows full page content', plainText.includes('No game here.'));

/* ---------- Phase 4: plugin only, with a stock block theme ---------- */
console.log('switch theme:', wp('switch-theme', 'twentytwentyfour'));
await page.goto(BASE + '/');
await page.waitForTimeout(300);
const a4 = await gameAssets();
check('plugin only (Twenty Twenty-Four): Play page runs the game', a4.version === '1.4.0' && a4.roots === 1, a4);
await page.screenshot({path: SHOTS + '/wp-plugin-only-tt4.png'});
await page.goto(BASE + '/embed-test/');
await page.waitForTimeout(300);
const e4 = await page.evaluate(() => ({roots: document.querySelectorAll('#deskman-fun-root').length, locked: document.documentElement.classList.contains('dgm-lock-scroll'), hasPlay: !!document.getElementById('btnPlay')}));
check('plugin only: inline embed works in a block theme', e4.roots === 1 && !e4.locked && e4.hasPlay, e4);
await page.screenshot({path: SHOTS + '/wp-plugin-only-embed.png', fullPage: false});

/* ---------- Phase 5: theme only ---------- */
console.log('deactivate plugin:', wp('deactivate-plugin', 'deskman-fun/deskman-fun.php'));
console.log('switch theme:', wp('switch-theme', 'deskman-fun-theme'));
await page.goto(BASE + '/');
await page.waitForTimeout(300);
const a5 = await gameAssets();
check('theme only: fullscreen template loads the theme copy of v1.4.0', a5.version === '1.4.0' && a5.js[0] && a5.js[0].includes('/themes/deskman-fun-theme/'), a5);
await page.goto(BASE + '/embed-test/');
const raw = await page.textContent('.entry-content');
check('theme only: shortcode text shows as-is when plugin is off (expected WP behaviour)', raw.includes('[deskman_game]'));

/* ---------- Phase 6: admin screens and logs ---------- */
console.log('re-activate plugin:', wp('activate-plugin', 'deskman-fun/deskman-fun.php'));
for (const u of ['/wp-admin/', '/wp-admin/plugins.php', '/wp-admin/themes.php', '/wp-admin/edit.php?post_type=page']) {
  await page.goto(BASE + u);
}
const body = await page.textContent('body');
check('admin: no PHP warnings/notices on admin screens', !/(Warning|Notice|Deprecated|Fatal error):/.test(body));
const ours = ourLogLines();
check('debug.log: no PHP errors from plugin or theme', ours.length === 0, ours.slice(0, 5));
check('browser (logged in): no JS errors or failed requests from game files', consoleErrors.length === 0, consoleErrors.slice(0, 8));

// Strict pass as a logged-out visitor (no admin bar, so no core scripts that
// the stripped test build lacks): any console error or failed request fails.
{
  const vctx = await browser.newContext({viewport: {width: 1280, height: 800}});
  await vctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const v = await vctx.newPage();
  const strict = [];
  v.on('pageerror', e => strict.push(v.url() + ' :: ' + e.message));
  v.on('console', m => { const src = (m.location() && m.location().url) || ''; if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(src)) strict.push(v.url() + ' :: ' + m.text() + ' @ ' + src); });
  v.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) strict.push('HTTP ' + r.status() + ' ' + r.url()); });
  for (const u of ['/', '/embed-test/', '/two-games/', '/injection/', '/width-ok/', '/plain-page/']) {
    await v.goto(BASE + u);
    await v.waitForTimeout(250);
  }
  await v.goto(BASE + '/');
  await v.click('#btnPlay');
  await v.keyboard.down('ArrowRight'); await v.waitForTimeout(1500); await v.keyboard.up('ArrowRight');
  const state = await v.evaluate(() => window.Razebait.getState());
  check('visitor: game plays on the live front page', ['playing', 'dead'].includes(state), state);
  await v.screenshot({path: SHOTS + '/wp-visitor-playing.png'});
  check('visitor: no console errors, JS errors or HTTP errors on any front-end page', strict.length === 0, strict.slice(0, 8));
  await vctx.close();
}

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} WordPress checks passed`);
process.exit(failed ? 1 : 0);
