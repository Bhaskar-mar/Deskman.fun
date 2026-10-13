# Razebait 1.6.0: install guide

Two files, both for WordPress 5.5+ and PHP 7.2+:

| File | What it is |
|---|---|
| `deskman-fun-1.6.0.zip` | **Plugin**. The game itself, plus the `[deskman_game]` shortcode. |
| `deskman-fun-theme-1.6.0.zip` | **Theme**. The site design and a fullscreen "Game" page template. Optional if you use your own theme. |

## Upgrading an existing site (you have v1.x installed)

1. **Back up** the site (files and database). Most hosts do this in one click.
2. **Plugin:** go to *Plugins → Add New → Upload Plugin*, choose `deskman-fun-1.6.0.zip`, then *Install Now*. WordPress says the plugin is already installed; click **Replace current with uploaded**.
3. **Theme:** go to *Appearance → Themes → Add New → Upload Theme*, choose `deskman-fun-theme-1.6.0.zip`, then **Replace current with uploaded**.
4. If you use a caching plugin or CDN, **purge the cache** once.
5. Open your Play page and press **Ctrl+F5** (Cmd+Shift+R on Mac). The start screen shows **RAZEBAIT**, and Level Select lists 30 levels.

Nothing else changes: your `/play` page, homepage setting and shortcode stay as they are. Players keep their progress, which is saved in their own browser.

## Fresh install (new site)

1. Upload and **activate the plugin** as above. It creates a `/play` page and, if the site has no homepage set, makes it the homepage.
2. Optionally, upload and **activate the theme** for the matching look and a fullscreen game page.
3. To show the game anywhere else, add the shortcode to a page or post:
   * `[deskman_game]`: inline box that fits the content column.
   * `[deskman_game fullscreen="yes"]`: fills the whole screen (best on its own page).
   * `[deskman_game max_width="720px"]`: inline box with a custom width.

## Rolling back

Upload the previous ZIPs the same way and choose *Replace current with uploaded*. The original v1.2.0 files are `deskman-fun.zip` and `deskman-fun-theme.zip` at the repository root. Player progress is not affected.

## Controls

* **Keyboard:** ← → or A D to move. ↑, W or Space to jump (hold for higher). R restarts the level, Esc pauses.
* **Touch:** use the on-screen ← → pad and the JUMP button. Turning the phone sideways gives a bigger view.
