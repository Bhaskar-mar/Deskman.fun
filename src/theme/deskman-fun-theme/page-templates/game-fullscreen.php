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
<title><?php wp_title( '' ); ?></title>
<?php wp_head(); ?>
</head>
<body <?php body_class( 'dgm-fullscreen-page' ); ?>>
<?php wp_body_open(); ?>

<div id="deskman-fun-root">
	<div class="dgm-wrap dgm-wrap-full">
		<div id="app">
		  <div id="stage">
		    <canvas id="gameCanvas"></canvas>

		    <div id="hud">
		      <div class="intro-stepper" id="introStepper">
		        <div class="step" data-n="1"><span class="dot">1</span><span class="label">Introduction 1</span></div>
		        <div class="step-line"></div>
		        <div class="step" data-n="2"><span class="dot">2</span><span class="label">Introduction 2</span></div>
		        <div class="step-line"></div>
		        <div class="step" data-n="3"><span class="dot">3</span><span class="label">Introduction 3</span></div>
		      </div>
		      <div class="hud-top">
		        <div class="logo">
		          <div class="title">deskman<span>.fun</span></div>
		          <div class="tagline">RUN. FAIL. REPEAT.</div>
		        </div>
		        <div class="level-card" id="levelCard">
		          <div class="lvl" id="levelLabel">LEVEL 1</div>
		          <div class="sub" id="levelSub">Tutorial Lies</div>
		          <div class="badge">REVERSE CONTROLS</div>
		        </div>
		        <div class="top-buttons">
		          <button class="icon-btn" id="btnRestart" title="Restart">&#8635;</button>
		          <button class="icon-btn" id="btnSettings" title="Settings">&#9881;</button>
		          <button class="icon-btn" id="btnPause" title="Pause">&#10074;&#10074;</button>
		        </div>
		      </div>
		      <div class="progress-pill"><span id="progressText">1 / 5</span><span class="deaths" id="deathsText">Deaths: 0</span></div>
		      <div class="world-toast" id="worldToast"><span class="w1" id="worldToastSub">WORLD 1</span><span id="worldToastMain">TRUST</span></div>
		      <div class="toast-msg" id="toastMsg"></div>
		    </div>

		    <div class="controls">
		      <div class="dpad">
		        <button class="ctrl-btn" id="btnLeft">&#8592;</button>
		        <button class="ctrl-btn" id="btnRight">&#8594;</button>
		      </div>
		      <button class="jump-btn" id="btnJump">&#8593;<span>JUMP</span></button>
		    </div>

		    <!-- Death prompt: non-modal, gameplay stays visible behind it -->
		    <div class="death-prompt" id="deathPrompt">PRESS ANY KEY TO RETRY</div>

		    <!-- Win overlay -->
		    <div class="overlay dim" id="winOverlay">
		      <div class="card">
		        <h2 id="winTitle">Level Complete!</h2>
		        <p class="msg" id="winMsg">&nbsp;</p>
		        <p class="msg" id="winStats" style="display:none;font-size:12px;color:#888;margin-top:-8px;"></p>
		        <div class="row">
		          <button class="btn primary" id="btnNext">NEXT LEVEL &#8594;</button>
		          <button class="btn ghost" id="btnReplay">REPLAY</button>
		          <button class="btn ghost" id="btnWinMenu" hidden>LEVEL SELECT</button>
		        </div>
		      </div>
		    </div>

		    <!-- Pause overlay -->
		    <div class="overlay dim" id="pauseOverlay">
		      <div class="card">
		        <h2>Paused</h2>
		        <div class="row" style="margin-top:10px;flex-direction:column;">
		          <button class="btn primary" id="btnResume">RESUME</button>
		          <button class="btn ghost" id="btnPauseRestart">RESTART LEVEL</button>
		          <button class="btn ghost" id="btnPauseSettings">SETTINGS</button>
		          <button class="btn ghost" id="btnPauseMenu">LEVEL SELECT</button>
		        </div>
		      </div>
		    </div>

		    <!-- Settings overlay -->
		    <div class="overlay dim" id="settingsOverlay">
		      <div class="card">
		        <h2>Settings</h2>
		        <div class="settings-list">
		          <div class="setting-row">Sound Effects <div class="switch" data-setting="sound"><div class="knob"></div></div></div>
		          <div class="setting-row">Music <div class="switch" data-setting="music"><div class="knob"></div></div></div>
		          <div class="setting-row">Vibration <div class="switch" data-setting="vibration"><div class="knob"></div></div></div>
		          <div class="setting-row">Reduced Motion <div class="switch" data-setting="reducedMotion"><div class="knob"></div></div></div>
		        </div>
		        <button class="btn primary" id="btnCloseSettings">DONE</button>
		      </div>
		    </div>

		    <!-- Level select / menu -->
		    <div class="overlay dim" id="menuOverlay">
		      <div class="card" style="max-width:420px;">
		        <h2>Select Level</h2>
		        <div class="level-select-grid" id="levelGrid"></div>
		        <button class="btn ghost" id="btnCloseMenu">CLOSE</button>
		      </div>
		    </div>

		    <!-- Start screen -->
		    <div id="startScreen">
		      <div class="bigtitle">deskman<span>.fun</span></div>
		      <div class="bigtag">RUN. FAIL. REPEAT.</div>
		      <canvas id="introCanvas" width="200" height="90" style="margin-top:14px;"></canvas>
		      <div class="menu-row">
		        <button class="btn primary" id="btnPlay">PLAY</button>
		        <button class="btn ghost" id="btnLevelSelectStart">LEVELS</button>
		        <button class="btn ghost" id="btnSettingsStart">SETTINGS</button>
		      </div>
		    </div>
		  </div>
		</div>
	</div>
</div>

<?php wp_footer(); ?>
</body>
</html>
