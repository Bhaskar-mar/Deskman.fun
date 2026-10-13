<?php
/**
 * Settings → deskman.fun
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'admin_menu', function () {
	add_options_page( __( 'deskman.fun', 'deskman-fun' ), __( 'deskman.fun', 'deskman-fun' ), 'manage_options', 'deskman-fun', 'deskman_fun_settings_page' );
} );

add_action( 'admin_init', function () {
	register_setting(
		'deskman_fun',
		'deskman_fun_settings',
		array(
			'type'              => 'array',
			'sanitize_callback' => 'deskman_fun_sanitize_settings',
			'default'           => array(),
		)
	);
} );

function deskman_fun_sanitize_settings( $in ) {
	$in = is_array( $in ) ? $in : array();
	$id = isset( $in['google_client_id'] ) ? trim( sanitize_text_field( $in['google_client_id'] ) ) : '';
	// Google web client IDs look like 1234-abc.apps.googleusercontent.com
	if ( $id && ! preg_match( '/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i', $id ) ) {
		add_settings_error( 'deskman_fun_settings', 'bad_client', __( 'That does not look like a Google OAuth Web client ID (…apps.googleusercontent.com). Google sign-in stays off.', 'deskman-fun' ) );
		$id = '';
	}
	return array(
		'google_client_id'     => $id,
		'allow_registration'   => empty( $in['allow_registration'] ) ? 0 : 1,
		'require_verification' => empty( $in['require_verification'] ) ? 0 : 1,
	);
}

function deskman_fun_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( isset( $_POST['deskman_fun_reset_lb'] ) ) {
		check_admin_referer( 'deskman_fun_reset_lb' );
		global $wpdb;
		$wpdb->query( 'TRUNCATE TABLE ' . deskman_fun_scores_table() ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery
		echo '<div class="notice notice-success"><p>' . esc_html__( 'Leaderboard cleared.', 'deskman-fun' ) . '</p></div>';
	}
	$s      = deskman_fun_settings();
	$origin = wp_parse_url( home_url(), PHP_URL_SCHEME ) . '://' . wp_parse_url( home_url(), PHP_URL_HOST ) . ( wp_parse_url( home_url(), PHP_URL_PORT ) ? ':' . wp_parse_url( home_url(), PHP_URL_PORT ) : '' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'deskman.fun', 'deskman-fun' ); ?></h1>
		<form method="post" action="options.php">
			<?php settings_fields( 'deskman_fun' ); ?>
			<h2><?php esc_html_e( 'Player accounts', 'deskman-fun' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'New accounts', 'deskman-fun' ); ?></th>
					<td><label><input type="checkbox" name="deskman_fun_settings[allow_registration]" value="1" <?php checked( $s['allow_registration'] ); ?>> <?php esc_html_e( 'Let players create accounts from the game (guests can always play).', 'deskman-fun' ); ?></label></td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Email verification', 'deskman-fun' ); ?></th>
					<td><label><input type="checkbox" name="deskman_fun_settings[require_verification]" value="1" <?php checked( $s['require_verification'] ); ?>> <?php esc_html_e( 'Only verified emails appear on the leaderboard (recommended).', 'deskman-fun' ); ?></label>
					<p class="description"><?php esc_html_e( 'Verification emails are sent with wp_mail(). If they do not arrive, install an SMTP plugin so your site can send email reliably.', 'deskman-fun' ); ?></p></td>
				</tr>
				<tr>
					<th scope="row"><label for="dmf-gcid"><?php esc_html_e( 'Google client ID', 'deskman-fun' ); ?></label></th>
					<td>
						<input id="dmf-gcid" type="text" class="regular-text code" name="deskman_fun_settings[google_client_id]" value="<?php echo esc_attr( $s['google_client_id'] ); ?>" placeholder="1234567890-abc123.apps.googleusercontent.com">
						<p class="description"><?php esc_html_e( 'Leave empty to hide "Sign in with Google". To enable it:', 'deskman-fun' ); ?></p>
						<ol class="description">
							<li><?php esc_html_e( 'Open Google Cloud Console → APIs & Services → Credentials.', 'deskman-fun' ); ?></li>
							<li><?php esc_html_e( 'Configure the OAuth consent screen (app name, support email, and links to your Terms and Privacy pages).', 'deskman-fun' ); ?></li>
							<li><?php esc_html_e( 'Create credentials → OAuth client ID → Web application.', 'deskman-fun' ); ?></li>
							<li><?php
								/* translators: %s: site origin such as https://deskman.fun */
								printf( esc_html__( 'Under "Authorized JavaScript origins" add: %s', 'deskman-fun' ), '<code>' . esc_html( $origin ) . '</code>' );
							?></li>
							<li><?php esc_html_e( 'Copy the client ID here and save. No client secret is needed.', 'deskman-fun' ); ?></li>
						</ol>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<hr>
		<h2><?php esc_html_e( 'Leaderboard', 'deskman-fun' ); ?></h2>
		<p><?php esc_html_e( 'Remove every leaderboard time (accounts and progress are kept).', 'deskman-fun' ); ?></p>
		<form method="post" onsubmit="return confirm('<?php echo esc_js( __( 'Delete all leaderboard times? This cannot be undone.', 'deskman-fun' ) ); ?>');">
			<?php wp_nonce_field( 'deskman_fun_reset_lb' ); ?>
			<input type="hidden" name="deskman_fun_reset_lb" value="1">
			<?php submit_button( __( 'Reset leaderboard', 'deskman-fun' ), 'delete', 'submit', false ); ?>
		</form>
	</div>
	<?php
}
