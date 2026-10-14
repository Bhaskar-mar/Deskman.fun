# deskman.fun (deskman.fun) — Repository Audit

Audit of the code as uploaded in commit `0a62631` (plugin and theme v1.2.0), done before any changes.

## 1. What is in the repository

| Path | What it is |
|---|---|
| `deskman-fun.zip` | WordPress **plugin** `deskman-fun` v1.2.0 (5 files). Kept unchanged. |
| `deskman-fun-theme.zip` | WordPress **theme** `deskman-fun-theme` v1.2.0 (8 files). Kept unchanged. |

There were no source files outside the ZIPs. They are now extracted into `src/plugin/` and `src/theme/` so they can be edited and diffed.

### Plugin (`deskman-fun`)
* `deskman-fun.php`: activation creates a `/play` page containing `[deskman_game fullscreen="yes"]`, trashes untouched sample content, sets the page as the front page on first run only, and shows an admin notice. Registers assets and the `[deskman_game]` shortcode (`fullscreen`, `max_width`). The game's HTML lives in a PHP nowdoc.
* `uninstall.php`: removes the plugin's options and the Play page, but only if the page was never edited.
* `assets/js/deskman-game.js` (1,570 lines): **the whole game engine**.
* `assets/css/deskman-game.css`: game UI styles.

### Theme (`deskman-fun-theme`)
* `functions.php`: the same activation and self-heal logic as the plugin, with theme-prefixed options. Adopts or creates `/play` with the `Game (Fullscreen)` template and enqueues the game assets only on that template.
* `page-templates/game-fullscreen.php`: a bare HTML page with a **second hand-copied copy of the game markup**.
* `index.php`, `header.php`, `footer.php`, `style.css`: a minimal cream, black and red site theme.
* `assets/js/deskman-game.js` and `assets/css/deskman-game.css`: **byte-identical duplicates** of the plugin's copies.

### How they work together
* Theme only: the `/play` page uses the theme template, which prints its own markup and loads the theme's copy of the assets.
* Plugin only, with any theme: the shortcode prints the markup and lazily enqueues the plugin's assets.
* Both active: both register the handle `deskman-fun-game`. The plugin registers first (priority 10), so WordPress uses the plugin's file URL even on the theme template. Because the files were identical, this was harmless. Now that there is one source copied into both packages, it stays harmless.

## 2. Engine architecture (`deskman-game.js`)

| System | Implementation |
|---|---|
| Rendering | One 2D `<canvas>` with a world of 1600×900 units, scaled to the stage, with DPR support. Parallax hills and a procedural stickman with jointed limbs. |
| Loop | `setInterval(tick, 16)` with variable `dt` capped at 1/30 s, plus a `requestAnimationFrame` loop that does nothing. |
| Physics | Separate-axis AABB moves with acceleration and deceleration, coyote time (0.1 s) and a jump buffer (0.12 s). There is no variable jump height. |
| Collision | Uses the player's previous edge but the solid's *current* position. Horizontal hits shallower than 14 px are skipped. |
| Entities | Platforms (`solid`, `disappearing`, `moving`, `invisible`), hazards (`spike`, `hiddenSpike`, `saw`, `fallingCeiling`, `pit`), triggers, and goals (`normal`, `tease`, `fake`). |
| Levels | 5 data-driven levels in `LEVELS`. |
| Input | Global `window` keydown and keyup listeners; Pointer Events on the touch buttons. |
| UI | DOM HUD and overlays (win, pause, settings, level select, start screen). |
| Audio | Synthesized WebAudio (no files). Music is random sine notes from `setInterval`. |
| Save | `localStorage['deskmanfun_save_v1']` = `{unlockedLevel, completedLevels, totalDeaths, settings}`. |

## 3. Bugs and risks found

Bugs marked "observed" were reproduced in headless Chromium against the original files.

### Critical (WordPress integration)
1. **The inline embed takes over the whole page (observed).** The CSS sets `html,body{overflow:hidden;touch-action:none;user-select:none}` globally, and `#app` is `position:fixed; inset:0` in every mode. `[deskman_game]` without `fullscreen` covers the viewport, and the host page cannot scroll at all. There is no `.dgm-wrap-embed` CSS.
2. **Keyboard hijacking (observed).** The global keydown handler calls `preventDefault()` on Space, Arrow keys and W/A/D everywhere. Typing "wasd jump" into a comment box on the same page produced "sjump". Any key also counts as "retry".
3. **Global script scope.** Top-level `const canvas`, `ctx`, `save`, `keys` and so on are shared with every other classic script on the page. A theme or plugin declaring the same names throws `SyntaxError` and one of the two scripts dies.
4. **CSS leaks.** Unscoped `*{}`, `:root`, `[hidden]`, `.btn`, `.card`, `.overlay` and `.switch` rules restyle unrelated theme elements.
5. **`max_width` shortcode attribute is not validated.** `esc_attr` allows `;`, so an author can inject arbitrary inline CSS. This is low impact because only editors can use it, but it is wrong.
6. **Shortcode pages render empty under this theme.** The theme has no `page.php` or `singular.php`, so pages fall back to `index.php`, which prints `the_excerpt()`. Excerpts strip shortcodes.
7. The fullscreen template prints its own `<title>` while `title-tag` support also prints one, so the page has two `<title>` elements.

### Physics and gameplay
8. **Frame-rate-dependent physics.** Variable `dt` and the `setInterval` timer are not synced to display refresh. Below 30 fps the game runs in slow motion, and jump arcs vary slightly with frame rate.
9. **Falling through rising platforms.** The landing test compares the player's previous bottom with the platform's *current* top. A platform rising more than 2 px per frame (110 px/s at about 50 fps or lower) drops the player through.
10. **Getting stuck inside geometry.** Horizontal overlaps shallower than 14 px are ignored, and the vertical pass only resolves "from above" or "from below". A short step or a corner clip can leave the player embedded.
11. **Falling ceilings are harmless while falling.** They only become lethal once they come to rest, so being crushed mid-fall does nothing and then a block suddenly kills you.
12. No variable jump height, so releasing jump early does nothing. Keys stay stuck after window blur or tab switch.
13. A blocking "PRESS ANY KEY TO RETRY" prompt appears after every death, so retry is not immediate.

### Mobile and responsive
14. **Portrait phones render the world at about 0.24 scale (observed).** The stickman is about 15 px tall, and the touch buttons cover the ground and the player.
15. The canvas is resized only on `window.resize`, not when its container changes (embeds, orientation, address-bar collapse).

### Audio and performance
16. An AudioContext is created and notes are scheduled before any user gesture (music `setInterval` at boot). The intro-stickman `setInterval` runs forever, even after the start screen is gone. There is an empty rAF loop.

### Found later, during testing against real WordPress
19. **LEVELS and SETTINGS on the start screen open *behind* it (observed in the v1.2.0 build).** `#startScreen` has z-index 20 and the overlays have none, so the buttons appear to do nothing.
20. For logged-in users, the fullscreen game is covered by the WordPress admin bar (`position:fixed; inset:0` ignores the 32px/46px bar).

### Duplicates and obsolete code
17. The JS, CSS and markup are each duplicated in the plugin and the theme. Unused code: `reverseControls`, `gravityFlip`, `THEME_BG` cave/city/factory, `p.usedBufferedJump`, `.annot`, `.small-hint`, and the "Introduction 1–3" stepper (3 steps for a 5-level game).
18. Death particles are green, which is off-palette for a cream, black and red identity.

### Missing assets
* None. Audio is synthesized, and the only external resource is Google Fonts, which falls back to system fonts.

## 4. Changes made

All items above are addressed. Details are in the commit history, `README.md` and `docs/LEVELS.md`.

* **Single source of truth.** `src/game/` holds the engine JS, CSS and markup. `tools/build.sh` copies them into both packages and builds the ZIPs into `dist/`. The original ZIPs are untouched.
* **Engine (kept, not replaced).** Same canvas renderer, procedural stickman, data-driven level schema, DOM UI, synthesized audio and save key. Changes:
  * wrapped in an IIFE;
  * rAF with a fixed-step simulation at 120 Hz;
  * collision against previous platform positions, a depenetration pass and a crush check;
  * variable jump height;
  * auto-respawn with checkpoints;
  * generic trigger actions, a chaser hazard, and crushers that are lethal while falling and solid once landed;
  * five redesigned levels.
* **Responsive layout.** Scoped CSS, a real inline-embed mode, a portrait framing with its own control band, camera padding so touch buttons never hide the spawn or the exit, and ResizeObserver.
* **Input.** Keys are captured only while the game is focused (or fullscreen), never inside form fields. The d-pad allows sliding between directions, and jump works with multi-touch. The game pauses on blur, on a hidden tab, or when scrolled out of view.
* **WordPress.**
  * Markup is loaded from one file, and `max_width` is validated.
  * Only one instance renders per page, and the theme and plugin share the font handle.
  * The theme gets `singular.php` and `comments.php` and loses its duplicate `<title>`.
  * The fullscreen game respects the admin bar.
  * Version 1.3.0 for cache busting.
* **Save data.** The `deskmanfun_save_v1` key and fields are preserved. Loading validates the fields, keeps unknown ones, and never lowers progress. New per-level stats are stored next to the existing fields.

Progression features (map, coins, skins, accounts, leaderboard) are deliberately **not** faked. See `docs/PROGRESSION.md`.
