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
	&copy; <?php echo esc_html( date_i18n( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?> — built on the deskman.fun theme.
</footer>
<?php wp_footer(); ?>
</body>
</html>
