// Accounts, email verification, Google sign-in, leaderboard and security,
// end to end against real WordPress (run after wp-integration.mjs so the
// site is on the new plugin + theme). Usage: node wp-accounts.mjs <wp-root> <base-url>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');
const [WP, BASE] = process.argv.slice(2);
const wp = (...a) => execFileSync('php', [HERE + '/wp-helper.php', WP, ...a], {encoding: 'utf8'}).trim().split('\n').pop();
const results = [];
const check = (name, pass, detail) => { results.push(pass); console.log(pass ? 'PASS' : 'FAIL', name, pass ? '' : JSON.stringify(detail)); };

wp('clear-limits');
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 800}});
await ctx.route(/fonts\.(googleapis|gstatic)\.com|accounts\.google\.com/, r => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' ')));
const playUrl = BASE + '/';

/* ---- pages that must exist ---- */
for (const [slug, text] of [['terms', 'Fair play'], ['privacy', 'Your rights'], ['leaderboard', 'No times yet']]) {
  const r = await page.goto(BASE + '/' + slug + '/');
  const body = await page.textContent('body');
  check(`page /${slug}/ is published and complete`, r.status() === 200 && body.includes(text), r.status());
}
const footer = await page.evaluate(() => [...document.querySelectorAll('.footer-nav a')].map(a => a.textContent.trim()));
check('theme footer links Terms, Privacy and Leaderboard', ['Leaderboard', 'Terms of Service', 'Privacy Policy'].every(t => footer.includes(t)), footer);

/* ---- guest ---- */
await page.goto(playUrl + '?debug=1');
await page.waitForTimeout(300);
const guest = await page.evaluate(() => ({cfg: !!window.DESKMAN_CONFIG, line: document.getElementById('accountLine').textContent, hidden: document.getElementById('accountLine').hidden}));
check('game gets the accounts config; start screen shows "Playing as guest"', guest.cfg && !guest.hidden && guest.line.includes('Playing as guest'), guest);
await page.click('#btnPlay');
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
check('guests can play without an account', ['playing', 'dead'].includes(await page.evaluate(() => window.DeskmanFun.getState())));

/* ---- registration: terms are mandatory ---- */
await page.click('#btnAccount'); // HUD account button while playing
await page.click('#tabRegister');
await page.fill('#formRegister [name=username]', 'speedy');
await page.fill('#formRegister [name=email]', 'speedy@example.com');
await page.fill('#formRegister [name=password]', 'correct-horse-9');
await page.click('#formRegister button[type=submit]');
await page.waitForTimeout(300);
check('cannot create an account without agreeing to the terms', (await page.textContent('#acctMsg')).includes('agree'));
const termsHref = await page.evaluate(() => document.querySelector('#formRegister .lnk-terms').href);
check('terms checkbox links to the real Terms page', termsHref.endsWith('/terms/'), termsHref);
// the server enforces it too
const direct = await page.evaluate(async () => { const c = window.DESKMAN_CONFIG; const r = await fetch(c.restUrl + 'register', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-WP-Nonce':c.nonce}, body: JSON.stringify({username:'sneaky', email:'sneaky@example.com', password:'12345678abc', agree:false})}); return {status: r.status, body: await r.json()}; });
check('server rejects registration without agreement', direct.status === 400 && direct.body.code === 'terms_required', direct);

await page.check('#formRegister [name=agree]');
await page.click('#formRegister button[type=submit]');
await page.waitForFunction(() => document.getElementById('acctUser') && !document.getElementById('acctUser').hidden, null, {timeout: 8000});
const u1 = JSON.parse(wp('user', 'speedy@example.com'));
check('account created as a subscriber, unverified, terms acceptance recorded', u1 && u1.role.includes('subscriber') && !Number(u1.verified) && u1.terms && u1.terms.version, u1);
check('signed-in view asks to verify the email', await page.isVisible('#acctVerify'));

/* ---- verification email ---- */
const mails = JSON.parse(wp('mail-log'));
const mail = mails.find(m => m.to === 'speedy@example.com');
const link = mail && (mail.message.match(/https?:\/\/\S+deskman_verify\S+/) || [])[0];
check('verification email sent with a link', !!link, mails);
// a not-yet-verified player is kept off the leaderboard
const early = await page.evaluate(async () => { const c = window.DESKMAN_CONFIG; const r = await fetch(c.restUrl + 'score', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-WP-Nonce':window.DeskmanFun.debug.nonce()}, body: JSON.stringify({level:1, timeMs:9000, deaths:0})}); return {status: r.status, code: (await r.json()).code}; });
check('unverified players cannot post scores (403 not_verified, not a nonce error)', early.status === 403 && early.code === 'not_verified', early);
const meNow = await page.evaluate(async () => { const c = window.DESKMAN_CONFIG; const r = await fetch(c.restUrl + 'progress', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-WP-Nonce':window.DeskmanFun.debug.nonce()}, body: JSON.stringify({progress:{unlockedLevel:2, completedLevels:[1], totalDeaths:3}})}); return r.status; });
check('the nonce issued at sign-up works for the next request', meNow === 200, meNow);
const tampered = link.replace(/t=([^&]+)/, 't=WRONGTOKEN');
await page.goto(tampered);
check('a tampered verification link is refused', page.url().includes('deskman_verified=invalid'), page.url());
await page.goto(link);
check('verification link verifies and returns to the game', page.url().includes('deskman_verified=ok'), page.url());
await page.waitForTimeout(700);
check('player sees "Email verified" in the game', (await page.textContent('#toastMsg')).includes('verified'));
check('account is verified in the database', Number(JSON.parse(wp('user', 'speedy@example.com')).verified) === 1);

/* ---- clear a level -> leaderboard ---- */
await page.goto(playUrl + '?debug=1');
await page.click('#btnPlay');
await page.waitForTimeout(1300); // floor for plausible times is 1s in the test site
await page.evaluate(() => { const D = window.DeskmanFun.debug; const ls = D.level(); ls.goal.x = ls.player.x - 18; ls.goal.y = ls.player.y - 38; });
await page.waitForTimeout(1500);
const scores = JSON.parse(wp('scores'));
check('clearing a level while signed in stores a leaderboard time', scores.length === 1 && Number(scores[0].level_id) >= 1, scores);
await page.goto(BASE + '/leaderboard/');
check('public leaderboard page lists the player', (await page.textContent('.dgm-lb-table')).includes('speedy'));
await page.goto(playUrl + '?debug=1');
await page.click('#btnBoardStart');
await page.waitForSelector('#boardBody tr');
const row = await page.evaluate(() => ({text: document.querySelector('#boardBody tr').textContent, me: document.querySelector('#boardBody tr').classList.contains('is-me')}));
check('in-game leaderboard shows the player, highlighted as "you"', row.text.includes('speedy') && row.me, row);
await page.click('#btnCloseBoard');

/* ---- upgrading from 2.0.x: old-map times are kept but not ranked ---- */
const speedyId = JSON.parse(wp('user', 'speedy@example.com')).id;
wp('legacy-scores-table', String(speedyId));
await page.goto(playUrl + '?debug=1'); // any request runs the upgrade
const legacy = JSON.parse(wp('scores'));
check('upgrade adds the season column and keeps old times (season 1)', legacy.length === 1 && Number(legacy[0].season) === 1 && Number(legacy[0].best_time_ms) === 2000 && JSON.parse(wp('option', 'deskman_fun_db_version')) === '2', legacy);
const lb3 = await page.evaluate(async () => (await (await fetch(window.DESKMAN_CONFIG.restUrl + 'leaderboard?level=3')).json()).rows.length);
check('old-map times are not ranked on the new leaderboard', lb3 === 0, lb3);
const resub = await page.evaluate(async () => { const c = window.DESKMAN_CONFIG; const r = await fetch(c.restUrl + 'score', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json', 'X-WP-Nonce': window.DeskmanFun.debug.nonce()}, body: JSON.stringify({level:3, timeMs:60000, deaths:2})}); return {status: r.status, body: await r.json()}; });
const after = JSON.parse(wp('scores')).find(r => Number(r.level_id) === 3);
const lb3b = await page.evaluate(async () => (await (await fetch(window.DESKMAN_CONFIG.restUrl + 'leaderboard?level=3')).json()).rows);
check('first clear on the new map replaces the old time and is ranked', resub.status === 200 && resub.body.personalBest === true && Number(after.season) === 2 && Number(after.best_time_ms) === 60000 && Number(after.clears) === 1 && lb3b.length === 1 && lb3b[0].timeMs === 60000, {resub, after, lb3b});

/* ---- cheating and abuse ---- */
const cheat = await page.evaluate(async () => { const c = window.DESKMAN_CONFIG; const post = async (b, n) => (await fetch(c.restUrl + 'score', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json', ...(n ? {'X-WP-Nonce': window.DeskmanFun.debug.nonce()} : {})}, body: JSON.stringify(b)})).status;
  return {noNonce: await post({level:2, timeMs:90000, deaths:1}, false), tooFast: await post({level:2, timeMs:10, deaths:0}, true), badLevel: await post({level:99, timeMs:90000, deaths:0}, true)}; });
check('score API: no nonce → 403, impossible time → 400, unknown level → 400', cheat.noNonce === 403 && cheat.tooFast === 400 && cheat.badLevel === 400, cheat);

/* ---- sign out / sign in ---- */
await page.click('#accountLine .link-btn');
await page.click('#btnSignOut');
await page.waitForFunction(() => !document.getElementById('acctGuest').hidden);
check('sign out returns to guest mode', (await page.textContent('#accountLine')).includes('guest'));
await page.click('#tabSignIn');
await page.fill('#formSignIn [name=login]', 'speedy@example.com');
await page.fill('#formSignIn [name=password]', 'wrong-password');
await page.click('#formSignIn button[type=submit]');
await page.waitForTimeout(600);
check('wrong password is refused with a clear message', (await page.textContent('#acctMsg')).includes('Wrong'));
await page.fill('#formSignIn [name=password]', 'correct-horse-9');
await page.click('#formSignIn button[type=submit]');
await page.waitForFunction(() => !document.getElementById('acctUser').hidden, null, {timeout: 8000});
check('sign in with email + password works', (await page.textContent('#acctName')) === 'speedy');
await page.click('#btnSignOut');
await page.waitForFunction(() => !document.getElementById('acctGuest').hidden);

wp('clear-limits');
let limited = 0;
for (let i = 0; i < 12; i++) {
  const st = await page.evaluate(async () => { const c = window.DESKMAN_CONFIG; return (await fetch(c.restUrl + 'login', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-WP-Nonce':window.DeskmanFun.debug.nonce()}, body: JSON.stringify({login:'speedy', password:'nope-nope'})})).status; });
  if (st === 429) limited++;
}
check('repeated wrong logins are rate-limited', limited >= 1, limited);
wp('clear-limits');

/* ---- Google sign-in ---- */
await page.goto(playUrl + '?debug=1');
await page.click('#accountLine .link-btn');
await page.evaluate(() => window.DeskmanFun.debug.google('test-google:g-123:gina@example.com:Gina <img src=x onerror=alert(1)>', false));
await page.waitForTimeout(500);
check('new Google user must agree to the terms first', await page.isVisible('#googleTerms') && !JSON.parse(wp('user', 'gina@example.com')));
await page.check('#googleAgree');
await page.click('#btnGoogleContinue');
await page.waitForFunction(() => !document.getElementById('acctUser').hidden, null, {timeout: 8000});
const g = JSON.parse(wp('user', 'gina@example.com'));
check('Google account created, verified, linked, terms recorded', g && Number(g.verified) === 1 && g.google === 'g-123' && g.terms, g);
check('HTML in the Google display name is stripped (no XSS)', !g.name.includes('<'), g.name);
await page.goto(playUrl + '?debug=1');
const adminBarForPlayer = await page.evaluate(() => !!document.getElementById('wpadminbar'));
await page.click('#accountLine .link-btn');
await page.click('#btnSignOut');
await page.waitForFunction(() => !document.getElementById('acctGuest').hidden);
await page.evaluate(() => window.DeskmanFun.debug.google('test-google:g-123:gina@example.com:Gina', false));
await page.waitForFunction(() => !document.getElementById('acctUser').hidden, null, {timeout: 8000});
check('returning Google user signs straight in (no duplicate account)', (await page.textContent('#acctName')).startsWith('Gina'));
const bad = await page.evaluate(async () => { const c = window.DESKMAN_CONFIG; return (await fetch(c.restUrl + 'google', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-WP-Nonce':window.DeskmanFun.debug.nonce()}, body: JSON.stringify({credential:'forged-token'})})).status; });
check('forged Google token is rejected', bad === 401, bad);

/* ---- privacy tools ---- */
const pt = JSON.parse(wp('privacy-tools'));
check('WordPress privacy export/erase tools include game data', pt.exporter && pt.eraser, pt);
// The stripped test build of WordPress lacks core admin-bar scripts (they 301 to HTML);
// only errors raised by the game itself count here.
const ours = errors.filter(e => /deskman-game|DeskmanFun/.test(e));
check('no JS errors from the game during account flows', ours.length === 0, ours);
check('players (subscribers) do not get the WordPress admin bar over the game', adminBarForPlayer === false, adminBarForPlayer);

await browser.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} account checks passed`);
process.exit(failed ? 1 : 0);
