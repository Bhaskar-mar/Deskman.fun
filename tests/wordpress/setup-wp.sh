#!/usr/bin/env bash
# Prepare a throwaway WordPress (SQLite) install for wp-integration.mjs.
# Usage: setup-wp.sh <wordpress-core-dir> <sqlite-integration-plugin-dir> <target-dir> [port]
# The core dir is an extracted WordPress release; the SQLite dir is the
# "SQLite Database Integration" plugin. Installs the ORIGINAL v1.2.0 plugin
# and theme from the repo-root ZIPs so the test can exercise the upgrade.
set -euo pipefail
CORE="$1"; SQLITE="$2"; T="$3"; PORT="${4:-8088}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
rm -rf "$T"; cp -R "$CORE" "$T"
rm -rf "$T/wp-content/plugins/sqlite-database-integration"; cp -R "$SQLITE" "$T/wp-content/plugins/sqlite-database-integration"
sed -e "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$T/wp-content/plugins/sqlite-database-integration#" \
    -e "s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" \
    "$T/wp-content/plugins/sqlite-database-integration/db.copy" > "$T/wp-content/db.php"
[ -f "$T/wp-config.php" ] || cp "$T/wp-config-sample.php" "$T/wp-config.php"
grep -q "DB_ENGINE" "$T/wp-config.php" || sed -i "s#define( 'WP_DEBUG', false );#define( 'WP_DEBUG', true );\ndefine( 'WP_DEBUG_LOG', __DIR__ . '/wp-content/debug.log' );\ndefine( 'WP_DEBUG_DISPLAY', false );\ndefine( 'DB_ENGINE', 'sqlite' );#" "$T/wp-config.php"
rm -rf "$T/wp-content/database"; mkdir -p "$T/wp-content/database"
php -r '
define("WP_INSTALLING", true);
$_SERVER["HTTP_HOST"] = "127.0.0.1:'"$PORT"'"; $_SERVER["REQUEST_URI"] = "/";
require "'"$T"'/wp-load.php";
require_once ABSPATH . "wp-admin/includes/upgrade.php";
wp_install("deskman.fun Test", "admin", "admin@example.com", true, "", "admin-test-pass");
update_option("siteurl", "http://127.0.0.1:'"$PORT"'"); update_option("home", "http://127.0.0.1:'"$PORT"'");
update_option("permalink_structure", "/%postname%/");
echo "WordPress ", $GLOBALS["wp_version"], " installed\n";' 2>&1 | grep -v sendmail
unzip -q -o "$REPO/deskman-fun.zip" -d "$T/wp-content/plugins"
unzip -q -o "$REPO/deskman-fun-theme.zip" -d "$T/wp-content/themes"
cat > "$T/.router.php" <<'PHP'
<?php
$root = $_SERVER['DOCUMENT_ROOT'];
$path = parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
if ( $path !== '/' && file_exists( $root . $path ) && ! is_dir( $root . $path ) ) {
	if ( substr( $path, -4 ) === '.php' ) { chdir( dirname( $root . $path ) ); require $root . $path; return true; }
	return false;
}
if ( is_dir( $root . $path ) && file_exists( rtrim( $root . $path, '/' ) . '/index.php' ) ) { chdir( rtrim( $root . $path, '/' ) ); require rtrim( $root . $path, '/' ) . '/index.php'; return true; }
chdir( $root ); require $root . '/index.php';
PHP
echo "Start the server with: php -S 127.0.0.1:$PORT -t $T $T/.router.php"
