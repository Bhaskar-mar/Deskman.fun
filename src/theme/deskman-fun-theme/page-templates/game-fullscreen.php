<?php
/**
 * Template Name: Game (Fullscreen)
 *
 * A standalone, fullscreen render of the deskman.fun game. Deliberately
 * skips get_header()/get_footer() — this page IS the game, edge to edge,
 * with no theme chrome around it.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<?php wp_head(); ?>
</head>
<body <?php body_class( 'dgm-fullscreen-page' ); ?>>
<?php wp_body_open(); ?>

<div id="deskman-fun-root">
	<div class="dgm-wrap dgm-wrap-full">
		<?php
		// Defensive: during a partial update (e.g. files mid-upload over FTP) the
		// theme's functions.php may not match this template; never fatal.
		if ( function_exists( 'deskman_theme_game_markup' ) ) {
			echo deskman_theme_game_markup(); // phpcs:ignore WordPress.Security.EscapeOutput -- static trusted markup shipped with the theme.
		} elseif ( function_exists( 'deskman_fun_game_markup' ) ) {
			echo deskman_fun_game_markup(); // phpcs:ignore WordPress.Security.EscapeOutput -- static trusted markup shipped with the plugin.
		} else {
			echo '<!-- deskman.fun: game markup unavailable while the theme updates; reload in a moment. -->';
		}
		?>
	</div>
</div>

<?php wp_footer(); ?>
</body>
</html>
