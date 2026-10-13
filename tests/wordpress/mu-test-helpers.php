<?php
/**
 * TEST ONLY — installed by tests/wordpress/setup-wp.sh into the throwaway test
 * site. Never shipped in the plugin/theme ZIPs.
 *  - Captures outgoing mail (the sandbox cannot send email).
 *  - Accepts fake Google ID tokens "test-google:<sub>:<email>:<name>" in place of
 *    the network call to Google's tokeninfo endpoint.
 *  - Lowers the plausible-time floor so the test can submit a quick clear.
 */
add_filter( 'pre_wp_mail', function ( $null, $atts ) {
	$log   = get_option( 'dmf_test_mail', array() );
	$log[] = array( 'to' => $atts['to'], 'subject' => $atts['subject'], 'message' => $atts['message'] );
	update_option( 'dmf_test_mail', $log, false );
	return true;
}, 10, 2 );

add_filter( 'deskman_fun_pre_verify_google_token', function ( $pre, $credential ) {
	if ( 0 === strpos( $credential, 'test-google:' ) ) {
		$p = explode( ':', $credential, 4 );
		return array( 'sub' => sanitize_text_field( $p[1] ), 'email' => sanitize_email( $p[2] ), 'name' => sanitize_text_field( $p[3] ?? '' ) );
	}
	return new WP_Error( 'google_invalid', 'Invalid test token', array( 'status' => 401 ) );
}, 10, 2 );

add_filter( 'deskman_fun_min_times', function ( $t ) {
	return array_fill( 1, 30, 1000 );
} );

// Test pages may opt into the game's debug hooks with ?debug=1.
add_action( 'wp_head', function () {
	if ( isset( $_GET['debug'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		echo "<script>window.DESKMAN_DEBUG = true;</script>\n";
	}
}, 1 );
