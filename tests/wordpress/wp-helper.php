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
