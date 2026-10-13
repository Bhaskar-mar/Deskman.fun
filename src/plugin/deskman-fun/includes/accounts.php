<?php
/**
 * Player accounts, email verification, Google sign-in, progress sync and the
 * leaderboard. Accounts are ordinary WordPress users (role: subscriber), so
 * passwords, sessions and cookies use WordPress core.
 *
 * REST namespace: deskman-fun/v1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DESKMAN_FUN_DB_VERSION', '1' );
define( 'DESKMAN_FUN_TERMS_VERSION', '2026-10' );
define( 'DESKMAN_FUN_LEVEL_COUNT', 30 );

/* -------------------------------------------------------------------------
 * Settings helpers
 * ---------------------------------------------------------------------- */
function deskman_fun_settings() {
	$defaults = array(
		'google_client_id'      => '',
		'allow_registration'    => 1,
		'require_verification'  => 1,
	);
	$saved = get_option( 'deskman_fun_settings', array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
}

function deskman_fun_scores_table() {
	global $wpdb;
	return $wpdb->prefix . 'deskman_scores';
}

/* -------------------------------------------------------------------------
 * Database table (created on activation and on upgrade)
 * ---------------------------------------------------------------------- */
function deskman_fun_install_db() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$table   = deskman_fun_scores_table();
	$charset = $wpdb->get_charset_collate();
	dbDelta(
		"CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			level_id smallint(5) unsigned NOT NULL,
			best_time_ms int(10) unsigned NOT NULL,
			best_deaths int(10) unsigned NOT NULL DEFAULT 0,
			clears int(10) unsigned NOT NULL DEFAULT 1,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY user_level (user_id,level_id),
			KEY level_time (level_id,best_time_ms)
		) {$charset};"
	);
	update_option( 'deskman_fun_db_version', DESKMAN_FUN_DB_VERSION );
}

/* -------------------------------------------------------------------------
 * Small utilities
 * ---------------------------------------------------------------------- */
function deskman_fun_client_ip() {
	// REMOTE_ADDR only: forwarded headers are trivially spoofable.
	return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0.0.0.0';
}

/**
 * Simple fixed-window rate limit backed by transients.
 * Returns true when the action is allowed (and counts it).
 */
function deskman_fun_rate_limit( $action, $key, $max, $window ) {
	$tkey  = 'dmf_rl_' . md5( $action . '|' . $key );
	$count = (int) get_transient( $tkey );
	if ( $count >= $max ) {
		return false;
	}
	set_transient( $tkey, $count + 1, $window );
	return true;
}

function deskman_fun_error( $code, $message, $status = 400 ) {
	return new WP_Error( $code, $message, array( 'status' => $status ) );
}

function deskman_fun_is_verified( $user_id ) {
	return (bool) get_user_meta( $user_id, 'deskman_verified', true );
}

/** Public, minimal description of the current player (never includes secrets). */
function deskman_fun_me() {
	$user = wp_get_current_user();
	if ( ! $user || ! $user->exists() ) {
		return array( 'loggedIn' => false );
	}
	return array(
		'loggedIn' => true,
		'id'       => (int) $user->ID,
		'name'     => $user->display_name,
		'email'    => $user->user_email,
		'verified' => deskman_fun_is_verified( $user->ID ),
		'google'   => (bool) get_user_meta( $user->ID, 'deskman_google_sub', true ),
		'progress' => deskman_fun_get_progress( $user->ID ),
	);
}

/* -------------------------------------------------------------------------
 * Progress (merged, never lowered)
 * ---------------------------------------------------------------------- */
function deskman_fun_get_progress( $user_id ) {
	$p = get_user_meta( $user_id, 'deskman_progress', true );
	return is_array( $p ) ? $p : array( 'unlockedLevel' => 1, 'completedLevels' => array(), 'totalDeaths' => 0 );
}

function deskman_fun_merge_progress( $a, $b ) {
	$levels = array_values(
		array_unique(
			array_filter(
				array_map( 'absint', array_merge( (array) ( $a['completedLevels'] ?? array() ), (array) ( $b['completedLevels'] ?? array() ) ) ),
				function ( $n ) {
					return $n >= 1 && $n <= DESKMAN_FUN_LEVEL_COUNT;
				}
			)
		)
	);
	sort( $levels );
	return array(
		'unlockedLevel'   => min( DESKMAN_FUN_LEVEL_COUNT, max( 1, absint( $a['unlockedLevel'] ?? 1 ), absint( $b['unlockedLevel'] ?? 1 ) ) ),
		'completedLevels' => $levels,
		'totalDeaths'     => max( absint( $a['totalDeaths'] ?? 0 ), absint( $b['totalDeaths'] ?? 0 ) ),
	);
}

/* -------------------------------------------------------------------------
 * Email verification
 * ---------------------------------------------------------------------- */
function deskman_fun_send_verification( $user_id ) {
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return false;
	}
	$token = wp_generate_password( 32, false, false );
	update_user_meta( $user_id, 'deskman_verify_hash', wp_hash( $token ) );
	update_user_meta( $user_id, 'deskman_verify_expires', time() + 2 * DAY_IN_SECONDS );

	$link    = add_query_arg(
		array(
			'deskman_verify' => 1,
			'u'              => $user_id,
			't'              => $token,
		),
		home_url( '/' )
	);
	$site    = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
	/* translators: %s: site name */
	$subject = sprintf( __( 'Verify your email for %s', 'deskman-fun' ), $site );
	$body    = sprintf(
		/* translators: 1: player name, 2: site name, 3: verification link */
		__( "Hi %1\$s,\n\nThanks for signing up to %2\$s. Confirm your email address to appear on the leaderboard:\n\n%3\$s\n\nThis link expires in 48 hours. If you did not create this account, ignore this email.\n", 'deskman-fun' ),
		$user->display_name,
		$site,
		$link
	);
	return wp_mail( $user->user_email, $subject, $body );
}

/** Handles the link from the verification email (?deskman_verify=1&u=..&t=..). */
function deskman_fun_handle_verify_link() {
	if ( empty( $_GET['deskman_verify'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- the token itself is the proof.
		return;
	}
	$user_id = isset( $_GET['u'] ) ? absint( $_GET['u'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
	$token   = isset( $_GET['t'] ) ? sanitize_text_field( wp_unslash( $_GET['t'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
	$hash    = $user_id ? get_user_meta( $user_id, 'deskman_verify_hash', true ) : '';
	$expires = $user_id ? (int) get_user_meta( $user_id, 'deskman_verify_expires', true ) : 0;
	$result  = 'invalid';
	if ( $user_id && deskman_fun_is_verified( $user_id ) ) {
		$result = 'already';
	} elseif ( $hash && $token && hash_equals( $hash, wp_hash( $token ) ) ) {
		if ( $expires >= time() ) {
			update_user_meta( $user_id, 'deskman_verified', 1 );
			delete_user_meta( $user_id, 'deskman_verify_hash' );
			delete_user_meta( $user_id, 'deskman_verify_expires' );
			$result = 'ok';
		} else {
			$result = 'expired';
		}
	}
	$target = deskman_fun_play_url();
	wp_safe_redirect( add_query_arg( 'deskman_verified', $result, $target ) );
	exit;
}
add_action( 'template_redirect', 'deskman_fun_handle_verify_link', 1 );

function deskman_fun_play_url() {
	$play = (int) get_option( 'deskman_fun_play_page_id' );
	if ( ! $play ) {
		$play = (int) get_option( 'deskman_theme_play_page_id' );
	}
	return $play ? get_permalink( $play ) : home_url( '/' );
}

/* -------------------------------------------------------------------------
 * Google sign-in: verify an ID token from Google Identity Services.
 * Returns array( sub, email, name ) or WP_Error. Filterable for tests.
 * ---------------------------------------------------------------------- */
function deskman_fun_verify_google_token( $credential ) {
	$pre = apply_filters( 'deskman_fun_pre_verify_google_token', null, $credential );
	if ( null !== $pre ) {
		return $pre;
	}
	$client_id = deskman_fun_settings()['google_client_id'];
	if ( ! $client_id ) {
		return deskman_fun_error( 'google_disabled', __( 'Google sign-in is not configured.', 'deskman-fun' ), 400 );
	}
	$response = wp_remote_get( 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode( $credential ), array( 'timeout' => 8 ) );
	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return deskman_fun_error( 'google_invalid', __( 'Google sign-in could not be verified. Please try again.', 'deskman-fun' ), 401 );
	}
	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	$iss  = $data['iss'] ?? '';
	if ( ! is_array( $data )
		|| ( $data['aud'] ?? '' ) !== $client_id
		|| ! in_array( $iss, array( 'accounts.google.com', 'https://accounts.google.com' ), true )
		|| (int) ( $data['exp'] ?? 0 ) < time()
		|| 'true' !== (string) ( $data['email_verified'] ?? '' )
		|| empty( $data['sub'] ) || ! is_email( $data['email'] ?? '' ) ) {
		return deskman_fun_error( 'google_invalid', __( 'Google sign-in could not be verified. Please try again.', 'deskman-fun' ), 401 );
	}
	return array(
		'sub'   => sanitize_text_field( $data['sub'] ),
		'email' => sanitize_email( $data['email'] ),
		'name'  => sanitize_text_field( $data['name'] ?? '' ),
	);
}

/* -------------------------------------------------------------------------
 * REST API
 * ---------------------------------------------------------------------- */
function deskman_fun_check_nonce( WP_REST_Request $req ) {
	$nonce = $req->get_header( 'x_wp_nonce' );
	return ( $nonce && wp_verify_nonce( $nonce, 'wp_rest' ) ) ? true : deskman_fun_error( 'bad_nonce', __( 'Your session expired. Reload the page and try again.', 'deskman-fun' ), 403 );
}
function deskman_fun_require_login( WP_REST_Request $req ) {
	$n = deskman_fun_check_nonce( $req );
	if ( is_wp_error( $n ) ) {
		return $n;
	}
	return is_user_logged_in() ? true : deskman_fun_error( 'not_logged_in', __( 'Please sign in first.', 'deskman-fun' ), 401 );
}

/*
 * REST nonces are tied to the session token in the logged_in cookie. When a
 * request signs someone in or out, keep $_COOKIE in step with the cookie being
 * sent back, so the fresh nonce matches the session the browser will use next.
 */
add_action( 'set_logged_in_cookie', function ( $logged_in_cookie ) {
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		$_COOKIE[ LOGGED_IN_COOKIE ] = $logged_in_cookie;
	}
} );
add_action( 'clear_auth_cookie', function () {
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		unset( $_COOKIE[ LOGGED_IN_COOKIE ] );
	}
} );

/** Response for any auth change: the new user state plus a fresh nonce. */
function deskman_fun_auth_response( $user_id ) {
	wp_set_current_user( $user_id );
	return rest_ensure_response(
		array(
			'me'    => deskman_fun_me(),
			'nonce' => wp_create_nonce( 'wp_rest' ),
		)
	);
}

function deskman_fun_register_routes() {
	$ns = 'deskman-fun/v1';
	register_rest_route( $ns, '/me', array(
		'methods'             => 'GET',
		'callback'            => function () {
			return rest_ensure_response( deskman_fun_me() );
		},
		'permission_callback' => '__return_true',
	) );
	register_rest_route( $ns, '/register', array(
		'methods'             => 'POST',
		'callback'            => 'deskman_fun_rest_register',
		'permission_callback' => 'deskman_fun_check_nonce',
		'args'                => array(
			'username' => array( 'type' => 'string', 'required' => true ),
			'email'    => array( 'type' => 'string', 'required' => true ),
			'password' => array( 'type' => 'string', 'required' => true ),
			'agree'    => array( 'type' => 'boolean', 'required' => true ),
		),
	) );
	register_rest_route( $ns, '/login', array(
		'methods'             => 'POST',
		'callback'            => 'deskman_fun_rest_login',
		'permission_callback' => 'deskman_fun_check_nonce',
		'args'                => array(
			'login'    => array( 'type' => 'string', 'required' => true ),
			'password' => array( 'type' => 'string', 'required' => true ),
		),
	) );
	register_rest_route( $ns, '/logout', array(
		'methods'             => 'POST',
		'callback'            => function () {
			wp_logout();
			return deskman_fun_auth_response( 0 );
		},
		'permission_callback' => 'deskman_fun_require_login',
	) );
	register_rest_route( $ns, '/google', array(
		'methods'             => 'POST',
		'callback'            => 'deskman_fun_rest_google',
		'permission_callback' => 'deskman_fun_check_nonce',
		'args'                => array( 'credential' => array( 'type' => 'string', 'required' => true ) ),
	) );
	register_rest_route( $ns, '/verify/resend', array(
		'methods'             => 'POST',
		'callback'            => 'deskman_fun_rest_resend',
		'permission_callback' => 'deskman_fun_require_login',
	) );
	register_rest_route( $ns, '/progress', array(
		'methods'             => 'POST',
		'callback'            => 'deskman_fun_rest_progress',
		'permission_callback' => 'deskman_fun_require_login',
	) );
	register_rest_route( $ns, '/score', array(
		'methods'             => 'POST',
		'callback'            => 'deskman_fun_rest_score',
		'permission_callback' => 'deskman_fun_require_login',
		'args'                => array(
			'level'  => array( 'type' => 'integer', 'required' => true ),
			'timeMs' => array( 'type' => 'integer', 'required' => true ),
			'deaths' => array( 'type' => 'integer', 'required' => true ),
		),
	) );
	register_rest_route( $ns, '/leaderboard', array(
		'methods'             => 'GET',
		'callback'            => 'deskman_fun_rest_leaderboard',
		'permission_callback' => '__return_true',
		'args'                => array( 'level' => array( 'type' => 'integer', 'required' => false ) ),
	) );
}
add_action( 'rest_api_init', 'deskman_fun_register_routes' );

function deskman_fun_rest_register( WP_REST_Request $req ) {
	$s = deskman_fun_settings();
	if ( empty( $s['allow_registration'] ) ) {
		return deskman_fun_error( 'registration_closed', __( 'New accounts are currently closed.', 'deskman-fun' ), 403 );
	}
	if ( '' !== trim( (string) $req->get_param( 'website' ) ) ) { // honeypot field, invisible to people
		return deskman_fun_error( 'spam', __( 'Registration failed.', 'deskman-fun' ) );
	}
	if ( ! deskman_fun_rate_limit( 'register', deskman_fun_client_ip(), 5, HOUR_IN_SECONDS ) ) {
		return deskman_fun_error( 'rate_limited', __( 'Too many attempts. Please wait a while and try again.', 'deskman-fun' ), 429 );
	}
	if ( true !== $req->get_param( 'agree' ) ) {
		return deskman_fun_error( 'terms_required', __( 'Please agree to the Terms of Service and Privacy Policy.', 'deskman-fun' ) );
	}
	$username = sanitize_user( (string) $req->get_param( 'username' ), true );
	$email    = sanitize_email( (string) $req->get_param( 'email' ) );
	$password = (string) $req->get_param( 'password' );
	if ( strlen( $username ) < 3 || strlen( $username ) > 30 ) {
		return deskman_fun_error( 'bad_username', __( 'Choose a username of 3 to 30 letters or numbers.', 'deskman-fun' ) );
	}
	if ( username_exists( $username ) ) {
		return deskman_fun_error( 'username_taken', __( 'That username is taken.', 'deskman-fun' ) );
	}
	if ( ! is_email( $email ) ) {
		return deskman_fun_error( 'bad_email', __( 'Enter a valid email address.', 'deskman-fun' ) );
	}
	if ( email_exists( $email ) ) {
		return deskman_fun_error( 'email_taken', __( 'An account with that email already exists. Try signing in.', 'deskman-fun' ) );
	}
	if ( strlen( $password ) < 8 ) {
		return deskman_fun_error( 'weak_password', __( 'Use a password of at least 8 characters.', 'deskman-fun' ) );
	}
	$user_id = wp_insert_user(
		array(
			'user_login'   => $username,
			'user_email'   => $email,
			'user_pass'    => $password,
			'display_name' => $username,
			'role'         => 'subscriber',
		)
	);
	if ( is_wp_error( $user_id ) ) {
		return deskman_fun_error( 'register_failed', $user_id->get_error_message() );
	}
	update_user_meta( $user_id, 'deskman_verified', 0 );
	update_user_meta( $user_id, 'deskman_terms_accepted', array( 'version' => DESKMAN_FUN_TERMS_VERSION, 'time' => time() ) );
	$progress = $req->get_param( 'progress' );
	if ( is_array( $progress ) ) {
		update_user_meta( $user_id, 'deskman_progress', deskman_fun_merge_progress( array(), $progress ) );
	}
	deskman_fun_send_verification( $user_id );
	wp_set_auth_cookie( $user_id, true, is_ssl() );
	return deskman_fun_auth_response( $user_id );
}

function deskman_fun_rest_login( WP_REST_Request $req ) {
	$login = sanitize_text_field( (string) $req->get_param( 'login' ) );
	if ( ! deskman_fun_rate_limit( 'login', deskman_fun_client_ip() . '|' . strtolower( $login ), 10, 15 * MINUTE_IN_SECONDS ) ) {
		return deskman_fun_error( 'rate_limited', __( 'Too many attempts. Please wait 15 minutes and try again.', 'deskman-fun' ), 429 );
	}
	if ( is_email( $login ) ) {
		$u = get_user_by( 'email', $login );
		if ( $u ) {
			$login = $u->user_login;
		}
	}
	$user = wp_signon(
		array(
			'user_login'    => $login,
			'user_password' => (string) $req->get_param( 'password' ),
			'remember'      => true,
		),
		is_ssl()
	);
	if ( is_wp_error( $user ) ) {
		return deskman_fun_error( 'bad_login', __( 'Wrong username/email or password.', 'deskman-fun' ), 401 );
	}
	return deskman_fun_auth_response( $user->ID );
}

function deskman_fun_rest_google( WP_REST_Request $req ) {
	if ( ! deskman_fun_rate_limit( 'google', deskman_fun_client_ip(), 20, 15 * MINUTE_IN_SECONDS ) ) {
		return deskman_fun_error( 'rate_limited', __( 'Too many attempts. Please wait and try again.', 'deskman-fun' ), 429 );
	}
	$info = deskman_fun_verify_google_token( (string) $req->get_param( 'credential' ) );
	if ( is_wp_error( $info ) ) {
		return $info;
	}
	$users = get_users( array( 'meta_key' => 'deskman_google_sub', 'meta_value' => $info['sub'], 'number' => 1, 'fields' => 'ID' ) ); // phpcs:ignore WordPress.DB.SlowDBQuery
	$user_id = $users ? (int) $users[0] : 0;
	if ( ! $user_id ) {
		$existing = get_user_by( 'email', $info['email'] );
		if ( $existing ) {
			$user_id = (int) $existing->ID; // link Google to the account that owns this (Google-verified) email
		} else {
			$s = deskman_fun_settings();
			if ( empty( $s['allow_registration'] ) ) {
				return deskman_fun_error( 'registration_closed', __( 'New accounts are currently closed.', 'deskman-fun' ), 403 );
			}
			if ( true !== $req->get_param( 'agree' ) ) {
				return deskman_fun_error( 'terms_required', __( 'Please agree to the Terms of Service and Privacy Policy to create your account.', 'deskman-fun' ) );
			}
			$base  = sanitize_user( strstr( $info['email'], '@', true ), true );
			$base  = $base && strlen( $base ) >= 3 ? substr( $base, 0, 24 ) : 'player';
			$login = $base;
			for ( $i = 2; username_exists( $login ); $i++ ) {
				$login = $base . $i;
			}
			$user_id = wp_insert_user(
				array(
					'user_login'   => $login,
					'user_email'   => $info['email'],
					'user_pass'    => wp_generate_password( 32, true, true ),
					'display_name' => $info['name'] ? $info['name'] : $login,
					'role'         => 'subscriber',
				)
			);
			if ( is_wp_error( $user_id ) ) {
				return deskman_fun_error( 'register_failed', $user_id->get_error_message() );
			}
			update_user_meta( $user_id, 'deskman_terms_accepted', array( 'version' => DESKMAN_FUN_TERMS_VERSION, 'time' => time() ) );
		}
		update_user_meta( $user_id, 'deskman_google_sub', $info['sub'] );
	}
	update_user_meta( $user_id, 'deskman_verified', 1 ); // Google has verified the address
	wp_set_auth_cookie( $user_id, true, is_ssl() );
	return deskman_fun_auth_response( $user_id );
}

function deskman_fun_rest_resend() {
	$uid = get_current_user_id();
	if ( deskman_fun_is_verified( $uid ) ) {
		return rest_ensure_response( array( 'sent' => false, 'verified' => true ) );
	}
	if ( ! deskman_fun_rate_limit( 'resend', (string) $uid, 1, 2 * MINUTE_IN_SECONDS ) ) {
		return deskman_fun_error( 'rate_limited', __( 'Email already sent. Check your inbox (and spam), or try again in 2 minutes.', 'deskman-fun' ), 429 );
	}
	return rest_ensure_response( array( 'sent' => (bool) deskman_fun_send_verification( $uid ) ) );
}

function deskman_fun_rest_progress( WP_REST_Request $req ) {
	$uid    = get_current_user_id();
	$merged = deskman_fun_merge_progress( deskman_fun_get_progress( $uid ), (array) $req->get_param( 'progress' ) );
	update_user_meta( $uid, 'deskman_progress', $merged );
	return rest_ensure_response( array( 'progress' => $merged ) );
}

/**
 * Fastest plausible clear time per level (ms). A perfect automated run is the
 * reference; anything far below it is rejected as tampered.
 */
function deskman_fun_min_time_ms( $level ) {
	$table = apply_filters( 'deskman_fun_min_times', deskman_fun_default_min_times() );
	return isset( $table[ $level ] ) ? (int) $table[ $level ] : 3000;
}

function deskman_fun_rest_score( WP_REST_Request $req ) {
	$uid = get_current_user_id();
	$s   = deskman_fun_settings();
	if ( ! empty( $s['require_verification'] ) && ! deskman_fun_is_verified( $uid ) ) {
		return deskman_fun_error( 'not_verified', __( 'Verify your email to appear on the leaderboard.', 'deskman-fun' ), 403 );
	}
	if ( ! deskman_fun_rate_limit( 'score', (string) $uid, 40, 10 * MINUTE_IN_SECONDS ) ) {
		return deskman_fun_error( 'rate_limited', __( 'Slow down a little.', 'deskman-fun' ), 429 );
	}
	$level  = (int) $req->get_param( 'level' );
	$time   = (int) $req->get_param( 'timeMs' );
	$deaths = max( 0, (int) $req->get_param( 'deaths' ) );
	if ( $level < 1 || $level > DESKMAN_FUN_LEVEL_COUNT ) {
		return deskman_fun_error( 'bad_level', __( 'Unknown level.', 'deskman-fun' ) );
	}
	if ( $time < deskman_fun_min_time_ms( $level ) || $time > 6 * HOUR_IN_SECONDS * 1000 ) {
		return deskman_fun_error( 'implausible', __( 'That time could not be accepted.', 'deskman-fun' ) );
	}
	global $wpdb;
	$table = deskman_fun_scores_table();
	$row   = $wpdb->get_row( $wpdb->prepare( "SELECT id, best_time_ms, best_deaths, clears FROM {$table} WHERE user_id = %d AND level_id = %d", $uid, $level ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
	$now   = current_time( 'mysql', true );
	$best  = false;
	if ( $row ) {
		$best = $time < (int) $row->best_time_ms;
		$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$table,
			array(
				'best_time_ms' => min( $time, (int) $row->best_time_ms ),
				'best_deaths'  => min( $deaths, (int) $row->best_deaths ),
				'clears'       => (int) $row->clears + 1,
				'updated_at'   => $now,
			),
			array( 'id' => (int) $row->id ),
			array( '%d', '%d', '%d', '%s' ),
			array( '%d' )
		);
	} else {
		$best = true;
		$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$table,
			array(
				'user_id'      => $uid,
				'level_id'     => $level,
				'best_time_ms' => $time,
				'best_deaths'  => $deaths,
				'clears'       => 1,
				'updated_at'   => $now,
			),
			array( '%d', '%d', '%d', '%d', '%d', '%s' )
		);
	}
	return rest_ensure_response( array( 'accepted' => true, 'personalBest' => $best ) );
}

/** Leaderboard rows: overall (levels cleared, then total time) or one level. */
function deskman_fun_leaderboard_data( $level = 0, $limit = 50 ) {
	global $wpdb;
	$table = deskman_fun_scores_table();
	$limit = max( 1, min( 100, (int) $limit ) );
	if ( $level ) {
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT s.user_id, u.display_name AS name, s.best_time_ms AS time_ms, s.best_deaths AS deaths FROM {$table} s INNER JOIN {$wpdb->users} u ON u.ID = s.user_id WHERE s.level_id = %d ORDER BY s.best_time_ms ASC, s.updated_at ASC LIMIT %d", $level, $limit ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
	} else {
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT s.user_id, u.display_name AS name, COUNT(*) AS cleared, SUM(s.best_time_ms) AS time_ms FROM {$table} s INNER JOIN {$wpdb->users} u ON u.ID = s.user_id GROUP BY s.user_id, u.display_name ORDER BY cleared DESC, time_ms ASC LIMIT %d", $limit ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
	}
	$out  = array();
	$rank = 0;
	$me   = get_current_user_id();
	foreach ( (array) $rows as $r ) {
		$rank++;
		$out[] = array(
			'rank'    => $rank,
			'name'    => (string) $r->name,
			'timeMs'  => (int) $r->time_ms,
			'cleared' => isset( $r->cleared ) ? (int) $r->cleared : null,
			'deaths'  => isset( $r->deaths ) ? (int) $r->deaths : null,
			'isMe'    => $me && (int) $r->user_id === $me,
		);
	}
	return $out;
}

function deskman_fun_rest_leaderboard( WP_REST_Request $req ) {
	$level = (int) $req->get_param( 'level' );
	if ( $level < 0 || $level > DESKMAN_FUN_LEVEL_COUNT ) {
		$level = 0;
	}
	return rest_ensure_response( array( 'level' => $level, 'rows' => deskman_fun_leaderboard_data( $level ) ) );
}

/* -------------------------------------------------------------------------
 * Account deletion and WordPress privacy tools (export / erase)
 * ---------------------------------------------------------------------- */
function deskman_fun_delete_user_scores( $user_id ) {
	global $wpdb;
	$wpdb->delete( deskman_fun_scores_table(), array( 'user_id' => (int) $user_id ), array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
}
add_action( 'delete_user', 'deskman_fun_delete_user_scores' );

add_filter( 'wp_privacy_personal_data_exporters', function ( $exporters ) {
	$exporters['deskman-fun'] = array(
		'exporter_friendly_name' => __( 'deskman.fun game data', 'deskman-fun' ),
		'callback'               => function ( $email ) {
			$user = get_user_by( 'email', $email );
			$data = array();
			if ( $user ) {
				global $wpdb;
				$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT level_id, best_time_ms, best_deaths, clears FROM ' . deskman_fun_scores_table() . ' WHERE user_id = %d', $user->ID ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery
				foreach ( (array) $rows as $r ) {
					$data[] = array(
						'group_id'    => 'deskman-fun-scores',
						'group_label' => __( 'Game scores', 'deskman-fun' ),
						'item_id'     => 'level-' . $r->level_id,
						'data'        => array(
							array( 'name' => __( 'Level', 'deskman-fun' ), 'value' => $r->level_id ),
							array( 'name' => __( 'Best time (ms)', 'deskman-fun' ), 'value' => $r->best_time_ms ),
							array( 'name' => __( 'Fewest deaths', 'deskman-fun' ), 'value' => $r->best_deaths ),
							array( 'name' => __( 'Clears', 'deskman-fun' ), 'value' => $r->clears ),
						),
					);
				}
			}
			return array( 'data' => $data, 'done' => true );
		},
	);
	return $exporters;
} );

add_filter( 'wp_privacy_personal_data_erasers', function ( $erasers ) {
	$erasers['deskman-fun'] = array(
		'eraser_friendly_name' => __( 'deskman.fun game data', 'deskman-fun' ),
		'callback'             => function ( $email ) {
			$user = get_user_by( 'email', $email );
			if ( $user ) {
				deskman_fun_delete_user_scores( $user->ID );
				foreach ( array( 'deskman_progress', 'deskman_google_sub', 'deskman_verify_hash', 'deskman_verify_expires' ) as $k ) {
					delete_user_meta( $user->ID, $k );
				}
			}
			return array( 'items_removed' => (bool) $user, 'items_retained' => false, 'messages' => array(), 'done' => true );
		},
	);
	return $erasers;
} );

/*
 * Players (subscribers) should see the game, not the WordPress admin bar;
 * editors and administrators keep it.
 */
add_filter( 'show_admin_bar', function ( $show ) {
	return ( $show && is_user_logged_in() && ! current_user_can( 'edit_posts' ) ) ? false : $show;
} );

