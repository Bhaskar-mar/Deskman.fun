=== deskman.fun — Rage-Bait Platformer ===
Contributors: deskmanfun
Tags: game, html5, canvas, platformer, shortcode
Requires at least: 5.5
Tested up to: 6.6
Requires PHP: 7.2
Stable tag: 2.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed the deskman.fun stickman rage-bait platformer on any post or page with a simple shortcode.

== Description ==

deskman.fun is a minimalist 2D rage-bait platformer: a procedurally-animated stickman, physics-based momentum,
moving/disappearing platforms, hidden traps, and thirty short levels that ramp from easy to near-impossible, designed to teach a lesson, break it, and teach it again. Everything
runs client-side on HTML5 Canvas. Guests play without an account; their progress and settings are saved in the
browser (localStorage). Players who want to appear on the leaderboard can create an account (username + email,
with email verification) or sign in with Google. Accounts are ordinary WordPress users with the Subscriber role.

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

* Use the shortcode once per page. Only the first instance renders; later ones output an HTML comment.
* `max_width` accepts a single CSS length (e.g. `960px`, `80%`, `60rem`, `90vw`). Other values fall back to `960px`.
* When embedded inline, the game only captures the keyboard after a visitor clicks it, and never inside form fields,
  so the rest of the page (scrolling, comment forms) keeps working.
* Sound is synthesized in the browser (no audio files). Music, haptics (on supporting mobile devices) and save
  data work identically to the standalone version.
* `[deskman_leaderboard]` renders the leaderboard as a plain table on any page (the plugin creates a Leaderboard
  page on activation).

= Accounts, email and Google sign-in =

* Settings → deskman.fun: Google client ID, allow registration, require email verification, reset leaderboard.
* Verification emails use `wp_mail()`. Many hosts do not deliver PHP mail reliably; install an SMTP plugin.
* Google sign-in appears only after you add a Google OAuth "Web application" client ID; the settings page lists
  the exact origin to authorise.
* On activation the plugin creates Terms of Service and Privacy Policy pages (and reuses your existing published
  privacy page). They are templates: review them before going live. Players must accept them to create an account.
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
with a mouse. In portrait the controls sit in their own band below the play area so they never cover the game;
in landscape they are translucent and the camera keeps the start and exit clear of them.

== Changelog ==

= 2.0.1 =
* New start screen: illustrated background (mountains, spikes, saw, goal flag), bolder logo, larger running
  stickman, icon buttons and keycap-style controls. Respects reduced-motion settings.

= 2.0.0 =
* Renamed to deskman.fun everywhere (plugin, theme, game, pages).
* Levels 9–30 rebuilt and much harder: spikes that rise under your landing, crumbling pillars, pop-up spike rows,
  reversed controls, lowering spiked ceilings, falling stalactites. Re-ordered by measured difficulty; every level
  and checkpoint is verified completable by the test bot.
* Accounts: in-game sign-in and registration (WordPress users), email verification, optional Google sign-in,
  Terms/Privacy agreement required, progress synced and merged (never lowered).
* Leaderboard: per-level best times and an overall ranking, server-side storage, minimum-time checks and rate limits.
* Level clear no longer shows a popup: a short banner, then the next level starts (press Jump to skip ahead).
* Fix: the stickman's arms bent the wrong way, so he looked like he was running backwards.
* New sound effects and music.
* Privacy: personal-data exporter and eraser; deleting a user removes their scores; uninstall removes all plugin data.

= 1.6.0 =
* Fix: respawning at a checkpoint no longer leaves traps behind you un-sprung (in level 8 a rushing spike could
  wait, unfired, exactly where you have to stand). Every checkpoint in all 30 levels is now verified to lead to a
  completable run.
* Fix: a player squeezed between a ground edge and a returning moving platform is lifted onto the surface instead
  of being left slightly inside the ground.
* Level Select opens scrolled to your current level.
* Phones held upright get a one-time tip to turn sideways for a bigger view.

= 1.5.0 =
* 22 new levels: 30 in total, ordered by measured difficulty, across seven tiers (Easy, Medium, Hard, Brutal,
  Insane, Impossible, Devil). Level 30, "Deskman", is the finale.
* New precision obstacle: islands (gap, narrow pillar, gap).
* Level Select scrolls to fit 30 levels on any screen; difficulty tags are colour-coded by tier.
* Every level is verified beatable by automated play-throughs; checkpoints in all long non-chase levels.
* Saved progress carries over: anyone who has cleared level 8 finds level 9 unlocked.

= 1.4.0 =
* Three new levels, each harder than the last: 6 "Slide" (hard), 7 "Panic" (brutal), 8 "The Devil" (impossible).
* New traps: floors that slide away as you approach, spikes that rush at you, and low ceilings lined with spikes
  that punish full jumps (tap jump to get through).
* Difficulty labels (Easy → Impossible) in the level intro and on the Level Select tiles.
* Levels 2, 3 and 4 retuned so difficulty rises steadily from level to level.
* Players who already finished all five original levels find level 6 unlocked; Play continues there.
* HUD buttons stay readable over dark scenery.

= 1.3.0 =
* Five redesigned levels (Trust, Disappearing Floor, Hidden, Don't Stop, Trust Nothing) with checkpoints, a chasing
  wall, crushers, hidden spikes and deceptive exits. Every level is verified completable by automated play-throughs.
* Physics: fixed 120 Hz simulation (identical at any refresh rate), no more falling through rising platforms or
  getting stuck in geometry, variable jump height, crush detection.
* Instant retries: auto-respawn after 0.6 s (skip with Jump or a tap) instead of a "press any key" prompt.
* Inline embeds now work: the game no longer locks page scrolling, takes over the viewport, or swallows keys typed
  into forms. All CSS is scoped to the game.
* Mobile: bigger view in portrait with a dedicated control band, slide-between d-pad, multi-touch jump, safe-area
  support, fullscreen button for inline embeds.
* Level select and settings now open correctly from the start screen (they previously rendered behind it).
* Fullscreen game sits below the admin bar for logged-in users.
* Security: `max_width` is validated as a single CSS length.
* Existing player progress (browser save) is kept; progress is never lowered.

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
