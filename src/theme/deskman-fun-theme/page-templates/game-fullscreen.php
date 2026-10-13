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
		<?php echo deskman_theme_game_markup(); // phpcs:ignore WordPress.Security.EscapeOutput -- static trusted markup shipped with the theme. ?>
	</div>
</div>

<?php wp_footer(); ?>
</body>
</html>
