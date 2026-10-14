<?php
/**
 * Required pages (Terms of Service, Privacy Policy, Leaderboard) and the
 * [deskman_leaderboard] shortcode.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Create the pages once. Never overwrites a page the site already has:
 * an existing slug is adopted as-is, and a published Privacy Policy that the
 * site owner configured in Settings → Privacy is reused.
 */
function deskman_fun_create_required_pages() {
	$site    = get_bloginfo( 'name' );
	$contact = get_option( 'admin_email' );

	$terms_id = deskman_fun_ensure_page( 'deskman_fun_terms_page_id', 'terms', __( 'Terms of Service', 'deskman-fun' ), deskman_fun_terms_content( $site, $contact ) );

	$privacy_id = 0;
	$configured = (int) get_option( 'wp_page_for_privacy_policy' );
	if ( $configured && 'publish' === get_post_status( $configured ) ) {
		$privacy_id = $configured;
		update_option( 'deskman_fun_privacy_page_id', $privacy_id );
	} else {
		$privacy_id = deskman_fun_ensure_page( 'deskman_fun_privacy_page_id', 'privacy', __( 'Privacy Policy', 'deskman-fun' ), deskman_fun_privacy_content( $site, $contact ) );
		if ( $privacy_id ) {
			update_option( 'wp_page_for_privacy_policy', $privacy_id );
		}
	}

	deskman_fun_ensure_page( 'deskman_fun_leaderboard_page_id', 'leaderboard', __( 'Leaderboard', 'deskman-fun' ), '[deskman_leaderboard]' );

	if ( $terms_id || $privacy_id ) {
		set_transient( 'deskman_fun_legal_notice', 1, WEEK_IN_SECONDS );
	}
}

function deskman_fun_ensure_page( $option, $slug, $title, $content ) {
	$id = (int) get_option( $option );
	if ( $id && get_post( $id ) && 'trash' !== get_post_status( $id ) ) {
		return $id;
	}
	$found = get_page_by_path( $slug );
	if ( $found ) {
		update_option( $option, $found->ID );
		return (int) $found->ID;
	}
	$id = wp_insert_post(
		array(
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_status'  => 'publish',
			'post_type'    => 'page',
			'post_content' => $content,
		),
		true
	);
	if ( is_wp_error( $id ) ) {
		return 0;
	}
	update_option( $option, $id );
	return (int) $id;
}

function deskman_fun_page_url( $option ) {
	$id = (int) get_option( $option );
	return ( $id && 'publish' === get_post_status( $id ) ) ? get_permalink( $id ) : '';
}

add_action( 'admin_notices', function () {
	if ( ! current_user_can( 'manage_options' ) || ! get_transient( 'deskman_fun_legal_notice' ) ) {
		return;
	}
	$terms   = (int) get_option( 'deskman_fun_terms_page_id' );
	$privacy = (int) get_option( 'deskman_fun_privacy_page_id' );
	echo '<div class="notice notice-info is-dismissible"><p>'
		. esc_html__( 'deskman.fun created Terms of Service and Privacy Policy pages that players must accept before creating an account. Please review them (and have them checked if needed) so they match how you run your site:', 'deskman-fun' )
		. ' ' . ( $terms ? '<a href="' . esc_url( get_edit_post_link( $terms ) ) . '">' . esc_html__( 'Edit Terms', 'deskman-fun' ) . '</a>' : '' )
		. ( $privacy ? ' · <a href="' . esc_url( get_edit_post_link( $privacy ) ) . '">' . esc_html__( 'Edit Privacy Policy', 'deskman-fun' ) . '</a>' : '' )
		. '</p></div>';
} );

function deskman_fun_terms_content( $site, $contact ) {
	$s = esc_html( $site );
	$c = esc_html( $contact );
	return <<<HTML
<!-- wp:paragraph --><p><em>Last updated: October 2026</em></p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>These terms apply to the deskman.fun game on {$s} and to player accounts. By creating an account you agree to them. You can play as a guest without an account.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>1. Who can use accounts</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>You must be at least 13 years old, or the minimum age required in your country, to create an account. If you are under 18, get permission from a parent or guardian first.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>2. Your account</h2><!-- /wp:heading -->
<!-- wp:list --><ul><li>Give a real email address. You need to verify it to appear on the leaderboard.</li><li>Keep your password private. You are responsible for activity on your account.</li><li>One account per person. Do not impersonate anyone.</li><li>Choose a respectful username. We may rename or remove offensive names.</li></ul><!-- /wp:list -->
<!-- wp:heading --><h2>3. Fair play</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>The leaderboard is only fun if it is fair. Do not use cheats, bots, automation, modified game files or exploits, and do not submit times you did not earn. We may remove leaderboard entries or suspend accounts that break these rules.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>4. The game</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>deskman.fun is provided free of charge and "as is". We may change, reset or retire levels, the leaderboard or features at any time. To the extent allowed by law, we are not liable for indirect damages, lost progress or downtime.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>5. Ending your account</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>You can ask us to delete your account at any time (see the Privacy Policy). We may suspend or delete accounts that break these terms.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>6. Changes</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>If we change these terms, we will update the date above. Continuing to use your account means you accept the new terms.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>7. Contact</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Questions: <a href="mailto:{$c}">{$c}</a></p><!-- /wp:paragraph -->
HTML;
}

function deskman_fun_privacy_content( $site, $contact ) {
	$s = esc_html( $site );
	$c = esc_html( $contact );
	return <<<HTML
<!-- wp:paragraph --><p><em>Last updated: October 2026</em></p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>This policy explains what {$s} collects when you play deskman.fun, why, and what you can do about it.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Playing as a guest</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Guests do not create an account. Your progress and settings are saved only in your own browser (local storage) and are never sent to us.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>What we collect with an account</h2><!-- /wp:heading -->
<!-- wp:list --><ul><li><strong>Account details:</strong> username, email address and a securely hashed password.</li><li><strong>Google sign-in (optional):</strong> your name, email address and Google account ID, received from Google when you choose "Sign in with Google". We never see your Google password.</li><li><strong>Game data:</strong> levels unlocked and completed, death counts, best times per level and number of clears.</li><li><strong>Security data:</strong> your IP address is used briefly to limit repeated sign-in and sign-up attempts.</li><li><strong>Cookies:</strong> WordPress sets login cookies so you stay signed in. They are necessary for accounts to work.</li></ul><!-- /wp:list -->
<!-- wp:heading --><h2>Why we use it</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>To run your account, keep your progress across devices, show the leaderboard, send account emails (such as email verification), and protect the site from abuse.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>What is public</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>The leaderboard shows your display name, levels cleared and best times. Your email address is never shown.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Sharing</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>We do not sell your data. It is shared only with services needed to run the site: our hosting and email delivery providers, and Google if you use Google sign-in.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>How long we keep it</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Until you delete your account. Leaderboard entries are removed together with the account.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Your rights</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>You can ask for a copy of your data, ask us to correct it, or ask us to delete your account and game data by emailing <a href="mailto:{$c}">{$c}</a>. Depending on where you live, you may also have the right to complain to a data protection authority.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Children</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Accounts are not intended for children under 13. Children can still play as guests, which collects nothing.</p><!-- /wp:paragraph -->
HTML;
}

/* -------------------------------------------------------------------------
 * [deskman_leaderboard] — server-rendered table (works without JavaScript)
 * ---------------------------------------------------------------------- */
function deskman_fun_format_ms( $ms ) {
	$ms = max( 0, (int) $ms );
	$m  = floor( $ms / 60000 );
	$s  = ( $ms % 60000 ) / 1000;
	return $m ? sprintf( '%d:%05.2f', $m, $s ) : sprintf( '%.2fs', $s );
}

function deskman_fun_leaderboard_shortcode() {
	$level = isset( $_GET['level'] ) ? absint( $_GET['level'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification -- read-only filter.
	if ( $level > DESKMAN_FUN_LEVEL_COUNT ) {
		$level = 0;
	}
	$rows = deskman_fun_leaderboard_data( $level, 50 );
	wp_enqueue_style( 'deskman-fun-fonts' );
	wp_enqueue_style( 'deskman-fun-leaderboard', DESKMAN_FUN_URL . 'assets/css/leaderboard.css', array(), DESKMAN_FUN_VERSION );
	ob_start();
	?>
	<div class="dgm-lb">
		<form class="dgm-lb-filter" method="get">
			<label for="dgm-lb-level"><?php esc_html_e( 'Show', 'deskman-fun' ); ?></label>
			<select id="dgm-lb-level" name="level" onchange="this.form.submit()">
				<option value="0" <?php selected( $level, 0 ); ?>><?php esc_html_e( 'Overall ranking', 'deskman-fun' ); ?></option>
				<?php for ( $i = 1; $i <= DESKMAN_FUN_LEVEL_COUNT; $i++ ) : ?>
					<option value="<?php echo esc_attr( $i ); ?>" <?php selected( $level, $i ); ?>>
						<?php
						/* translators: %d: level number */
						echo esc_html( sprintf( __( 'Level %d', 'deskman-fun' ), $i ) );
						?>
					</option>
				<?php endfor; ?>
			</select>
			<noscript><button type="submit"><?php esc_html_e( 'Go', 'deskman-fun' ); ?></button></noscript>
		</form>
		<?php if ( ! $rows ) : ?>
			<p class="dgm-lb-empty"><?php esc_html_e( 'No times yet. Be the first: sign in from the game and clear a level.', 'deskman-fun' ); ?></p>
		<?php else : ?>
			<table class="dgm-lb-table">
				<thead><tr>
					<th scope="col">#</th>
					<th scope="col"><?php esc_html_e( 'Player', 'deskman-fun' ); ?></th>
					<?php if ( $level ) : ?>
						<th scope="col"><?php esc_html_e( 'Best time', 'deskman-fun' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Deaths', 'deskman-fun' ); ?></th>
					<?php else : ?>
						<th scope="col"><?php esc_html_e( 'Levels', 'deskman-fun' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Total time', 'deskman-fun' ); ?></th>
					<?php endif; ?>
				</tr></thead>
				<tbody>
				<?php foreach ( $rows as $r ) : ?>
					<tr<?php echo $r['isMe'] ? ' class="is-me"' : ''; ?>>
						<td><?php echo esc_html( $r['rank'] ); ?></td>
						<td><?php echo esc_html( $r['name'] ); ?></td>
						<?php if ( $level ) : ?>
							<td><?php echo esc_html( deskman_fun_format_ms( $r['timeMs'] ) ); ?></td>
							<td><?php echo esc_html( $r['deaths'] ); ?></td>
						<?php else : ?>
							<td><?php echo esc_html( $r['cleared'] . ' / ' . DESKMAN_FUN_LEVEL_COUNT ); ?></td>
							<td><?php echo esc_html( deskman_fun_format_ms( $r['timeMs'] ) ); ?></td>
						<?php endif; ?>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
		<p class="dgm-lb-note"><a href="<?php echo esc_url( deskman_fun_play_url() ); ?>"><?php esc_html_e( 'Play now', 'deskman-fun' ); ?> &rarr;</a></p>
	</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'deskman_leaderboard', 'deskman_fun_leaderboard_shortcode' );
