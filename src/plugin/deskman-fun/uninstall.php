<?php
/**
 * Fires only when the plugin is deleted from the Plugins screen (not on a
 * plain deactivate). Removes the plugin's own options, and the "Play" page
 * it created — but only if that page's content was never edited, so a site
 * owner who built on top of it never loses work by uninstalling.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$page_id = (int) get_option( 'deskman_fun_play_page_id' );
if ( $page_id ) {
	$page = get_post( $page_id );
	if ( $page && trim( $page->post_content ) === '[deskman_game fullscreen="yes"]' ) {
		wp_delete_post( $page_id, true );
	}
}

delete_option( 'deskman_fun_play_page_id' );
delete_option( 'deskman_fun_cleanup_done' );
delete_option( 'deskman_fun_front_page_set' );
delete_option( 'deskman_fun_setup_done' );
delete_transient( 'deskman_fun_activation_notice' );

// Player accounts data (the WordPress user accounts themselves are kept).
global $wpdb;
$wpdb->query( 'DROP TABLE IF EXISTS ' . $wpdb->prefix . 'deskman_scores' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery,WordPress.DB.DirectDatabaseQuery.SchemaChange
foreach ( array( 'deskman_progress', 'deskman_verified', 'deskman_verify_hash', 'deskman_verify_expires', 'deskman_google_sub', 'deskman_terms_accepted' ) as $deskman_meta_key ) {
	delete_metadata( 'user', 0, $deskman_meta_key, '', true );
}
foreach ( array( 'deskman_fun_settings', 'deskman_fun_db_version', 'deskman_fun_pages_done', 'deskman_fun_terms_page_id', 'deskman_fun_privacy_page_id', 'deskman_fun_leaderboard_page_id' ) as $deskman_option ) {
	delete_option( $deskman_option );
}
