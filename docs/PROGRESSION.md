# Progression roadmap (not built yet, by design)

This version is the gameplay upgrade. The features below were **not** implemented, because doing them client-side only would mean fake accounts, fake leaderboards, or unlocks anyone can grant themselves from the browser console. This document records what already exists to build on, and what each feature needs.

## What exists now
* **Save data** in the player's browser: `localStorage['deskmanfun_save_v1']`.
  * The original fields are kept: `unlockedLevel`, `completedLevels`, `totalDeaths`, `settings`.
  * 1.3.0 adds `version: 2` and `levelStats[levelId] = {clears, bestTime, bestDeaths}`.
  * Loading validates every field, keeps unknown fields written by other versions, and never lowers progress.
* **Level unlocks**: clearing level N unlocks N+1. The Level Select grid shows locked, cleared and current levels, plus best times.
* **Level data** is declarative (`LEVELS` in `src/game/deskman-game.js`), so adding levels is a data change.
* **Read-only JS API**, `window.Razebait`, for future integrations:
  * `version` and `levels`;
  * `getProgress()`, which returns a copy of the save;
  * `getState()`.

  It deliberately has no way to grant unlocks or currency.

## Feature by feature

| Feature | Client-only is acceptable for | Needs a server for |
|---|---|---|
| Level-selection map | Everything. It is a UI over `LEVELS` and the existing unlocks. Replace the grid in `buildLevelGrid()` with a path/map view. | — |
| Simple level unlock | Already done locally. | Cross-device sync (accounts). |
| Coins from gameplay | Displaying a local count. | Anything coins can buy, if purchases are real money or must be fair. The client can be edited. |
| Skins / cosmetics | Free cosmetics unlocked by local progress (harmless if someone cheats). | Paid or exclusive cosmetics: the entitlement must live server-side. |
| Accounts & dashboard | — | WordPress users (`wp_signon`, user meta) or a dedicated table. |
| Leaderboard | — | Server-side storage, validation and rate limiting. |

## Recommended architecture (WordPress-native)
1. **Accounts.** Use WordPress users and log in with the normal WordPress flow; don't build a separate auth system. Store progress in user meta (`deskman_fun_progress`) as JSON with the same shape as the local save.
2. **REST endpoints** under `deskman-fun/v1`, registered in the plugin.
   * `GET /progress` and `POST /progress`:
     * `permission_callback` uses `is_user_logged_in()`;
     * the request needs a `wp_rest` nonce;
     * validate the body against a schema (`args` with `validate_callback` and `sanitize_callback`).
   * Merge rule on the server: take the max of `unlockedLevel`, the union of `completedLevels`, and the min of best times. A client can then never erase progress, which is the same rule the local loader uses today.
   * `POST /runs` takes a finished-level submission `{levelId, timeMs, deaths, inputLog?}`:
     * reject impossible times (below a per-level minimum, measured with the play-through bot in `tests/playthrough.mjs`);
     * rate-limit per user with transients.
   * `GET /leaderboard?level=N` returns the top N from a custom table `{user_id, level_id, time_ms, created_at}` with an index on `(level_id, time_ms)`.
3. **Anti-cheat stance.** Times reported by a browser can always be forged. For a casual board, minimum-time checks plus rate limits are enough. For anything with prizes, record inputs and re-simulate them server-side. The fixed-step engine makes this feasible, because the simulation is deterministic for a given input sequence (`tests/physics.mjs` verifies identical results across frame rates).
4. **Coins and skins.**
   * Award coins server-side from accepted runs. Store `coins` and `owned_skins` in user meta.
   * The client only renders what the server says is owned.
   * The stickman is drawn procedurally (`drawStickman`), so a skin can be colour, line width and head/accessory shapes passed in as data.
5. **Migration.** On first login, POST the local save. The server merges it using the max/union rule above, so existing players keep their progress.

## Security checklist for that work
* Use nonces on every state-changing request, and `current_user_can` or `is_user_logged_in` in `permission_callback`.
* Sanitize every input (`absint`, `sanitize_key`, schema validation). Escape on output with `esc_html` and `esc_attr`. Use `$wpdb->prepare` for the leaderboard table.
* Never accept `coins`, `owned_skins` or `unlockedLevel` as authoritative from the client.
* Leaderboard display names: use `display_name` passed through `esc_html`. Consider a moderation flag.
