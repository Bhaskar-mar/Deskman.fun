=== deskman.fun — Rage-Bait Platformer ===
Contributors: deskmanfun
Tags: game, html5, canvas, platformer, shortcode
Requires at least: 5.5
Tested up to: 6.6
Requires PHP: 7.2
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed the deskman.fun stickman rage-bait platformer on any post or page with a simple shortcode.

== Description ==

deskman.fun is a minimalist 2D rage-bait platformer: a procedurally-animated stickman, physics-based momentum,
moving/disappearing platforms, and levels designed to teach a lesson, break it, and teach it again. Everything
runs client-side on HTML5 Canvas — no external API calls, no server requirement beyond serving the files, and
progress/settings are saved in the player's browser (localStorage).

This plugin embeds the game via a shortcode, so you can drop it into any page or post on an existing WordPress
site without changing your theme.

= Usage =

Inline, responsive 16:9 box (default — fits inside your page's content column):

`[deskman_game]`

Full viewport takeover (best on a dedicated, otherwise-empty page):

`[deskman_game fullscreen="yes"]`

Custom width for the inline box:

`[deskman_game max_width="720px"]`

= Notes =

* Use the shortcode once per page. The game's internal element IDs are fixed, so two instances on the same
  page will collide with each other.
* All five levels, sound (synthesized, no audio files), music, haptics (on supporting mobile devices), and
  save data work identically to the standalone version.
* Sound and vibration require a user gesture to start (a browser requirement, not a bug) — the Play button
  click satisfies this.

== Installation ==

1. Upload the `deskman-fun` folder to `/wp-content/plugins/`, or upload the zip via Plugins → Add New → Upload Plugin.
2. Activate the plugin through the 'Plugins' menu in WordPress. On activation, the plugin automatically:
   * Creates a "Play" page (`/play`) already containing `[deskman_game fullscreen="yes"]` — ready to open immediately.
   * Moves WordPress's stock "Sample Page" and "Hello world!" post to the Trash, but only if they're still untouched
     (never edited) — nothing you've customized is ever removed, and everything lands in Trash, not permanently deleted.
   * Shows a one-time notice linking straight to your new Play page.
3. Want the game somewhere else too? Add the `[deskman_game]` shortcode to any other page or post.

If a page at `/play` already existed before activating, the plugin leaves it alone and shows a notice asking you
to add the shortcode yourself — it never overwrites existing content.

== Frequently Asked Questions ==

= Does this need an active internet connection to play? =

Only to load the page and the one Google Fonts stylesheet the first time; after that, all gameplay, sound, and
physics run entirely client-side.

= Can I use this with the block editor? =

Yes — use the Shortcode block and paste `[deskman_game]` (or `[deskman_game fullscreen="yes"]`).

= Does it work on mobile? =

Yes. Touch controls (left / right / jump) appear automatically on touch devices and stay hidden on devices
with a mouse, so desktop and mobile both get the right control scheme without any configuration.

== Changelog ==

= 1.2.0 =
* Activation now sets the new "/play" page as the site's homepage automatically (only if the site doesn't already
  have a static front page configured), so the game is genuinely live the moment activation finishes.
* Added a self-healing check so a site that already had an earlier version of this plugin active gets the same
  setup retroactively, without needing to deactivate/reactivate — just updating the plugin's files is enough.

= 1.1.0 =
* On activation: auto-creates a ready-to-play "/play" page, trashes WordPress's untouched default sample content,
  shows a one-time setup notice, and adds a "View Play Page" link to the Plugins list.
* Uninstalling the plugin (via Delete, not just Deactivate) cleans up its own settings, and removes the Play page
  only if its content was never edited.
* New hazard mechanics (moving saw, falling ceiling, non-lethal reactive traps) and rebuilt Levels 2 & 3.

= 1.0.0 =
* Initial release: 5 levels, shortcode embed (inline or fullscreen), full save/settings support.
