<?php
/**
 * Footer for standard (non-fullscreen) pages.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
</main>
<footer class="site-footer">
	<div class="site-footer-inner">
		<span class="brand brand-sm">deskman<span>.fun</span></span>
		<nav class="footer-nav" aria-label="<?php esc_attr_e( 'Legal', 'deskman-fun-theme' ); ?>">
			<?php foreach ( deskman_theme_footer_links() as $deskman_link ) : ?>
				<a href="<?php echo esc_url( $deskman_link['url'] ); ?>"><?php echo esc_html( $deskman_link['label'] ); ?></a>
			<?php endforeach; ?>
		</nav>
		<span class="copy">&copy; <?php echo esc_html( date_i18n( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?></span>
	</div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
