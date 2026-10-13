#!/usr/bin/env bash
# Assemble the WordPress plugin and theme from src/ and zip them into dist/.
# The game engine (JS, CSS, markup) lives once in src/game/ and is copied
# into both packages here. The original uploaded ZIPs in the repo root are
# never touched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"; DIST="$ROOT/dist"
VERSION="$(sed -n 's/^ \* Version: *//p' "$SRC/plugin/deskman-fun/deskman-fun.php" | tr -d '[:space:]')"
THEME_VERSION="$(sed -n 's/^Version: *//p' "$SRC/theme/deskman-fun-theme/style.css" | tr -d '[:space:]')"

rm -rf "$DIST"; mkdir -p "$DIST/build" "$DIST/preview"

copy_game(){ # $1 = package dir
  mkdir -p "$1/assets/js" "$1/assets/css"
  cp "$SRC/game/deskman-game.js" "$1/assets/js/deskman-game.js"
  cp "$SRC/game/deskman-game.css" "$1/assets/css/deskman-game.css"
  cp "$SRC/game/game-markup.html" "$1/assets/game-markup.html"
}

cp -R "$SRC/plugin/deskman-fun" "$DIST/build/deskman-fun"
copy_game "$DIST/build/deskman-fun"
cp -R "$SRC/theme/deskman-fun-theme" "$DIST/build/deskman-fun-theme"
copy_game "$DIST/build/deskman-fun-theme"

( cd "$DIST/build" && zip -qr -X "$DIST/deskman-fun-$VERSION.zip" deskman-fun \
  && zip -qr -X "$DIST/deskman-fun-theme-$THEME_VERSION.zip" deskman-fun-theme )

# Standalone preview pages used by the browser tests (not shipped).
MARKUP="$(cat "$SRC/game/game-markup.html")"
for mode in full embed; do
  if [ "$mode" = full ]; then WRAP='dgm-wrap dgm-wrap-full'; STYLE=''; else WRAP='dgm-wrap dgm-wrap-embed'; STYLE='max-width:960px;margin:0 auto;'; fi
  cat > "$DIST/preview/$mode.html" <<HTML
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Razebait preview ($mode)</title>
<style>body{font-family:Georgia,serif;margin:0;padding:16px;background:#faf7f0;color:#222}.btn{border:1px solid #888}*{box-sizing:content-box}</style>
<link rel="stylesheet" href="../build/deskman-fun/assets/css/deskman-game.css">
<script>window.RAZEBAIT_DEBUG = /[?&]debug=1/.test(location.search);</script>
</head><body>
<h1>Host page heading</h1><p class="host-p">Text above the game. <button class="btn" id="hostBtn">host button</button></p>
<div id="deskman-fun-root"><div class="$WRAP" style="$STYLE">
$MARKUP
</div></div>
<p>Text below the game.</p><textarea id="comment" rows="3" cols="40"></textarea>
<div style="height:1500px"></div>
<script src="../build/deskman-fun/assets/js/deskman-game.js"></script>
</body></html>
HTML
done

echo "Built:"; ls -1 "$DIST"/*.zip
