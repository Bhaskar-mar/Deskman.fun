<?php
/**
 * Fastest plausible clear time per level in milliseconds: 75% of a
 * near-perfect automated run (tools/gen-min-times.mjs). Faster submissions
 * are rejected as tampered. Filter: deskman_fun_min_times.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
function deskman_fun_default_min_times() {
	return array(
		1 => 4267,
		2 => 7207,
		3 => 7447,
		4 => 7447,
		5 => 10222,
		6 => 7560,
		7 => 8152,
		8 => 15517,
		9 => 16125,
		10 => 26549,
		11 => 19035,
		12 => 17707,
		13 => 18450,
		14 => 20115,
		15 => 19672,
		16 => 18000,
		17 => 24757,
		18 => 24172,
		19 => 23924,
		20 => 23730,
		21 => 24187,
		22 => 15397,
		23 => 27690,
		24 => 29070,
		25 => 23302,
		26 => 31837,
		27 => 19830,
		28 => 21015,
		29 => 24592,
		30 => 47565,
	);
}
