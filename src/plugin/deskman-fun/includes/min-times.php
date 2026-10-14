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
		1 => 8685,
		2 => 10432,
		3 => 12735,
		4 => 19155,
		5 => 14047,
		6 => 20040,
		7 => 20685,
		8 => 18465,
		9 => 22702,
		10 => 25732,
		11 => 26062,
		12 => 27562,
		13 => 25815,
		14 => 26347,
		15 => 26722,
		16 => 24967,
		17 => 31395,
		18 => 30405,
		19 => 31552,
		20 => 30705,
		21 => 22065,
		22 => 31020,
		23 => 33352,
		24 => 30277,
		25 => 38092,
		26 => 39742,
		27 => 26490,
		28 => 27682,
		29 => 27802,
		30 => 51172,
	);
}
