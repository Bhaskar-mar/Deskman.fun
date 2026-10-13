# Razebait — deskman.fun

A short, surprise-driven stickman platformer delivered as a WordPress plugin (`deskman-fun`, shortcode `[deskman_game]`) and a matching theme (`deskman-fun-theme`).

## Repository layout

| Path | Purpose |
|---|---|
| `deskman-fun.zip`, `deskman-fun-theme.zip` | The original uploaded v1.2.0 packages. **Kept unchanged** for reference and rollback. |
| `src/game/` | **Single source of truth for the game**: `deskman-game.js` (engine and levels), `deskman-game.css` (UI), `game-markup.html` (DOM). |
| `src/plugin/deskman-fun/` | Plugin PHP (shortcode, activation, uninstall). |
| `src/theme/deskman-fun-theme/` | Theme PHP/CSS (fullscreen game template, site templates). |
| `tools/build.sh` | Copies `src/game/*` into both packages and builds the ZIPs into `dist/`. |
| `tests/` | Browser tests (Playwright) and the WordPress end-to-end test. |
| `docs/` | `AUDIT.md` (initial audit), `LEVELS.md` (level guide), `PROGRESSION.md` (accounts, coins, leaderboard roadmap). |

## Build the plugin and theme ZIPs

```bash
./tools/build.sh
# → dist/deskman-fun-1.3.0.zip
# → dist/deskman-fun-theme-1.3.0.zip
```

The script needs only `bash`, `zip` and `sed`. Each ZIP contains a single top-level folder (`deskman-fun/` and `deskman-fun-theme/`), which is the layout WordPress expects for uploads. `dist/` is git-ignored.

## Install or upgrade on WordPress

Back up the site (files and database) first. Then:

1. **Plugin.** Go to *Plugins → Add New → Upload Plugin* and choose `deskman-fun-1.3.0.zip`. WordPress offers *Replace current with uploaded*; accept it.
2. **Theme** (if you use it). Go to *Appearance → Themes → Add New → Upload Theme* and choose `deskman-fun-theme-1.3.0.zip`, then *Replace current with uploaded*.
3. Hard-refresh the Play page. Assets are versioned `?ver=1.3.0`, so browser and CDN caches pick up the new files. If you run a page-cache plugin, purge it once.

Upgrade notes:
* Nothing in the database needs migrating. Activation and self-heal logic is unchanged and does not run again on update. The `/play` page and front-page setting are left as they are.
* Player progress lives in each visitor's browser under the same key as v1.2.0, so it carries over. Loading never lowers progress.
* The shortcode and its attributes are unchanged. `max_width` now only accepts a single CSS length (`960px`, `80%`, `60rem`, `90vw`); anything else falls back to `960px`.
* Only one game renders per page. A second `[deskman_game]` on the same page outputs an HTML comment instead.
* The theme now includes `singular.php` and `comments.php`. Ordinary pages and posts show their full content, so `[deskman_game]` works inline on any page. Previously the theme showed only excerpts, which strip shortcodes.
* When both plugin and theme are active, the plugin's copy of the game files is used (shared asset handle). Both packages ship identical files.

Rollback: upload the original `deskman-fun.zip` / `deskman-fun-theme.zip` from this repository the same way.

## Develop and test

```bash
./tools/build.sh                  # always rebuild before testing
node tests/run-all.mjs            # play-throughs, traps, physics, browser integration (108 checks)
npx eslint src/game               # lint (config in eslint.config.mjs)
```

Open `dist/preview/full.html` or `dist/preview/embed.html` in a browser to play without WordPress. Add `?debug=1` to expose the deterministic test hooks (`window.Razebait.debug`). The hooks are off unless `window.RAZEBAIT_DEBUG === true` is set before the script loads; WordPress pages never set it.

WordPress end-to-end test (real WordPress + SQLite + PHP built-in server):

```bash
tests/wordpress/setup-wp.sh <wordpress-core-dir> <sqlite-database-integration-dir> /tmp/wp 8088
php -S 127.0.0.1:8088 -t /tmp/wp /tmp/wp/.router.php &
node tests/wordpress/wp-integration.mjs /tmp/wp http://127.0.0.1:8088   # 26 checks
```

The setup installs the **original v1.2.0** ZIPs. The test then upgrades them in place to `dist/`, so it exercises the real upgrade path.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Move | ← → or A D | Hold the ← → pad (slide between them) |
| Jump | ↑, W or Space (hold for higher) | JUMP button |
| Restart level | R | ↻ button |
| Pause | Esc or P | ❚❚ button |
| Skip respawn wait | Jump | Jump, or tap the game |

On a page where the game is embedded inline, keys are only captured after you click or tap the game. Clicking anywhere else on the page releases them, and text fields are never intercepted.
