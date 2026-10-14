<?php
/**
 * Fallback template: blog index / search / archive.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
get_header();
?>

<?php if ( have_posts() ) : ?>
	<?php while ( have_posts() ) : the_post(); ?>
		<article <?php post_class(); ?>>
			<h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
			<p class="entry-meta"><?php echo esc_html( get_the_date() ); ?></p>
			<?php the_excerpt(); ?>
		</article>
	<?php endwhile; ?>

	<?php the_posts_pagination(); ?>
<?php else : ?>
	<h1><?php esc_html_e( 'Nothing here yet', 'deskman-fun-theme' ); ?></h1>
	<p><?php esc_html_e( 'Create a page, assign it the "Game (Fullscreen)" template from Page Attributes, and you have a place to play.', 'deskman-fun-theme' ); ?></p>
<?php endif; ?>

<?php get_footer(); ?>
