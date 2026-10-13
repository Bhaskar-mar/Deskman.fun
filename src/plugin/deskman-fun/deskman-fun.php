<?php
/**
 * Plugin Name:       deskman.fun — Rage-Bait Platformer
 * Plugin URI:        https://deskman.fun
 * Description:       Embeds the deskman.fun stickman platformer via the [deskman_game] shortcode. Use fullscreen="yes" for a dedicated play page, or omit it for a responsive 16:9 box that sits inline in a post or page.
 * Version:           1.2.0
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

define( 'DESKMAN_FUN_VERSION', '1.2.0' );
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
	wp_register_style(
		'deskman-fun-fonts',
		'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@600;700&family=Inter:wght@500;600;700;800&display=swap',
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
 * [deskman_game] shortcode.
 *
 * Attributes:
 *   fullscreen  "yes" | "no" (default "no") — "yes" makes the game cover the
 *               entire viewport (best on a dedicated page with no other content).
 *   max_width   CSS width for the embedded box, e.g. "960px" (ignored when
 *               fullscreen="yes"). Default "960px".
 *
 * Note: this shortcode is designed for ONE instance per page — the game's
 * internal element IDs are fixed, so using it twice on the same page will
 * cause ID collisions. Use it on its own page/post for best results.
 */
function deskman_fun_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'fullscreen' => 'no',
			'max_width'  => '960px',
		),
		$atts,
		'deskman_game'
	);

	wp_enqueue_style( 'deskman-fun-fonts' );
	wp_enqueue_style( 'deskman-fun-game' );
	wp_enqueue_script( 'deskman-fun-game' );

	$is_full    = in_array( strtolower( $atts['fullscreen'] ), array( 'yes', 'true', '1' ), true );
	$wrap_class = 'dgm-wrap ' . ( $is_full ? 'dgm-wrap-full' : 'dgm-wrap-embed' );
	$style      = $is_full ? '' : 'max-width:' . esc_attr( $atts['max_width'] ) . ';margin:0 auto;';

	ob_start();
	?>
	<div id="deskman-fun-root">
		<div class="<?php echo esc_attr( $wrap_class ); ?>" style="<?php echo esc_attr( $style ); ?>">
			<?php echo deskman_fun_game_markup(); // phpcs:ignore WordPress.Security.EscapeOutput -- static trusted markup, no user input. ?>
		</div>
	</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'deskman_game', 'deskman_fun_shortcode' );

/**
 * The game's static HTML markup (canvas, HUD, overlays, touch controls).
 * Kept as a single trusted nowdoc — there is no dynamic/user data inside it.
 */
function deskman_fun_game_markup() {
	return <<<'HTML'
<div id="app">
  <div id="stage">
    <canvas id="gameCanvas"></canvas>

    <div id="hud">
      <div class="intro-stepper" id="introStepper">
        <div class="step" data-n="1"><span class="dot">1</span><span class="label">Introduction 1</span></div>
        <div class="step-line"></div>
        <div class="step" data-n="2"><span class="dot">2</span><span class="label">Introduction 2</span></div>
        <div class="step-line"></div>
        <div class="step" data-n="3"><span class="dot">3</span><span class="label">Introduction 3</span></div>
      </div>
      <div class="hud-top">
        <div class="logo">
          <div class="title">deskman<span>.fun</span></div>
          <div class="tagline">RUN. FAIL. REPEAT.</div>
        </div>
        <div class="level-card" id="levelCard">
          <div class="lvl" id="levelLabel">LEVEL 1</div>
          <div class="sub" id="levelSub">Tutorial Lies</div>
          <div class="badge">REVERSE CONTROLS</div>
        </div>
        <div class="top-buttons">
          <button class="icon-btn" id="btnRestart" title="Restart">&#8635;</button>
          <button class="icon-btn" id="btnSettings" title="Settings">&#9881;</button>
          <button class="icon-btn" id="btnPause" title="Pause">&#10074;&#10074;</button>
        </div>
      </div>
      <div class="progress-pill"><span id="progressText">1 / 5</span><span class="deaths" id="deathsText">Deaths: 0</span></div>
      <div class="world-toast" id="worldToast"><span class="w1" id="worldToastSub">WORLD 1</span><span id="worldToastMain">TRUST</span></div>
      <div class="toast-msg" id="toastMsg"></div>
    </div>

    <div class="controls">
      <div class="dpad">
        <button class="ctrl-btn" id="btnLeft">&#8592;</button>
        <button class="ctrl-btn" id="btnRight">&#8594;</button>
      </div>
      <button class="jump-btn" id="btnJump">&#8593;<span>JUMP</span></button>
    </div>

    <!-- Death prompt: non-modal, gameplay stays visible behind it -->
    <div class="death-prompt" id="deathPrompt">PRESS ANY KEY TO RETRY</div>

    <!-- Win overlay -->
    <div class="overlay dim" id="winOverlay">
      <div class="card">
        <h2 id="winTitle">Level Complete!</h2>
        <p class="msg" id="winMsg">&nbsp;</p>
        <p class="msg" id="winStats" style="display:none;font-size:12px;color:#888;margin-top:-8px;"></p>
        <div class="row">
          <button class="btn primary" id="btnNext">NEXT LEVEL &#8594;</button>
          <button class="btn ghost" id="btnReplay">REPLAY</button>
          <button class="btn ghost" id="btnWinMenu" hidden>LEVEL SELECT</button>
        </div>
      </div>
    </div>

    <!-- Pause overlay -->
    <div class="overlay dim" id="pauseOverlay">
      <div class="card">
        <h2>Paused</h2>
        <div class="row" style="margin-top:10px;flex-direction:column;">
          <button class="btn primary" id="btnResume">RESUME</button>
          <button class="btn ghost" id="btnPauseRestart">RESTART LEVEL</button>
          <button class="btn ghost" id="btnPauseSettings">SETTINGS</button>
          <button class="btn ghost" id="btnPauseMenu">LEVEL SELECT</button>
        </div>
      </div>
    </div>

    <!-- Settings overlay -->
    <div class="overlay dim" id="settingsOverlay">
      <div class="card">
        <h2>Settings</h2>
        <div class="settings-list">
          <div class="setting-row">Sound Effects <div class="switch" data-setting="sound"><div class="knob"></div></div></div>
          <div class="setting-row">Music <div class="switch" data-setting="music"><div class="knob"></div></div></div>
          <div class="setting-row">Vibration <div class="switch" data-setting="vibration"><div class="knob"></div></div></div>
          <div class="setting-row">Reduced Motion <div class="switch" data-setting="reducedMotion"><div class="knob"></div></div></div>
        </div>
        <button class="btn primary" id="btnCloseSettings">DONE</button>
      </div>
    </div>

    <!-- Level select / menu -->
    <div class="overlay dim" id="menuOverlay">
      <div class="card" style="max-width:420px;">
        <h2>Select Level</h2>
        <div class="level-select-grid" id="levelGrid"></div>
        <button class="btn ghost" id="btnCloseMenu">CLOSE</button>
      </div>
    </div>

    <!-- Start screen -->
    <div id="startScreen">
      <div class="bigtitle">deskman<span>.fun</span></div>
      <div class="bigtag">RUN. FAIL. REPEAT.</div>
      <canvas id="introCanvas" width="200" height="90" style="margin-top:14px;"></canvas>
      <div class="menu-row">
        <button class="btn primary" id="btnPlay">PLAY</button>
        <button class="btn ghost" id="btnLevelSelectStart">LEVELS</button>
        <button class="btn ghost" id="btnSettingsStart">SETTINGS</button>
      </div>
    </div>
  </div>
</div>
HTML;
}
