<?php
/**
 * deskman.fun theme functions.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DESKMAN_THEME_VERSION', '2.1.0' );

/* =========================================================================
   ACTIVATION: auto-create a ready-to-play fullscreen page, tidy up the
   stock WP sample content, and surface a one-time admin notice.
========================================================================= */
add_action( 'after_switch_theme', 'deskman_theme_activate' );
function deskman_theme_activate() {
	$page_id = deskman_theme_create_play_page();
	deskman_theme_cleanup_default_content();
	deskman_theme_maybe_set_front_page( $page_id );
	update_option( 'deskman_theme_setup_done', true );
	set_transient( 'deskman_theme_activation_notice', true, 60 );
}

/**
 * Self-heal for sites that already had an earlier version of this theme
 * active before this setup logic existed — `after_switch_theme` only fires
 * on an actual (re)activation, so simply updating the theme's files would
 * otherwise never run it. Runs the same setup on the next admin page load,
 * but only until it has completed once (regardless of outcome), so it
 * never repeats even if a page already existed at /play.
 */
add_action( 'admin_init', 'deskman_theme_maybe_self_heal' );
function deskman_theme_maybe_self_heal() {
	if ( get_option( 'deskman_theme_setup_done' ) ) {
		return;
	}
	deskman_theme_activate();
}

/**
 * Make the Play page the site's homepage so the game is live the moment
 * activation finishes — but only the very first time, and only if the site
 * doesn't already have a static front page configured. A site with its own
 * homepage already set is never silently redirected, and once this has run
 * once we never touch the setting again, so a later deliberate change (even
 * back to the default blog view) is always respected.
 */
function deskman_theme_maybe_set_front_page( $page_id ) {
	if ( ! $page_id || get_option( 'deskman_theme_front_page_set' ) ) {
		return false;
	}
	update_option( 'deskman_theme_front_page_set', true );

	if ( 'page' === get_option( 'show_on_front' ) && (int) get_option( 'page_on_front' ) > 0 ) {
		return false; // a front page is already configured — leave it alone.
	}

	update_option( 'show_on_front', 'page' );
	update_option( 'page_on_front', $page_id );
	return true;
}

/**
 * Create (or adopt) a "Play" page running the Game (Fullscreen) template.
 * If a page at that slug already exists — ours from a previous activation,
 * the plugin's shortcode page, or the site owner's own page — we just make
 * sure it uses our template when it has no template of its own; we never
 * overwrite a template the site owner deliberately chose.
 */
function deskman_theme_create_play_page() {
	$template = 'page-templates/game-fullscreen.php';

	$existing_id = (int) get_option( 'deskman_theme_play_page_id' );
	if ( $existing_id && 'page' === get_post_type( $existing_id ) ) {
		return $existing_id;
	}

	$found = get_page_by_path( 'play' );
	if ( $found ) {
		$current_template = get_post_meta( $found->ID, '_wp_page_template', true );
		if ( empty( $current_template ) || 'default' === $current_template ) {
			update_post_meta( $found->ID, '_wp_page_template', $template );
		}
		update_option( 'deskman_theme_play_page_id', $found->ID );
		return $found->ID;
	}

	$page_id = wp_insert_post(
		array(
			'post_title'  => 'Play',
			'post_name'   => 'play',
			'post_status' => 'publish',
			'post_type'   => 'page',
		),
		true
	);

	if ( $page_id && ! is_wp_error( $page_id ) ) {
		update_post_meta( $page_id, '_wp_page_template', $template );
		update_option( 'deskman_theme_play_page_id', $page_id );
		return $page_id;
	}

	return 0;
}

/**
 * Trash (not permanently delete) the default "Sample Page" and "Hello
 * world!" post — only if they still hold the stock WP placeholder text,
 * so a site owner's own edited content is never touched.
 */
function deskman_theme_cleanup_default_content() {
	if ( get_option( 'deskman_theme_cleanup_done' ) ) {
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

	update_option( 'deskman_theme_cleanup_done', true );
}

add_action( 'admin_notices', 'deskman_theme_activation_notice' );
function deskman_theme_activation_notice() {
	if ( ! get_transient( 'deskman_theme_activation_notice' ) ) {
		return;
	}
	delete_transient( 'deskman_theme_activation_notice' );

	$page_id = (int) get_option( 'deskman_theme_play_page_id' );
	if ( ! $page_id ) {
		return;
	}

	$url      = get_permalink( $page_id );
	$is_front = ( 'page' === get_option( 'show_on_front' ) && (int) get_option( 'page_on_front' ) === $page_id );

	if ( $is_front ) {
		echo '<div class="notice notice-success is-dismissible"><p>'
			. sprintf(
				/* translators: %s: the site's homepage link */
				esc_html__( 'deskman.fun is live! Your homepage now shows the game: %s', 'deskman-fun-theme' ),
				'<a href="' . esc_url( home_url( '/' ) ) . '" target="_blank">' . esc_html( home_url( '/' ) ) . '</a>'
			)
			. '</p></div>';
	} else {
		$reading_url = admin_url( 'options-reading.php' );
		echo '<div class="notice notice-success is-dismissible"><p>'
			. sprintf(
				/* translators: 1: link to the new Play page, 2: link to Settings → Reading */
				esc_html__( 'deskman.fun theme is active! Your fullscreen Play page is ready: %1$s — your homepage already had a page assigned, so it was left as-is. Want visitors to land in the game instead? %2$s', 'deskman-fun-theme' ),
				'<a href="' . esc_url( $url ) . '" target="_blank">' . esc_html( $url ) . '</a>',
				'<a href="' . esc_url( $reading_url ) . '">' . esc_html__( 'Set it as your homepage', 'deskman-fun-theme' ) . '</a>'
			)
			. '</p></div>';
	}
}

/**
 * Basic theme setup.
 */
function deskman_theme_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption' ) );
	register_nav_menus(
		array(
			'primary' => __( 'Primary Menu', 'deskman-fun-theme' ),
		)
	);
}
add_action( 'after_setup_theme', 'deskman_theme_setup' );

/**
 * Site-wide stylesheet (header/footer/typography for normal pages).
 * The game's own CSS/JS are enqueued separately, only on the fullscreen
 * Game template, so ordinary pages never pay for game asset weight.
 *
 * The font handle matches the plugin's ('deskman-fun-fonts') so pages that
 * load both never request the Google Fonts stylesheet twice.
 */
function deskman_theme_assets() {
	if ( ! wp_style_is( 'deskman-fun-fonts', 'registered' ) ) {
		wp_register_style(
			'deskman-fun-fonts',
			'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@700&family=Inter:wght@500;600;700;800&display=swap',
			array(),
			null
		);
	}
	wp_enqueue_style( 'deskman-fun-fonts' );
	wp_enqueue_style( 'deskman-theme-style', get_stylesheet_uri(), array( 'deskman-fun-fonts' ), DESKMAN_THEME_VERSION );
}
add_action( 'wp_enqueue_scripts', 'deskman_theme_assets' );

/**
 * Register the fullscreen Game page template so it's selectable from
 * Page Attributes in the block/classic editor.
 */
function deskman_register_page_templates( $templates ) {
	$templates['page-templates/game-fullscreen.php'] = __( 'Game (Fullscreen)', 'deskman-fun-theme' );
	return $templates;
}
add_filter( 'theme_page_templates', 'deskman_register_page_templates' );

/**
 * Enqueue the game's own assets, but only when the fullscreen Game
 * template is actually being rendered. If the deskman.fun plugin is active
 * it has already registered these handles, and its (identical or newer)
 * copy is used; otherwise the theme's bundled copy is registered here.
 */
function deskman_maybe_enqueue_game_assets() {
	if ( ! is_page_template( 'page-templates/game-fullscreen.php' ) ) {
		return;
	}
	if ( ! wp_style_is( 'deskman-fun-game', 'registered' ) ) {
		wp_register_style(
			'deskman-fun-game',
			get_template_directory_uri() . '/assets/css/deskman-game.css',
			array( 'deskman-fun-fonts' ),
			DESKMAN_THEME_VERSION
		);
	}
	if ( ! wp_script_is( 'deskman-fun-game', 'registered' ) ) {
		wp_register_script(
			'deskman-fun-game',
			get_template_directory_uri() . '/assets/js/deskman-game.js',
			array(),
			DESKMAN_THEME_VERSION,
			true
		);
	}
	wp_enqueue_style( 'deskman-fun-game' );
	wp_enqueue_script( 'deskman-fun-game' );
}
add_action( 'wp_enqueue_scripts', 'deskman_maybe_enqueue_game_assets', 20 );

/**
 * The game's static markup, shared with the plugin via assets/game-markup.html.
 */
function deskman_theme_game_markup() {
	$file = get_template_directory() . '/assets/game-markup.html';
	if ( ! is_readable( $file ) ) {
		return '<!-- deskman.fun: assets/game-markup.html is missing. -->';
	}
	return (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local theme file.
}

/* =========================================================================
   Navigation helpers (work with or without the deskman.fun plugin)
========================================================================= */
function deskman_theme_page_url_from( $options ) {
	foreach ( (array) $options as $option ) {
		$id = (int) get_option( $option );
		if ( $id && 'publish' === get_post_status( $id ) ) {
			return get_permalink( $id );
		}
	}
	return '';
}

function deskman_theme_play_url() {
	$url = deskman_theme_page_url_from( array( 'deskman_theme_play_page_id', 'deskman_fun_play_page_id' ) );
	return $url ? $url : home_url( '/' );
}

/** Default header links when no menu is assigned to the Primary location. */
function deskman_theme_default_nav() {
	$links = array(
		array( 'url' => deskman_theme_play_url(), 'label' => __( 'Play', 'deskman-fun-theme' ) ),
	);
	$board = deskman_theme_page_url_from( array( 'deskman_fun_leaderboard_page_id' ) );
	if ( $board ) {
		$links[] = array( 'url' => $board, 'label' => __( 'Leaderboard', 'deskman-fun-theme' ) );
	}
	echo '<ul class="menu">';
	foreach ( $links as $l ) {
		echo '<li><a href="' . esc_url( $l['url'] ) . '">' . esc_html( $l['label'] ) . '</a></li>';
	}
	echo '</ul>';
}

function deskman_theme_footer_links() {
	$links = array();
	$map   = array(
		array( array( 'deskman_fun_leaderboard_page_id' ), __( 'Leaderboard', 'deskman-fun-theme' ) ),
		array( array( 'deskman_fun_terms_page_id' ), __( 'Terms of Service', 'deskman-fun-theme' ) ),
		array( array( 'deskman_fun_privacy_page_id', 'wp_page_for_privacy_policy' ), __( 'Privacy Policy', 'deskman-fun-theme' ) ),
	);
	foreach ( $map as $m ) {
		$url = deskman_theme_page_url_from( $m[0] );
		if ( $url ) {
			$links[] = array( 'url' => $url, 'label' => $m[1] );
		}
	}
	return $links;
}

