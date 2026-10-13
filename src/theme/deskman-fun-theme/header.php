<?php
/**
 * Header for standard (non-fullscreen) pages.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#main"><?php esc_html_e( 'Skip to content', 'deskman-fun-theme' ); ?></a>
<header class="site-header">
	<div class="site-header-inner">
		<a class="brand" href="<?php echo esc_url( home_url( '/' ) ); ?>">deskman<span>.fun</span></a>
		<nav class="site-nav" aria-label="<?php esc_attr_e( 'Main', 'deskman-fun-theme' ); ?>">
			<?php
			if ( has_nav_menu( 'primary' ) ) {
				wp_nav_menu(
					array(
						'theme_location' => 'primary',
						'container'      => false,
						'depth'          => 1,
					)
				);
			} else {
				deskman_theme_default_nav();
			}
			?>
		</nav>
		<a class="play-cta play-cta-sm" href="<?php echo esc_url( deskman_theme_play_url() ); ?>"><?php esc_html_e( 'Play', 'deskman-fun-theme' ); ?></a>
	</div>
</header>
<main class="site-content" id="main">
