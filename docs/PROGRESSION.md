# Progression, accounts and leaderboard

## Built in 2.0.0

* **Guests** play with no account. Progress lives in their browser under `localStorage['deskmanfun_save_v1']`. Loading validates every field, keeps unknown fields, and never lowers progress.
* **Accounts** are ordinary WordPress users (role: subscriber). Players can create them in the game:
  * username + email + password, after ticking the Terms of Service / Privacy Policy box (the accepted terms version is stored in user meta);
  * or Google sign-in (Google Identity Services). The ID token is verified server-side: signature via Google's `tokeninfo` endpoint, plus `aud`, `iss`, `exp` and `email_verified`.
* **Email verification**: a link with a single-use, hashed, expiring token is sent with `wp_mail()`. Until verified, the player can play and sync progress but does not appear on the leaderboard (when *Require email verification* is on).
* **Progress sync**: `GET/POST /wp-json/deskman-fun/v1/progress`. The server merges with the max/union/min rule (max unlocked level, union of completed levels, min best times), so neither side can erase progress. On sign-in the local save is uploaded and merged.
* **Leaderboard**: `POST /score` stores the best time per user and level in `{prefix}deskman_scores`. Times below a per-level minimum (75% of the test bot's time, `includes/min-times.php`) are rejected; submissions are rate-limited. `GET /leaderboard` returns the overall ranking (levels cleared, then total time) or one level's top times. `[deskman_leaderboard]` renders it server-side.
* **Seasons**: each score row has a `season` (`DESKMAN_FUN_SCORE_SEASON`). When level layouts change, the season is bumped: old rows stay in the table but only current-season rows are ranked, and a player's first new-season clear replaces their old row for that level. The browser save does the same with `statsSeason`, moving old best times to `archivedLevelStats`.
* **Security**: every state-changing request needs the `wp_rest` nonce and a logged-in user where relevant; inputs are validated and sanitized, output escaped, SQL prepared. Sign-in and registration are rate-limited per IP; registration has a honeypot field.
* **Privacy**: WordPress personal-data exporter and eraser are registered; deleting a user deletes their scores; uninstall removes the table, options and user meta.

## Known limits

* A browser can always forge a time. Minimum times and rate limits stop casual cheating, not a determined one. For prizes, record inputs and re-simulate server-side (the fixed-step engine is deterministic; `tests/physics.mjs` checks identical results across frame rates).
* Email delivery depends on the host. Use an SMTP plugin.

## Still a roadmap (deliberately not built)

| Feature | Notes |
|---|---|
| Level-selection map | UI only: replace the grid in `buildLevelGrid()`. |
| Coins | Award server-side from accepted scores; store in user meta. Never accept a coin count from the client. |
| Skins | The stickman is drawn procedurally (`drawStickman`), so a skin is data. Paid or exclusive skins must be owned server-side. |
