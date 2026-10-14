<?php
/**
 * Minimal CLI helper for the WordPress integration test (stands in for
 * wp-cli, which is not available in the test environment).
 * Usage: php wp-helper.php <wp-root> <command> [args...]
 */
$_SERVER['HTTP_HOST'] = '127.0.0.1:8088';
$_SERVER['REQUEST_URI'] = '/';
require $argv[1] . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$cmd  = $argv[2];
$args = array_slice( $argv, 3 );
switch ( $cmd ) {
	case 'post':
		$id = wp_insert_post( array( 'post_title' => $args[0], 'post_name' => $args[1], 'post_content' => $args[2], 'post_status' => 'publish', 'post_type' => $args[3] ?? 'post' ), true );
		echo is_wp_error( $id ) ? 'ERR ' . $id->get_error_message() : $id;
		break;
	case 'activate-plugin':
		$r = activate_plugin( $args[0] );
		echo is_wp_error( $r ) ? 'ERR ' . $r->get_error_message() : 'ok';
		break;
	case 'deactivate-plugin':
		deactivate_plugins( $args[0] );
		echo 'ok';
		break;
	case 'switch-theme':
		switch_theme( $args[0] );
		echo get_stylesheet();
		break;
	case 'option':
		echo wp_json_encode( get_option( $args[0] ) );
		break;
	case 'page-template':
		echo get_post_meta( (int) $args[0], '_wp_page_template', true );
		break;
	case 'mail-log':
		echo wp_json_encode( get_option( 'dmf_test_mail', array() ) );
		break;
	case 'clear-limits':
		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_dmf_rl_%' OR option_name LIKE '_transient_timeout_dmf_rl_%'" );
		echo 'ok';
		break;
	case 'user':
		$u = get_user_by( 'email', $args[0] );
		echo wp_json_encode( $u ? array( 'id' => $u->ID, 'login' => $u->user_login, 'name' => $u->display_name, 'verified' => get_user_meta( $u->ID, 'deskman_verified', true ), 'google' => get_user_meta( $u->ID, 'deskman_google_sub', true ), 'terms' => get_user_meta( $u->ID, 'deskman_terms_accepted', true ), 'role' => $u->roles ) : null );
		break;
	case 'scores':
		global $wpdb;
		echo wp_json_encode( $wpdb->get_results( 'SELECT * FROM ' . $wpdb->prefix . 'deskman_scores', ARRAY_A ) );
		break;
	case 'legacy-scores-table':
		// Recreate the 2.0.x scores table (no season column) holding one
		// old-map time, as a site upgrading from 2.0.x would have it.
		global $wpdb;
		$t = $wpdb->prefix . 'deskman_scores';
		$wpdb->query( "DROP TABLE IF EXISTS {$t}" );
		$wpdb->query( "CREATE TABLE {$t} ( id bigint(20) unsigned NOT NULL AUTO_INCREMENT, user_id bigint(20) unsigned NOT NULL, level_id smallint(5) unsigned NOT NULL, best_time_ms int(10) unsigned NOT NULL, best_deaths int(10) unsigned NOT NULL DEFAULT 0, clears int(10) unsigned NOT NULL DEFAULT 1, updated_at datetime NOT NULL, PRIMARY KEY  (id), UNIQUE KEY user_level (user_id,level_id), KEY level_time (level_id,best_time_ms) )" );
		$wpdb->insert( $t, array( 'user_id' => (int) $args[0], 'level_id' => 3, 'best_time_ms' => 2000, 'best_deaths' => 0, 'clears' => 4, 'updated_at' => '2026-10-01 10:00:00' ) );
		update_option( 'deskman_fun_db_version', '1' );
		echo 'ok';
		break;
	case 'privacy-tools':
		$ex = apply_filters( 'wp_privacy_personal_data_exporters', array() );
		$er = apply_filters( 'wp_privacy_personal_data_erasers', array() );
		echo wp_json_encode( array( 'exporter' => isset( $ex['deskman-fun'] ), 'eraser' => isset( $er['deskman-fun'] ) ) );
		break;
	case 'state':
		echo wp_json_encode( array(
			'plugins'        => get_option( 'active_plugins' ),
			'theme'          => get_stylesheet(),
			'show_on_front'  => get_option( 'show_on_front' ),
			'page_on_front'  => (int) get_option( 'page_on_front' ),
			'play_plugin'    => (int) get_option( 'deskman_fun_play_page_id' ),
			'play_theme'     => (int) get_option( 'deskman_theme_play_page_id' ),
		) );
		break;
}
echo "\n";
