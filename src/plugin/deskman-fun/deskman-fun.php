<?php
/**
 * Plugin Name:       deskman.fun — Razebait Rage-Bait Platformer
 * Plugin URI:        https://deskman.fun
 * Description:       Embeds the deskman.fun stickman platformer via the [deskman_game] shortcode. Use fullscreen="yes" for a dedicated play page, or omit it for a responsive 16:9 box that sits inline in a post or page.
 * Version:           1.4.0
 * Requires at least: 5.5
 * Requires PHP:      7.2
 * Author:            deskman.fun
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       deskman-fun
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'DESKMAN_FUN_VERSION', '1.4.0' );
define( 'DESKMAN_FUN_URL', plugin_dir_url( __FILE__ ) );
define( 'DESKMAN_FUN_PATH', plugin_dir_path( __FILE__ ) );

/* =========================================================================
   ACTIVATION: auto-create a ready-to-play page, tidy up the stock WP
   sample content, and surface a one-time admin notice pointing at it.
========================================================================= */
register_activation_hook( __FILE__, 'deskman_fun_activate' );
function deskman_fun_activate() {
	$page_id = deskman_fun_create_play_page();
	deskman_fun_cleanup_default_content();
	deskman_fun_maybe_set_front_page( $page_id );
	update_option( 'deskman_fun_setup_done', true );
	set_transient( 'deskman_fun_activation_notice', true, 60 );
}

/**
 * Self-heal for sites that already had an earlier version of this plugin
 * active before this setup logic existed — the activation hook only fires
 * on an actual (re)activation, so simply updating the plugin's files would
 * otherwise never run it. Runs the same setup on the next admin page load,
 * but only until it has completed once (regardless of outcome), so it
 * never repeats even if a page already existed at /play.
 */
add_action( 'admin_init', 'deskman_fun_maybe_self_heal' );
function deskman_fun_maybe_self_heal() {
	if ( get_option( 'deskman_fun_setup_done' ) ) {
		return;
	}
	deskman_fun_activate();
}

/**
 * Make the Play page the site's homepage so the game is live the moment
 * activation finishes — but only the very first time, and only if the site
 * doesn't already have a static front page configured. A site with its own
 * homepage already set is never silently redirected, and once this has run
 * once we never touch the setting again, so a later deliberate change (even
 * back to the default blog view) is always respected.
 */
function deskman_fun_maybe_set_front_page( $page_id ) {
	if ( ! $page_id || get_option( 'deskman_fun_front_page_set' ) ) {
		return false;
	}
	update_option( 'deskman_fun_front_page_set', true );

	if ( 'page' === get_option( 'show_on_front' ) && (int) get_option( 'page_on_front' ) > 0 ) {
		return false; // a front page is already configured — leave it alone.
	}

	update_option( 'show_on_front', 'page' );
	update_option( 'page_on_front', $page_id );
	return true;
}

/**
 * Create a "Play" page running [deskman_game fullscreen="yes"], unless one
 * already exists — either one we made on a previous activation (tracked by
 * option) or one the site owner already has at that slug (left untouched).
 */
function deskman_fun_create_play_page() {
	$existing_id = (int) get_option( 'deskman_fun_play_page_id' );
	if ( $existing_id && 'page' === get_post_type( $existing_id ) ) {
		return $existing_id;
	}

	$found = get_page_by_path( 'play' );
	if ( $found ) {
		// Slug is already taken by something we didn't create — don't touch it.
		update_option( 'deskman_fun_play_page_id', 0 );
		return 0;
	}

	$page_id = wp_insert_post(
		array(
			'post_title'   => 'Play',
			'post_name'    => 'play',
			'post_status'  => 'publish',
			'post_type'    => 'page',
			'post_content' => '[deskman_game fullscreen="yes"]',
		),
		true
	);

	if ( $page_id && ! is_wp_error( $page_id ) ) {
		update_option( 'deskman_fun_play_page_id', $page_id );
		return $page_id;
	}

	return 0;
}

/**
 * Trash (not permanently delete) the default "Sample Page" and "Hello
 * world!" post that WordPress ships with — but only if they still hold
 * the stock placeholder text, so a site owner's own edited content is
 * never touched. Runs once; safe to activate/deactivate repeatedly.
 */
function deskman_fun_cleanup_default_content() {
	if ( get_option( 'deskman_fun_cleanup_done' ) ) {
		return;
	}

	$sample = get_page_by_path( 'sample-page' );
	if ( $sample && false !== strpos( $sample->post_content, 'This is an example page' ) ) {
		wp_trash_post( $sample->ID );
	}

	$hello = get_page_by_path( 'hello-world', OBJECT, 'post' );
	if ( $hello && false !== strpos( $hello->post_content, 'Welcome to WordPress' ) ) {
		wp_trash_post( $hello->ID );
	}

	update_option( 'deskman_fun_cleanup_done', true );
}

add_action( 'admin_notices', 'deskman_fun_activation_notice' );
function deskman_fun_activation_notice() {
	if ( ! get_transient( 'deskman_fun_activation_notice' ) ) {
		return;
	}
	delete_transient( 'deskman_fun_activation_notice' );

	$page_id = (int) get_option( 'deskman_fun_play_page_id' );
	if ( ! $page_id ) {
		echo '<div class="notice notice-warning is-dismissible"><p>'
			. esc_html__( 'deskman.fun is active, but a page at /play already existed so none was created automatically — add the [deskman_game] shortcode to a page of your choice.', 'deskman-fun' )
			. '</p></div>';
		return;
	}

	$url      = get_permalink( $page_id );
	$is_front = ( 'page' === get_option( 'show_on_front' ) && (int) get_option( 'page_on_front' ) === $page_id );

	if ( $is_front ) {
		echo '<div class="notice notice-success is-dismissible"><p>'
			. sprintf(
				/* translators: %s: the site's homepage link */
				esc_html__( 'deskman.fun is live! Your homepage now shows the game: %s', 'deskman-fun' ),
				'<a href="' . esc_url( home_url( '/' ) ) . '" target="_blank">' . esc_html( home_url( '/' ) ) . '</a>'
			)
			. '</p></div>';
	} else {
		$reading_url = admin_url( 'options-reading.php' );
		echo '<div class="notice notice-success is-dismissible"><p>'
			. sprintf(
				/* translators: 1: link to the new Play page, 2: link to Settings → Reading */
				esc_html__( 'deskman.fun is ready to play! A "Play" page was created for you: %1$s — your homepage already had a page assigned, so it was left as-is. Want visitors to land in the game instead? %2$s', 'deskman-fun' ),
				'<a href="' . esc_url( $url ) . '" target="_blank">' . esc_html( $url ) . '</a>',
				'<a href="' . esc_url( $reading_url ) . '">' . esc_html__( 'Set it as your homepage', 'deskman-fun' ) . '</a>'
			)
			. '</p></div>';
	}
}

/**
 * Quick "View Play Page" link on the Plugins list row, next to
 * Activate/Deactivate, so the game is one click away after setup.
 */
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'deskman_fun_action_links' );
function deskman_fun_action_links( $links ) {
	$page_id = (int) get_option( 'deskman_fun_play_page_id' );
	if ( $page_id && 'page' === get_post_type( $page_id ) ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( get_permalink( $page_id ) ) . '" target="_blank">' . esc_html__( 'View Play Page', 'deskman-fun' ) . '</a>'
		);
	}
	return $links;
}

/**
 * Register (but do not enqueue) the game's styles and script.
 * Enqueuing happens lazily inside the shortcode so the asset
 * weight is only paid on pages that actually embed the game.
 */
function deskman_fun_register_assets() {
	if ( wp_style_is( 'deskman-fun-game', 'registered' ) ) {
		return;
	}
	wp_register_style(
		'deskman-fun-fonts',
		'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@700&family=Inter:wght@500;600;700;800&display=swap',
		array(),
		null
	);
	wp_register_style(
		'deskman-fun-game',
		DESKMAN_FUN_URL . 'assets/css/deskman-game.css',
		array( 'deskman-fun-fonts' ),
		DESKMAN_FUN_VERSION
	);
	wp_register_script(
		'deskman-fun-game',
		DESKMAN_FUN_URL . 'assets/js/deskman-game.js',
		array(),
		DESKMAN_FUN_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'deskman_fun_register_assets' );

/**
 * Validate the max_width shortcode attribute: a single CSS length such as
 * "960px", "80%", "60rem" or "90vw". Anything else falls back to 960px so an
 * attribute can never inject additional CSS declarations.
 */
function deskman_fun_sanitize_max_width( $value ) {
	$value = strtolower( trim( (string) $value ) );
	if ( preg_match( '/^\d{1,4}(\.\d{1,2})?(px|%|rem|em|vw)$/', $value ) ) {
		return $value;
	}
	return '960px';
}

/**
 * [deskman_game] shortcode.
 *
 * Attributes:
 *   fullscreen  "yes" | "no" (default "no") — "yes" makes the game cover the
 *               entire viewport (best on a dedicated page with no other content).
 *   max_width   CSS width for the embedded box, e.g. "960px" (ignored when
 *               fullscreen="yes"). Default "960px".
 *
 * The game uses fixed element IDs, so only the first instance on a page is
 * rendered; later ones output nothing (an HTML comment explains why).
 */
function deskman_fun_shortcode( $atts ) {
	static $rendered = false;

	$atts = shortcode_atts(
		array(
			'fullscreen' => 'no',
			'max_width'  => '960px',
		),
		$atts,
		'deskman_game'
	);

	if ( $rendered ) {
		return '<!-- deskman_game: only one game instance can be shown per page. -->';
	}
	$rendered = true;

	deskman_fun_register_assets(); // in case the shortcode runs outside the normal front-end flow
	wp_enqueue_style( 'deskman-fun-fonts' );
	wp_enqueue_style( 'deskman-fun-game' );
	wp_enqueue_script( 'deskman-fun-game' );

	$is_full    = in_array( strtolower( (string) $atts['fullscreen'] ), array( 'yes', 'true', '1' ), true );
	$wrap_class = 'dgm-wrap ' . ( $is_full ? 'dgm-wrap-full' : 'dgm-wrap-embed' );
	$style      = $is_full ? '' : 'max-width:' . deskman_fun_sanitize_max_width( $atts['max_width'] ) . ';';

	ob_start();
	?>
	<div id="deskman-fun-root">
		<div class="<?php echo esc_attr( $wrap_class ); ?>" style="<?php echo esc_attr( $style ); ?>">
			<?php echo deskman_fun_game_markup(); // phpcs:ignore WordPress.Security.EscapeOutput -- static trusted markup shipped with the plugin, no user input. ?>
		</div>
	</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'deskman_game', 'deskman_fun_shortcode' );

/**
 * The game's static HTML markup (canvas, HUD, overlays, touch controls),
 * shared with the theme's fullscreen template via assets/game-markup.html.
 * It is a trusted file shipped with the plugin and contains no dynamic data.
 */
function deskman_fun_game_markup() {
	$file = DESKMAN_FUN_PATH . 'assets/game-markup.html';
	if ( ! is_readable( $file ) ) {
		return '<!-- deskman_game: assets/game-markup.html is missing. -->';
	}
	return (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local plugin file.
}
