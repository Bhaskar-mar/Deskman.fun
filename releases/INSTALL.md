# deskman.fun 2.0.0: install guide

Two files, both for WordPress 5.5+ and PHP 7.2+:

| File | What it is |
|---|---|
| `deskman-fun-2.0.0.zip` | **Plugin**. The game, accounts, leaderboard, and the `[deskman_game]` / `[deskman_leaderboard]` shortcodes. |
| `deskman-fun-theme-2.0.0.zip` | **Theme**. The matching site design (header, footer, pages) and a fullscreen "Game" page template. Optional, but recommended for a uniform look. |

## Upgrading an existing site (you have 1.x installed)

1. **Back up** the site (files and database).
2. **Plugin:** *Plugins → Add New → Upload Plugin*, choose `deskman-fun-2.0.0.zip`, *Install Now*, then **Replace current with uploaded**.
3. **Theme:** *Appearance → Themes → Add New → Upload Theme*, choose `deskman-fun-theme-2.0.0.zip`, then **Replace current with uploaded**.
4. Purge any page cache or CDN once, then hard-refresh the Play page (Ctrl+F5 / Cmd+Shift+R). The start screen shows **deskman.fun**.

On the next page load the plugin creates its scores table and three pages: **Terms of Service** (`/terms`), **Privacy Policy** (`/privacy`, or your existing published privacy page) and **Leaderboard** (`/leaderboard`). Pages that already exist are never overwritten. Players keep their progress.

## Fresh install

1. Upload and **activate the plugin**. It creates `/play` (and makes it the homepage if none is set), plus the pages above.
2. Upload and **activate the theme**.
3. To show the game elsewhere: `[deskman_game]` (inline), `[deskman_game fullscreen="yes"]`, or `[deskman_game max_width="720px"]`. The leaderboard: `[deskman_leaderboard]`.

## Before you go live (important)

1. **Review the Terms and Privacy pages.** They are sensible templates, not legal advice. Add your contact details and anything your jurisdiction requires. Players must accept them to create an account.
2. **Make email work.** Verification emails use WordPress's `wp_mail()`. Many hosts drop PHP mail, so install an SMTP plugin (e.g. WP Mail SMTP) and send a test email. Without working email, players cannot verify, and (with *Require email verification* on) cannot appear on the leaderboard. They can still play and sync progress.
3. **Allow sign-ups.** Registration in the game works even if *Settings → General → Anyone can register* is off; turn it off under *Settings → deskman.fun → Allow registration* if you want to close it.
4. **Google sign-in (optional).** In Google Cloud Console, create an OAuth client of type *Web application*, add your site address (exactly as shown on *Settings → deskman.fun*) as an *Authorised JavaScript origin*, and paste the client ID into *Settings → deskman.fun*. The Google button appears only once a client ID is saved. HTTPS is required.

## Settings → deskman.fun

* Google client ID
* Allow registration (on by default)
* Require email verification for the leaderboard (on by default)
* Reset leaderboard (deletes all scores; asks for confirmation)

## Rolling back

Upload the previous ZIPs the same way and choose *Replace current with uploaded*. The original v1.2.0 files are `deskman-fun.zip` and `deskman-fun-theme.zip` at the repository root. The scores table and pages stay but are unused. Players' browser progress is not affected.

## Controls

* **Keyboard:** ← → or A D to move. ↑, W or Space to jump (hold for higher). R restarts the level, Esc pauses. After a level clear, the next level starts by itself; press Jump to go straight away.
* **Touch:** the on-screen ← → pad and JUMP button. Turning the phone sideways gives a bigger view.
