<?php
/**
 * Single posts and pages. Renders the full content so shortcodes such as
 * [deskman_game] work on ordinary pages (index.php only shows excerpts).
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
get_header();
?>

<?php while ( have_posts() ) : the_post(); ?>
	<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
		<h1><?php the_title(); ?></h1>
		<?php if ( 'post' === get_post_type() ) : ?>
			<p class="entry-meta"><?php echo esc_html( get_the_date() ); ?></p>
		<?php endif; ?>
		<div class="entry-content">
			<?php the_content(); ?>
		</div>
		<?php
		wp_link_pages();
		if ( comments_open() || get_comments_number() ) {
			comments_template();
		}
		?>
	</article>
<?php endwhile; ?>

<?php get_footer(); ?>
