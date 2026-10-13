/*!
 * Razebait — deskman.fun rage-bait platformer engine.
 * Plain ES2017, no dependencies. Everything is scoped inside this IIFE so the
 * game can share a WordPress page with other scripts without name clashes.
 */
(function(){
'use strict';

const root = document.getElementById('deskman-fun-root');
if(!root || root.getAttribute('data-dgm-init')) return;
root.setAttribute('data-dgm-init','1');

const $ = (id)=>document.getElementById(id);
const GAME_VERSION = '1.3.0';
const DEBUG = window.RAZEBAIT_DEBUG === true;

/* =========================================================================
   STORAGE
   The key and the original fields (unlockedLevel, completedLevels,
   totalDeaths, settings) are unchanged from v1.x so existing progress
   carries over. New fields are only ever added; unknown fields written by
   other versions are preserved, and progress is never lowered on load.
========================================================================= */
const STORAGE_KEY = 'deskmanfun_save_v1';
const SAVE_VERSION = 2;
function defaultSettings(){ return { sound:true, music:true, vibration:true, reducedMotion:false }; }
function defaultSave(){
  return {
    version: SAVE_VERSION,
    unlockedLevel: 1,
    completedLevels: [],
    totalDeaths: 0,
    levelStats: {},           // { [levelId]: { clears, bestTime, bestDeaths } }
    settings: defaultSettings()
  };
}
function isPlainObject(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }
function loadSave(){
  let parsed = null;
  try{
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if(raw) parsed = JSON.parse(raw);
  }catch(e){ parsed = null; }
  const out = defaultSave();
  if(!isPlainObject(parsed)) return out;
  Object.assign(out, parsed); // keep fields this version does not know about
  const ul = parseInt(parsed.unlockedLevel, 10);
  out.unlockedLevel = ul >= 1 ? ul : 1;
  out.completedLevels = Array.isArray(parsed.completedLevels)
    ? parsed.completedLevels.map(n=>parseInt(n,10)).filter(n=>n>0) : [];
  out.totalDeaths = Math.max(0, parseInt(parsed.totalDeaths, 10) || 0);
  out.levelStats = isPlainObject(parsed.levelStats) ? parsed.levelStats : {};
  out.settings = Object.assign(defaultSettings(), isPlainObject(parsed.settings) ? parsed.settings : {});
  out.version = Math.max(SAVE_VERSION, parseInt(parsed.version, 10) || 0);
  return out;
}
const save = loadSave();
function persistSave(){
  try{ window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); }catch(e){}
}

/* =========================================================================
   AUDIO (synthesized WebAudio, no files)
   Nothing is created until the first user gesture, so browsers never log
   autoplay warnings and no sound is scheduled into a suspended context.
========================================================================= */
const Sound = (function(){
  let ctx = null, master = null, musicBus = null;
  let unlocked = false, musicTimer = null, nextNoteT = 0, step = 0;
  let lastFoot = 0;

  function ensure(){
    if(!unlocked) return null;
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{ ctx = new AC(); }catch(e){ return null; }
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    }
    if(ctx.state === 'suspended'){ const pr = ctx.resume(); if(pr && pr.catch) pr.catch(()=>{}); }
    return ctx;
  }
  function tone(freq, dur, type, opts){
    opts = opts || {};
    if(!(opts.music ? save.settings.music : save.settings.sound)) return;
    const c = ensure(); if(!c) return;
    const t0 = (opts.at != null ? opts.at : c.currentTime) + (opts.delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if(opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(opts.sweepTo, 1), t0 + dur);
    const vol = opts.vol != null ? opts.vol : 0.18;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur/3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(opts.music ? musicBus : master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function noise(dur, opts){
    opts = opts || {};
    if(!save.settings.sound) return;
    const c = ensure(); if(!c) return;
    const t0 = c.currentTime + (opts.delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = (Math.random()*2-1) * (1 - i/len);
    const src = c.createBufferSource(); src.buffer = buffer;
    const filt = c.createBiquadFilter();
    filt.type = opts.filterType || 'bandpass';
    filt.frequency.setValueAtTime(opts.freq || 1200, t0);
    if(opts.sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(opts.sweepTo, 10), t0 + dur);
    const gain = c.createGain(); gain.gain.value = opts.vol != null ? opts.vol : 0.2;
    src.connect(filt); filt.connect(gain); gain.connect(master);
    src.start(t0);
  }
  function seq(notes, type, opts){
    let t = 0;
    notes.forEach(n=>{
      tone(n.f, n.d || 0.12, type, Object.assign({}, opts, {delay:t}));
      t += (n.gap != null ? n.gap : (n.d || 0.12));
    });
  }

  // Gentle looping pattern (A minor pentatonic), scheduled ahead on the
  // audio clock so tempo stays steady regardless of frame rate.
  const BASS = [110.0, 110.0, 87.31, 87.31, 130.81, 130.81, 98.0, 98.0];
  const MEL = [440, 0, 523.25, 587.33, 0, 659.25, 587.33, 0, 523.25, 0, 440, 392, 0, 440, 0, 0];
  const EIGHTH = 0.3;
  function schedule(){
    const c = ensure(); if(!c || !save.settings.music) return;
    if(nextNoteT < c.currentTime) nextNoteT = c.currentTime + 0.05;
    while(nextNoteT < c.currentTime + 0.35){
      if(step % 4 === 0) tone(BASS[(step/4|0) % BASS.length], EIGHTH*3.4, 'triangle', {vol:0.05, music:true, at:nextNoteT});
      const m = MEL[step % MEL.length];
      if(m) tone(m, EIGHTH*1.6, 'sine', {vol:0.028, music:true, at:nextNoteT});
      nextNoteT += EIGHTH; step++;
    }
  }

  const api = {
    unlock(){ unlocked = true; ensure(); if(save.settings.music) api.startMusic(); },
    startMusic(){ if(musicTimer || !unlocked) return; nextNoteT = 0; musicTimer = setInterval(schedule, 120); schedule(); },
    stopMusic(){ if(musicTimer){ clearInterval(musicTimer); musicTimer = null; } },
    suspend(){ api.stopMusic(); if(ctx && ctx.state === 'running'){ const pr = ctx.suspend(); if(pr && pr.catch) pr.catch(()=>{}); } },
    resume(){ if(!unlocked) return; ensure(); if(save.settings.music) api.startMusic(); },
    jump(){ tone(380,0.09,'square',{sweepTo:620,vol:0.1}); },
    land(){ tone(140,0.08,'sine',{sweepTo:70,vol:0.14}); },
    landHeavy(){ tone(110,0.14,'sine',{sweepTo:50,vol:0.18}); },
    footstep(){ const now = performance.now(); if(now - lastFoot < 90) return; lastFoot = now; tone(90,0.03,'square',{vol:0.025}); },
    death(reason){
      if(reason === 'spike' || reason === 'saw'){ noise(0.18,{freq:2200,sweepTo:200,vol:0.22}); tone(180,0.15,'sawtooth',{sweepTo:40,vol:0.13}); }
      else if(reason === 'crush'){ tone(90,0.25,'sine',{sweepTo:30,vol:0.25}); noise(0.15,{freq:400,sweepTo:80,vol:0.2,filterType:'lowpass'}); }
      else if(reason === 'fall'){ seq([{f:500,d:0.08},{f:300,d:0.08},{f:150,d:0.2}],'triangle',{vol:0.13}); }
      else { noise(0.2,{freq:1500,sweepTo:100,vol:0.18}); tone(200,0.2,'triangle',{sweepTo:50,vol:0.12}); }
    },
    respawn(){ tone(520,0.07,'sine',{sweepTo:780,vol:0.07}); },
    victory(){ seq([{f:523,d:0.11},{f:659,d:0.11},{f:784,d:0.11},{f:1046,d:0.24}],'triangle',{vol:0.15}); },
    finale(){ seq([{f:523,d:0.1},{f:659,d:0.1},{f:784,d:0.1},{f:1046,d:0.12},{f:784,d:0.1},{f:1046,d:0.34}],'triangle',{vol:0.15}); },
    doorMove(){ noise(0.3,{freq:600,sweepTo:1400,vol:0.13,filterType:'highpass'}); },
    checkpoint(){ seq([{f:660,d:0.08},{f:880,d:0.12}],'sine',{vol:0.12}); },
    trapReveal(){ tone(1400,0.05,'square',{sweepTo:800,vol:0.09}); },
    warn(){ seq([{f:880,d:0.06,gap:0.09},{f:880,d:0.06}],'square',{vol:0.07}); },
    crack(){ tone(500,0.06,'square',{sweepTo:200,vol:0.08}); },
    collapse(){ noise(0.22,{freq:500,sweepTo:90,vol:0.2,filterType:'lowpass'}); },
    rumble(){ noise(0.6,{freq:180,sweepTo:60,vol:0.25,filterType:'lowpass'}); },
    recordScratch(){ noise(0.25,{freq:2000,sweepTo:80,vol:0.2,filterType:'lowpass'}); },
    uiClick(){ tone(600,0.04,'sine',{vol:0.07}); },
    wallBump(){ tone(120,0.07,'sine',{sweepTo:60,vol:0.08}); }
  };
  return api;
})();

function vibrate(pattern){
  if(!save.settings.vibration || !navigator.vibrate) return;
  try{ navigator.vibrate(pattern); }catch(e){}
}
const HAPTIC = { small:[12], medium:[25,15,25], strong:[45,30,70] };

/* =========================================================================
   LEVEL DATA
   Coordinates are world units. The view is 900 units tall; ground tops sit
   at y=680. Physics reference: max jump height ~160, flat jump distance
   ~290 at full run speed.

   platforms: {x,y,w,h,type}
     type 'solid' | 'disappearing' (delay ms after being stood on)
          | 'moving' (path:{x1,y1,x2,y2,speed,pauseStart,pause})
          | 'invisible' (solid but not drawn until touched)
   hazards:
     'spike'          static, lethal
     'hiddenSpike'    pops up when revealTrigger:{x,w} is entered or a trigger reveals it
     'saw'            moves along path like a moving platform, circular hitbox
     'fallingCeiling' crusher; idle -> warning -> falling (lethal) -> rested (solid)
                      triggerZone:{x,w}, warningTime, fallSpeed, restY
     'chaser'         a wall that sweeps right at `speed` once started; front starts
                      at `startX`, stops at `stopX`
   triggers: {x,w, actions:[...]}  (zone spans the full level height)
     {do:'collapse', plat:i, delay:ms}  {do:'reveal', hazard:i}
     {do:'start', hazard:i}  {do:'moveGoal', to:{x,y}}  {do:'toast', text}
   checkpoints: [{x,y}]  (y = ground top the flag stands on)
   goal: {x,y,w,h,type:'normal'|'fake', fakeCount}
========================================================================= */
const GLOBAL_DEATH_MESSAGES = [
  "Almost.", "You really fell for that?", "That was intentional.", "Try again.",
  "Interesting choice.", "You knew better.", "So close.", "Again?",
  "You were doing so well.", "Skill issue. Probably.", "Come on!"
];

const G = 680; // standard ground top
function ground(x, w, extra){ return Object.assign({x, y:G, w, h:900-G, type:'solid'}, extra||{}); }
function spike(x, w){ return {x, y:G-22, w:w||44, h:22, type:'spike'}; }

const LEVELS = [
  {
    id:1, name:'TRUST', subtitle:'Move. Jump. Believe.',
    width:2400, height:900, spawn:{x:90, y:G-62},
    platforms:[
      ground(0, 520),
      ground(640, 540),
      {x:1180, y:600, w:300, h:300, type:'solid'},
      ground(1480, 920)
    ],
    hazards:[
      spike(880),
      {x:1878, y:G-22, w:84, h:22, type:'hiddenSpike'}
    ],
    triggers:[
      {x:1700, w:40, actions:[{do:'moveGoal', to:{x:2250, y:G-100}}, {do:'reveal', hazard:1}]}
    ],
    goal:{x:1885, y:G-100, w:70, h:100, type:'normal'},
    annotations:[
      {x:70, y:470, text:'← → to move, ↑ to jump', touchText:'hold ← → to move, tap JUMP'},
      {x:1640, y:470, text:'almost there...'}
    ],
    deathMessages:["The door had other plans.","It moved. Obviously.","Exits are suggestions."],
    completionMessage:"Lesson one: the exit is never where it says it is."
  },
  {
    id:2, name:'Disappearing Floor', subtitle:'The floor disappears.',
    width:3200, height:900, spawn:{x:90, y:G-62},
    platforms:[
      ground(0, 300),
      ground(300, 200, {type:'disappearing', delay:800}),
      ground(500, 250),
      ground(750, 150, {type:'disappearing', delay:650}),
      ground(900, 150, {type:'disappearing', delay:600}),
      ground(1050, 150, {type:'disappearing', delay:550}),
      ground(1200, 150, {type:'disappearing', delay:500}),
      ground(1350, 280),
      {x:1630, y:G, w:130, h:30, type:'moving', path:{x1:1630, y1:G, x2:1850, y2:G, speed:150, pauseStart:0.6, pause:0.8}},
      ground(1990, 400),
      ground(2390, 200, {type:'disappearing', delay:170}),
      ground(2590, 610)
    ],
    hazards:[],
    goal:{x:3020, y:G-100, w:70, h:100, type:'normal'},
    annotations:[ {x:560, y:520, text:"don't stop."} ],
    deathMessages:["You trusted the floor.","That was definitely the floor.","It was never going to hold.","You stopped. It noticed.","That one was faster. Sorry."],
    completionMessage:"Nothing under you was ever permanent. You kept moving anyway."
  },
  {
    id:3, name:'HIDDEN', subtitle:'Not everything is visible.',
    width:3600, height:900, spawn:{x:90, y:G-62},
    platforms:[
      ground(0, 900),
      ground(1020, 680),
      {x:1700, y:560, w:300, h:340, type:'solid'},
      ground(2000, 600),
      ground(2600, 300, {type:'invisible'}),
      ground(2900, 700)
    ],
    hazards:[
      spike(300),
      {x:640, y:G-22, w:44, h:22, type:'hiddenSpike', revealTrigger:{x:520, w:40}},
      {x:1180, y:G-56, w:56, h:56, type:'saw', path:{x1:1180, y1:G-56, x2:1520, y2:G-56, speed:200, pauseStart:0, pause:0.5}},
      {x:2140, y:330, w:160, h:90, type:'fallingCeiling', triggerZone:{x:2040, w:40}, warningTime:0.4, fallSpeed:1300, restY:G-90},
      {x:3150, y:G-22, w:44, h:22, type:'hiddenSpike', revealTrigger:{x:3040, w:40}}
    ],
    checkpoints:[ {x:1760, y:560} ],
    goal:{x:3300, y:G-100, w:70, h:100, type:'fake', fakeCount:1},
    annotations:[ {x:2610, y:600, text:'trust me.'} ],
    deathMessages:["Not everything is visible.","It was there the whole time.","That wasn't on the map.","Look up. Then don't go there yet."],
    completionMessage:"You stopped trusting your eyes. Smart."
  },
  {
    id:4, name:"DON'T STOP", subtitle:'Something is behind you.',
    width:3900, height:900, spawn:{x:90, y:G-62},
    platforms:[
      ground(0, 620),
      ground(740, 480),
      ground(1220, 150, {type:'disappearing', delay:420}),
      ground(1370, 150, {type:'disappearing', delay:420}),
      ground(1520, 380),
      {x:1900, y:560, w:260, h:340, type:'solid'},
      ground(2160, 340),
      ground(2700, 1200)
    ],
    hazards:[
      spike(960),
      {x:2300, y:470, w:60, h:60, type:'saw', path:{x1:2300, y1:470, x2:2300, y2:G-56, speed:260, pauseStart:0, pause:0.25}},
      {type:'chaser', x:-2400, y:0, w:2400, h:900, startX:-260, stopX:3300, speed:345}
    ],
    triggers:[
      {x:330, w:20, actions:[{do:'start', hazard:2}, {do:'toast', text:'RUN.'}]}
    ],
    goal:{x:3650, y:G-100, w:70, h:100, type:'normal'},
    annotations:[],
    deathMessages:["Momentum is everything.","It doesn't get tired.","You hesitated.","Jump or don't. Decide faster."],
    completionMessage:"You never stopped moving."
  },
  {
    id:5, name:'TRUST NOTHING', subtitle:'Everything you learned. At once.',
    width:3900, height:900, spawn:{x:90, y:G-62},
    platforms:[
      ground(0, 400),
      ground(400, 150, {type:'disappearing', delay:450}),
      ground(550, 450),
      {x:1000, y:G, w:130, h:30, type:'moving', path:{x1:1000, y1:G, x2:1240, y2:G, speed:170, pauseStart:0.5, pause:0.7}},
      ground(1380, 500),
      {x:1880, y:560, w:200, h:340, type:'solid'},
      {x:2080, y:440, w:200, h:460, type:'solid'},
      ground(2400, 700),
      ground(3100, 240),
      ground(3340, 220),
      {x:3560, y:540, w:130, h:360, type:'solid'},
      {x:3690, y:540, w:90, h:360, type:'solid'},
      {x:3780, y:540, w:120, h:360, type:'solid'},
      {x:3880, y:300, w:20, h:240, type:'solid'}
    ],
    hazards:[
      {x:760, y:G-22, w:44, h:22, type:'hiddenSpike', revealTrigger:{x:650, w:40}},
      spike(1600),
      {x:2550, y:G-56, w:56, h:56, type:'saw', path:{x1:2550, y1:G-56, x2:2950, y2:G-56, speed:230, pauseStart:0, pause:0.4}}
    ],
    triggers:[
      {x:3040, w:40, actions:[{do:'collapse', plat:8, delay:150}, {do:'moveGoal', to:{x:3800, y:440}}]},
      {x:3630, w:20, actions:[{do:'collapse', plat:11, delay:110}]}
    ],
    checkpoints:[ {x:1930, y:560} ],
    goal:{x:3200, y:G-100, w:70, h:100, type:'normal'},
    annotations:[ {x:3130, y:500, text:'finally.'} ],
    deathMessages:["You trusted something.","Everything you learned, and still.","Nothing here was ever solid.","So close it hurts."],
    completionMessage:"Nothing lied to you. You just stopped trusting it."
  }
];

/* =========================================================================
   ENGINE CONSTANTS
========================================================================= */
const VH = 900;                 // world units visible vertically (landscape)
const MIN_VIEW_W = 840;         // never show less world width than this (portrait)
const MAX_ASPECT = 2.0;         // wider stages get side bars
const TOUCH_BAND_CSS = 150;     // px reserved under the world for touch controls (portrait)
const STEP = 1/120;             // fixed simulation step (s)
const MAX_STEPS = 12;           // max catch-up steps per frame (~0.1 s)
const GRAVITY = 2200;
const MOVE_SPEED = 380;
const GROUND_ACCEL = 2800, GROUND_DECEL = 3200;
const AIR_ACCEL = 1900, AIR_DECEL = 1400;
const RUN_THRESHOLD = 0.28;
const JUMP_VELOCITY = -840;
const JUMP_CUT = 0.5;           // vy multiplier when jump is released while rising
const MAX_FALL = 1500;
const PLAYER_W = 34, PLAYER_H = 62;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.12;
const RESPAWN_DELAY = 0.6;      // auto respawn after death (s)
const RESPAWN_SKIP = 0.12;      // input can skip the wait after this long
const EPS = 0.01;

/* =========================================================================
   GAME STATE
========================================================================= */
const app = $('app');
const stage = $('stage');
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const isFullscreenMode = !!root.querySelector('.dgm-wrap-full');
const touchUI = !(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
if(isFullscreenMode) document.documentElement.classList.add('dgm-lock-scroll');
root.classList.toggle('dgm-touch', touchUI);

let currentLevelIndex = 0;
let levelState = null;
let gameState = 'menu'; // menu | playing | paused | dead | won
const keys = { left:false, right:false, jump:false };
let jumpPressedAt = -10;
let simTime = 0;
let accumulator = 0;
let lastFrame = 0;
let loopPaused = false;  // debug: stop the rAF loop from advancing the simulation
const camera = { x:0, y:0, shake:0 };
const view = { scale:1, w:1600, h:VH, offY:0, band:0, cssW:0, cssH:0, dpr:1, padL:0, padR:0 };
let particles = [];
let checkpointIndex = -1;    // persists across deaths within the current level attempt
let attemptDeaths = 0;       // deaths since the level was (re)entered
let attemptTime = 0;

function cloneRect(o){ return Object.assign({}, o); }

function makeLevelState(data){
  const plats = data.platforms.map(p=>Object.assign(cloneRect(p), {
    cx:p.x, cy:p.y, px:p.x, py:p.y, dx:0, dy:0,
    triggered:false, timer:0, removed:false, shake:0, discovered:false, cracked:false,
    dir:1, waitT:(p.path && p.path.pauseStart) || 0, legDist:0
  }));
  const hazards = data.hazards.map(h=>{
    const o = Object.assign(cloneRect(h), {cx:h.x, cy:h.y, dir:1, waitT:(h.path && h.path.pauseStart) || 0, legDist:0, shake:0});
    if(h.type === 'hiddenSpike'){ o.revealed = false; o.popT = 0; }
    if(h.type === 'fallingCeiling'){ o.state = 'idle'; o.stateT = 0; o.py = h.y; }
    if(h.type === 'chaser'){ o.running = false; o.front = h.startX; }
    return o;
  });
  const triggers = (data.triggers || []).map(t=>Object.assign(cloneRect(t), {fired:false}));
  const goal = Object.assign(cloneRect(data.goal), {moving:null, fakeLeft:data.goal.fakeCount || 0, cooldown:0});
  const cp = checkpointIndex >= 0 && data.checkpoints ? data.checkpoints[checkpointIndex] : null;
  const sx = cp ? cp.x - PLAYER_W/2 : data.spawn.x;
  const sy = cp ? cp.y - PLAYER_H : data.spawn.y;
  return {
    data, plats, hazards, triggers, goal,
    hillsFar: makeHillLayer(data.id*7.3, data.width+2400, 690, 110),
    hillsNear: makeHillLayer(data.id*7.3+3.1, data.width+2400, 685, 70),
    player:{
      x:sx, y:sy, vx:0, vy:0, w:PLAYER_W, h:PLAYER_H,
      grounded:true, wasGrounded:true, facing:1, state:'idle', stateT:0, t:0, idleT:0,
      coyote:0, standingOn:null, landTimer:0, fallDist:0, dead:false, won:false,
      jumping:false, spawnT:0, bumpTimer:0, locoPhase:0, airTime:0, accelLean:0
    },
    elapsed:0, deadT:0, winT:0, flash:0
  };
}

function loadLevel(index){
  currentLevelIndex = Math.max(0, Math.min(LEVELS.length-1, index));
  checkpointIndex = -1;
  attemptDeaths = 0;
  attemptTime = 0;
  spawnLevel(true);
  updateHud();
  showLevelToast(LEVELS[currentLevelIndex]);
}

function spawnLevel(snapCamera){
  levelState = makeLevelState(LEVELS[currentLevelIndex]);
  particles = [];
  jumpPressedAt = -10;
  gameState = 'playing';
  hideAllOverlays();
  if(snapCamera !== false) snapCameraToPlayer();
}

function respawn(){
  if(gameState !== 'dead' && gameState !== 'playing') return;
  spawnLevel(true);
  if(!save.settings.reducedMotion) spawnPuff(levelState.player.x+PLAYER_W/2, levelState.player.y+PLAYER_H, 8);
  Sound.respawn();
}

function restartLevel(){
  // Full restart: clears the checkpoint too.
  checkpointIndex = -1;
  attemptTime = 0;
  spawnLevel(true);
  updateHud();
}

/* =========================================================================
   INPUT
   Keys are only captured while the game is "active": always in fullscreen
   mode, otherwise after the player clicks/taps inside the game until they
   interact with the page outside it. Form fields are never intercepted.
========================================================================= */
const keyMap = {
  ArrowLeft:'left', KeyA:'left',
  ArrowRight:'right', KeyD:'right',
  ArrowUp:'jump', KeyW:'jump', Space:'jump'
};
let pointerActive = isFullscreenMode;
document.addEventListener('pointerdown', (e)=>{
  pointerActive = isFullscreenMode || root.contains(e.target);
}, true);

function isTypingTarget(t){
  if(!t || t === document.body) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
function gameHasKeyboard(){
  return pointerActive || root.contains(document.activeElement);
}
function anyOverlayOpen(){
  return !!root.querySelector('.overlay.show') || !$('startScreen').hidden;
}

window.addEventListener('keydown', (e)=>{
  if(isTypingTarget(e.target) || !gameHasKeyboard()) return;
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  const code = e.code;

  if(gameState === 'won' && $('winOverlay').classList.contains('show')){
    if(code === 'Enter' || code === 'Space' || code === 'ArrowRight' || code === 'KeyD'){
      e.preventDefault();
      if(!e.repeat) goNextFromWin();
    }
    return;
  }
  if(anyOverlayOpen()){
    if(code === 'Escape'){
      e.preventDefault();
      if(gameState === 'paused' && $('pauseOverlay').classList.contains('show')) resumeGame();
      else if($('settingsOverlay').classList.contains('show')) closeSettings();
      else if($('menuOverlay').classList.contains('show')) closeMenu();
    }
    return; // let Tab/Enter/Space operate the focused overlay button normally
  }

  if(code === 'Escape' || code === 'KeyP'){ e.preventDefault(); togglePause(); return; }
  if(code === 'KeyR'){ e.preventDefault(); Sound.unlock(); if(gameState === 'playing' || gameState === 'dead') restartLevel(); return; }

  const k = keyMap[code];
  if(!k) return;
  e.preventDefault();
  Sound.unlock();
  if(gameState === 'dead'){
    if(!e.repeat && (k === 'jump' || code === 'Enter') && levelState.deadT >= RESPAWN_SKIP) respawn();
    keys[k] = true;
    return;
  }
  if(k === 'jump' && !e.repeat && !keys.jump) jumpPressedAt = simTime;
  keys[k] = true;
});
window.addEventListener('keyup', (e)=>{
  const k = keyMap[e.code];
  if(k) keys[k] = false;
});
function clearKeys(){ keys.left = keys.right = keys.jump = false; setTouchActive(null); }
window.addEventListener('blur', ()=>{ clearKeys(); if(gameState === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ clearKeys(); if(gameState === 'playing') pauseGame(); Sound.suspend(); }
  else Sound.resume();
});

/* Touch controls. The d-pad is one zone so a thumb can slide between
   left and right; the jump button is separate for multi-touch. */
const btnLeft = $('btnLeft'), btnRight = $('btnRight'), btnJump = $('btnJump'), dpad = $('dpad');
function setTouchActive(dir){
  btnLeft.classList.toggle('active', dir === 'left');
  btnRight.classList.toggle('active', dir === 'right');
}
let dpadPointer = null;
function dpadDirAt(clientX){
  const r = dpad.getBoundingClientRect();
  return clientX < r.left + r.width/2 ? 'left' : 'right';
}
function dpadUpdate(e){
  const dir = dpadDirAt(e.clientX);
  keys.left = dir === 'left'; keys.right = dir === 'right';
  setTouchActive(dir);
}
dpad.addEventListener('pointerdown', (e)=>{
  e.preventDefault(); Sound.unlock();
  dpadPointer = e.pointerId;
  try{ dpad.setPointerCapture(e.pointerId); }catch(err){}
  dpadUpdate(e);
});
dpad.addEventListener('pointermove', (e)=>{ if(e.pointerId === dpadPointer) dpadUpdate(e); });
function dpadEnd(e){
  if(e.pointerId !== dpadPointer) return;
  dpadPointer = null; keys.left = keys.right = false; setTouchActive(null);
}
dpad.addEventListener('pointerup', dpadEnd);
dpad.addEventListener('pointercancel', dpadEnd);
dpad.addEventListener('lostpointercapture', dpadEnd);

btnJump.addEventListener('pointerdown', (e)=>{
  e.preventDefault(); Sound.unlock();
  try{ btnJump.setPointerCapture(e.pointerId); }catch(err){}
  btnJump.classList.add('active');
  if(gameState === 'dead'){ if(levelState.deadT >= RESPAWN_SKIP) respawn(); }
  else if(!keys.jump) jumpPressedAt = simTime;
  keys.jump = true;
});
function jumpEnd(){ keys.jump = false; btnJump.classList.remove('active'); }
btnJump.addEventListener('pointerup', jumpEnd);
btnJump.addEventListener('pointercancel', jumpEnd);
btnJump.addEventListener('lostpointercapture', jumpEnd);
[dpad, btnLeft, btnRight, btnJump].forEach(el=>el.addEventListener('contextmenu', e=>e.preventDefault()));

// Tapping the play area while dead skips the respawn wait.
canvas.addEventListener('pointerdown', ()=>{
  Sound.unlock();
  if(gameState === 'dead' && levelState.deadT >= RESPAWN_SKIP) respawn();
});

/* =========================================================================
   PHYSICS / COLLISION
========================================================================= */
function rectOverlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
function platRect(p){ return {x:p.cx, y:p.cy, w:p.w, h:p.h}; }

function solidsOf(ls){
  const list = [];
  for(const p of ls.plats){
    if(p.removed) continue;
    list.push({x:p.cx, y:p.cy, w:p.w, h:p.h, px:p.px, py:p.py, ref:p});
  }
  for(const h of ls.hazards){
    if(h.type === 'fallingCeiling' && h.state === 'rested'){
      list.push({x:h.x, y:h.y, w:h.w, h:h.h, px:h.x, py:h.y, ref:h});
    }
  }
  return list;
}

function advancePath(o, dt){
  const path = o.path;
  o.px = o.cx; o.py = o.cy;
  if(o.waitT > 0){ o.waitT -= dt; o.dx = 0; o.dy = 0; return; }
  const ddx = path.x2-path.x1, ddy = path.y2-path.y1;
  const len = Math.hypot(ddx, ddy) || 1;
  o.legDist += path.speed*dt;
  if(o.legDist >= len){
    o.legDist = 0;
    o.waitT = path.pause || 0;
    if(o.dir > 0){ o.cx = path.x2; o.cy = path.y2; o.dir = -1; }
    else { o.cx = path.x1; o.cy = path.y1; o.dir = 1; }
  } else {
    const f = o.legDist/len;
    if(o.dir > 0){ o.cx = path.x1 + ddx*f; o.cy = path.y1 + ddy*f; }
    else { o.cx = path.x2 - ddx*f; o.cy = path.y2 - ddy*f; }
  }
  o.dx = o.cx - o.px; o.dy = o.cy - o.py;
}

function updateWorld(ls, dt){
  for(const p of ls.plats){
    p.px = p.cx; p.py = p.cy; p.dx = 0; p.dy = 0;
    if(p.removed) continue;
    if(p.type === 'moving' && p.path) advancePath(p, dt);
    if(p.triggered){
      p.timer += dt;
      p.shake = save.settings.reducedMotion ? 0 : Math.sin(p.timer*60) * Math.min(4, p.timer*24);
      const delay = (p.delay != null ? p.delay : 400)/1000;
      if(!p.cracked && p.timer > delay*0.4){ p.cracked = true; Sound.crack(); }
      if(p.timer >= delay){
        p.removed = true;
        spawnDebris(p.cx+p.w/2, p.cy+Math.min(p.h,60)/2, p.w);
        Sound.collapse();
        vibrate(HAPTIC.medium);
      }
    }
  }
  for(const h of ls.hazards){
    if(h.type === 'saw' && h.path) advancePath(h, dt);
    else if(h.type === 'hiddenSpike' && h.revealed) h.popT = Math.min(1, h.popT + dt/0.08);
    else if(h.type === 'fallingCeiling') updateCeiling(ls, h, dt);
    else if(h.type === 'chaser' && h.running){
      h.front = Math.min(h.stopX, h.front + h.speed*dt);
      if(!save.settings.reducedMotion) camera.shake = Math.max(camera.shake, 2.5);
    }
  }
}

function updateCeiling(ls, h, dt){
  h.py = h.y;
  if(h.state === 'warning'){
    h.stateT += dt;
    h.shake = save.settings.reducedMotion ? 0 : Math.sin(h.stateT*42)*3;
    if(h.stateT >= (h.warningTime != null ? h.warningTime : 0.5)){ h.state = 'falling'; h.shake = 0; }
  } else if(h.state === 'falling'){
    h.y = Math.min(h.restY, h.y + (h.fallSpeed || 950)*dt);
    if(h.y >= h.restY){
      h.state = 'rested';
      Sound.collapse();
      vibrate(HAPTIC.medium);
      camera.shake = Math.max(camera.shake, 8);
      spawnDebris(h.x+h.w/2, h.y+h.h, h.w);
    }
  }
}

function startHazard(ls, h){
  if(h.type === 'fallingCeiling' && h.state === 'idle'){
    h.state = 'warning'; h.stateT = 0; Sound.warn(); vibrate(HAPTIC.small);
  } else if(h.type === 'chaser' && !h.running){
    h.running = true; Sound.rumble(); vibrate(HAPTIC.strong);
  }
}
function revealHazard(h){
  if(h.revealed) return;
  h.revealed = true; h.popT = 0;
  Sound.trapReveal(); vibrate(HAPTIC.medium);
}
function collapsePlatform(p, delay){
  if(!p || p.removed || p.triggered) return;
  p.triggered = true; p.timer = 0;
  if(delay != null) p.delay = delay;
}

function runTriggerActions(ls, actions){
  for(const a of actions){
    if(a.do === 'collapse') collapsePlatform(ls.plats[a.plat], a.delay);
    else if(a.do === 'reveal') revealHazard(ls.hazards[a.hazard]);
    else if(a.do === 'start') startHazard(ls, ls.hazards[a.hazard]);
    else if(a.do === 'moveGoal') moveGoal(ls, a.to);
    else if(a.do === 'toast') showToast(a.text);
  }
}

function moveGoal(ls, to){
  const g = ls.goal;
  g.moving = { fx:g.x, fy:g.y, tx:to.x, ty:to.y, t:0, dur:0.32 };
  Sound.doorMove();
  vibrate(HAPTIC.small);
}

function updatePlayer(ls, dt){
  const p = ls.player;
  const data = ls.data;

  let moveDir = 0;
  if(keys.left) moveDir -= 1;
  if(keys.right) moveDir += 1;
  if(data.reverseControls) moveDir = -moveDir;

  // horizontal velocity
  const targetVx = moveDir*MOVE_SPEED;
  const accel = p.grounded ? GROUND_ACCEL : AIR_ACCEL;
  const decel = p.grounded ? GROUND_DECEL : AIR_DECEL;
  if(targetVx !== 0){
    const rate = (p.vx === 0 || Math.sign(targetVx) === Math.sign(p.vx)) ? accel : decel+accel;
    if(p.vx < targetVx) p.vx = Math.min(p.vx + rate*dt, targetVx);
    else if(p.vx > targetVx) p.vx = Math.max(p.vx - rate*dt, targetVx);
    p.facing = moveDir;
  } else if(p.vx > 0) p.vx = Math.max(0, p.vx - decel*dt);
  else if(p.vx < 0) p.vx = Math.min(0, p.vx + decel*dt);

  // jump (buffered press + coyote time), variable height on release
  if(p.coyote > 0) p.coyote -= dt;
  const sincePress = simTime - jumpPressedAt;
  if(sincePress >= 0 && sincePress < JUMP_BUFFER && (p.grounded || p.coyote > 0)){
    p.vy = JUMP_VELOCITY;
    p.grounded = false; p.coyote = 0; p.jumping = true;
    p.standingOn = null;
    jumpPressedAt = -10;
    Sound.jump();
    spawnPuff(p.x+p.w/2, p.y+p.h, 5);
  }
  if(p.jumping && !keys.jump && p.vy < 0){ p.vy *= JUMP_CUT; p.jumping = false; }
  if(p.vy >= 0) p.jumping = false;

  p.vy = Math.min(p.vy + GRAVITY*dt, MAX_FALL);

  // ride the platform we stood on last step
  const ride = p.standingOn;
  if(ride && !ride.removed){ p.x += ride.dx || 0; p.y += ride.dy || 0; }

  const solids = solidsOf(ls);

  // --- horizontal pass: decide sides from where both bodies were last step
  const preX = p.x;
  p.x += p.vx*dt;
  p.x = Math.max(0, Math.min(p.x, data.width - p.w));
  for(const s of solids){
    if(!rectOverlap(p, s)) continue;
    const wasLeft = preX + p.w <= Math.max(s.x, s.px) + EPS;
    const wasRight = preX >= Math.min(s.x, s.px) + s.w - EPS;
    const vOverlap = Math.min(p.y+p.h, s.y+s.h) - Math.max(p.y, s.y);
    if(vOverlap <= 0.5) continue;
    if(wasLeft && !wasRight){ p.x = s.x - p.w; bump(p); }
    else if(wasRight && !wasLeft){ p.x = s.x + s.w; bump(p); }
  }

  // --- vertical pass
  const preTop = p.y, preBottom = p.y + p.h;
  p.y += p.vy*dt;
  p.grounded = false;
  let standOn = null;
  for(const s of solids){
    if(!rectOverlap(p, s)) continue;
    // landing: our bottom was at/above the solid's top (previous or current,
    // whichever is lower, so riders of descending platforms stay grounded)
    // and we are not moving up faster than the solid.
    if(preBottom <= Math.max(s.y, s.py) + 0.5 && p.vy >= Math.min(0, (s.y - s.py)/dt) - EPS){
      p.y = s.y - p.h;
      if(p.vy > 0) p.vy = 0;
      p.grounded = true;
      standOn = s.ref;
    } else if(preTop >= Math.min(s.y, s.py) + s.h - 0.5 && p.vy < 0){
      p.y = s.y + s.h;
      p.vy = 0; p.jumping = false;
    }
  }

  // --- depenetration: anything still overlapping is resolved along the
  // shallowest axis; if that is impossible (squeezed) the player is crushed.
  for(let pass=0; pass<2; pass++){
    for(const s of solids){
      if(!rectOverlap(p, s)) continue;
      const pushL = (p.x + p.w) - s.x, pushR = (s.x + s.w) - p.x;
      const pushU = (p.y + p.h) - s.y, pushD = (s.y + s.h) - p.y;
      const m = Math.min(pushL, pushR, pushU, pushD);
      if(m === pushU){ p.y -= pushU; if(p.vy > 0) p.vy = 0; p.grounded = true; standOn = s.ref; }
      else if(m === pushD){ p.y += pushD; if(p.vy < 0) p.vy = 0; }
      else if(m === pushL){ p.x -= pushL; }
      else { p.x += pushR; }
    }
  }
  for(const s of solids){
    if(!rectOverlap(p, s)) continue;
    const ox = Math.min(p.x+p.w, s.x+s.w) - Math.max(p.x, s.x);
    const oy = Math.min(p.y+p.h, s.y+s.h) - Math.max(p.y, s.y);
    if(ox > 4 && oy > 4){ killPlayer('crush'); return; }
  }

  if(p.grounded){
    p.coyote = COYOTE_TIME;
    if(!p.wasGrounded){
      if(p.fallDist > 160){ Sound.landHeavy(); p.landTimer = 0.14; spawnPuff(p.x+p.w/2, p.y+p.h, 7); }
      else if(p.fallDist > 20){ Sound.land(); p.landTimer = 0.1; spawnPuff(p.x+p.w/2, p.y+p.h, 4); }
    }
    p.fallDist = 0;
  } else {
    p.fallDist += Math.max(0, p.vy)*dt;
  }
  p.wasGrounded = p.grounded;
  p.standingOn = p.grounded ? standOn : null;

  // fell out of the world
  if(p.y > data.height + 60){ killPlayer('fall'); return; }

  // platforms that drop after being stood on
  const sp = p.standingOn;
  if(sp && sp.type === 'disappearing' && !sp.triggered) collapsePlatform(sp);

  // invisible platform discovery
  for(const pl of ls.plats){
    if(pl.type === 'invisible' && !pl.discovered && !pl.removed){
      if(rectOverlap({x:p.x-4, y:p.y-4, w:p.w+8, h:p.h+8}, platRect(pl))){
        pl.discovered = true; pl.revealT = 0; Sound.trapReveal();
      }
    }
  }

  // trigger zones and zone-based hazards
  const px0 = p.x, px1 = p.x + p.w;
  for(const tr of ls.triggers){
    if(tr.fired) continue;
    if(px1 > tr.x && px0 < tr.x + tr.w){
      tr.fired = true;
      if(tr.actions) runTriggerActions(ls, tr.actions);
      if(tr.targetIndex != null) collapsePlatform(ls.plats[tr.targetIndex]); // v1 schema
    }
  }
  for(const hz of ls.hazards){
    if(hz.type === 'hiddenSpike' && !hz.revealed && hz.revealTrigger){
      if(px1 > hz.revealTrigger.x && px0 < hz.revealTrigger.x + hz.revealTrigger.w) revealHazard(hz);
    } else if(hz.type === 'fallingCeiling' && hz.state === 'idle' && hz.triggerZone){
      if(px1 > hz.triggerZone.x && px0 < hz.triggerZone.x + hz.triggerZone.w) startHazard(ls, hz);
    }
  }

  // checkpoints
  const cps = data.checkpoints || [];
  for(let i=0;i<cps.length;i++){
    if(i <= checkpointIndex) continue;
    const c = cps[i];
    if(px1 > c.x - 20 && px0 < c.x + 20 && p.y < c.y && p.y + p.h > c.y - 110){
      checkpointIndex = i;
      Sound.checkpoint(); vibrate(HAPTIC.small);
      spawnSparkle(c.x + 14, c.y - 90);
      showToast('Checkpoint');
    }
  }

  // hazards
  for(const hz of ls.hazards){
    if(hazardHits(hz, p)){
      killPlayer(hz.type === 'saw' ? 'saw' : hz.type === 'fallingCeiling' ? 'crush' : hz.type === 'chaser' ? 'chaser' : 'spike');
      return;
    }
  }

  updateGoal(ls, dt);
  updateAnimState(p, dt, moveDir);
}

function bump(p){
  if(Math.abs(p.vx) > 120){
    if(!(p.bumpTimer > 0)) Sound.wallBump();
    p.bumpTimer = 0.14;
  }
  p.vx = 0;
}

function hazardHits(hz, p){
  switch(hz.type){
    case 'spike':
    case 'hiddenSpike': {
      if(hz.type === 'hiddenSpike' && !hz.revealed) return false;
      return rectOverlap(p, {x:hz.x+hz.w*0.12, y:hz.y+hz.h*0.25, w:hz.w*0.76, h:hz.h*0.75});
    }
    case 'saw': {
      const r = Math.min(hz.w, hz.h)*0.4;
      const cx = hz.cx + hz.w/2, cy = hz.cy + hz.h/2;
      const nx = Math.max(p.x, Math.min(cx, p.x+p.w));
      const ny = Math.max(p.y, Math.min(cy, p.y+p.h));
      return (cx-nx)*(cx-nx) + (cy-ny)*(cy-ny) < r*r;
    }
    case 'fallingCeiling': {
      if(hz.state !== 'falling') return false;
      // Any overlap with the descending block is lethal (its spikes face down).
      return rectOverlap(p, {x:hz.x+4, y:hz.y, w:hz.w-8, h:hz.h});
    }
    case 'chaser':
      return hz.running && p.x < hz.front - 6;
  }
  return false;
}

function updateGoal(ls, dt){
  const p = ls.player, g = ls.goal;
  if(g.cooldown > 0) g.cooldown -= dt;
  if(g.moving){
    const m = g.moving;
    m.t += dt;
    const f = Math.min(1, m.t/m.dur);
    const e = f<0.5 ? 2*f*f : 1-Math.pow(-2*f+2, 2)/2;
    g.x = m.fx + (m.tx-m.fx)*e;
    g.y = m.fy + (m.ty-m.fy)*e - Math.sin(f*Math.PI)*60;
    if(f >= 1){ g.x = m.tx; g.y = m.ty; g.moving = null; }
    return;
  }
  const inner = {x:g.x+12, y:g.y+18, w:g.w-24, h:g.h-18};
  if(!rectOverlap(p, inner)) return;
  if(g.type === 'fake' && g.fakeLeft > 0){
    if(g.cooldown > 0) return;
    g.fakeLeft--;
    g.cooldown = 0.5;
    p.vx = -p.facing*430; p.vy = -320; p.grounded = false; p.standingOn = null; p.jumping = false;
    Sound.recordScratch(); vibrate(HAPTIC.medium);
    camera.shake = Math.max(camera.shake, 6);
    showToast('The door disagrees.');
    return;
  }
  triggerWin();
}

const STRIDE_LEN = 108;
function updateAnimState(p, dt, moveDir){
  p.t += dt; p.stateT += dt; p.idleT += dt;
  if(p.spawnT < 1) p.spawnT = Math.min(1, p.spawnT + dt/0.18);
  if(p.bumpTimer > 0) p.bumpTimer -= dt;
  p.airTime = p.grounded ? 0 : p.airTime + dt;
  const speedAbs = Math.abs(p.vx);
  if(p.grounded) p.locoPhase = (p.locoPhase + (speedAbs/STRIDE_LEN)*dt*Math.PI*2) % (Math.PI*2);
  if(moveDir !== 0 && speedAbs < MOVE_SPEED*0.85 && Math.sign(p.vx||moveDir) === Math.sign(moveDir)) p.accelLean = 0.14;
  else if(moveDir === 0 && speedAbs > 15) p.accelLean = -0.12*Math.sign(p.vx);
  else p.accelLean = 0;

  if(p.won){ p.state = 'victory'; return; }
  if(p.landTimer > 0){ p.landTimer -= dt; p.state = 'land'; return; }
  if(!p.grounded){ p.state = p.vy < 0 ? 'jump' : 'fall'; return; }
  if(moveDir === 0 && speedAbs < 8){ p.state = 'idle'; return; }
  p.state = speedAbs > MOVE_SPEED*RUN_THRESHOLD ? 'run' : 'walk';
  const phase = Math.floor(p.locoPhase/Math.PI);
  if(phase !== p._lastStridePhase && speedAbs > 20){ p._lastStridePhase = phase; Sound.footstep(); }
}

/* =========================================================================
   PARTICLES (capped so a burst never costs more than a few hundred rects)
========================================================================= */
const MAX_PARTICLES = 240;
function pushParticle(pt){ if(particles.length < MAX_PARTICLES) particles.push(pt); }
function spawnPuff(x, y, n){
  if(save.settings.reducedMotion) return;
  for(let i=0;i<n;i++){
    pushParticle({x, y, vx:(Math.random()-0.5)*140, vy:-Math.random()*80-20, life:0.32, maxLife:0.32, size:3+Math.random()*3, color:'rgba(80,72,58,0.45)'});
  }
}
function spawnDebris(x, y, spread){
  const n = save.settings.reducedMotion ? 3 : 9;
  for(let i=0;i<n;i++){
    pushParticle({x:x+(Math.random()-0.5)*spread, y, vx:(Math.random()-0.5)*160, vy:-Math.random()*160, life:0.6, maxLife:0.6, size:5+Math.random()*5, color:'#1a1a1a', gravity:true});
  }
}
function spawnDeathBurst(p, reason, impactVx, impactVy){
  const cx = p.x + p.w/2, cy = p.y + p.h/2;
  const hasDir = Math.hypot(impactVx, impactVy) > 30;
  const dirA = Math.atan2(impactVy, impactVx);
  // The stickman breaks into its own limbs: torso, 2 arms, 2 legs, head.
  const limbs = save.settings.reducedMotion ? 3 : 6;
  for(let i=0;i<limbs;i++){
    const a = hasDir ? dirA + Math.PI + (Math.random()-0.5)*2.4 : -Math.PI/2 + (Math.random()-0.5)*2.6;
    const sp = 220 + Math.random()*220;
    pushParticle({
      x:cx, y:cy - 10 + Math.random()*20, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 120,
      life:0.9, maxLife:0.9, size: i === 5 ? 15 : 22 + Math.random()*6, color:'#161616',
      gravity:true, collides:true, shape: i === 5 ? 'head' : 'line', rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*16
    });
  }
  if(reason !== 'fall' && !save.settings.reducedMotion){
    for(let i=0;i<10;i++){
      const a = Math.random()*Math.PI*2, sp = 120 + Math.random()*220;
      pushParticle({x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 80, life:0.45, maxLife:0.45, size:3+Math.random()*3, color:'#e0323c', gravity:true});
    }
  }
}
function spawnSparkle(x, y){
  if(save.settings.reducedMotion) return;
  for(let i=0;i<10;i++){
    const a = Math.random()*Math.PI*2;
    pushParticle({x, y, vx:Math.cos(a)*120, vy:Math.sin(a)*120-60, life:0.5, maxLife:0.5, size:3, color:'#f2b632', gravity:true});
  }
}
const CONFETTI_COLORS = ['#e0323c','#f2b632','#1a1a1a','#fffdf8'];
function spawnConfetti(x, y){
  if(save.settings.reducedMotion) return;
  for(let i=0;i<46;i++){
    const a = -Math.PI/2 + (Math.random()-0.5)*2.2, sp = 220+Math.random()*260;
    pushParticle({x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1+Math.random()*0.8, maxLife:1.8, size:3+Math.random()*3,
      color:CONFETTI_COLORS[i%CONFETTI_COLORS.length], gravity:true, drag:0.99, shape:(i%3===0?'line':'sq'), rot:Math.random()*6.28, rotSpeed:(Math.random()-0.5)*10});
  }
}
function updateParticles(dt){
  if(!particles.length) return;
  const solids = levelState ? solidsOf(levelState) : null;
  for(const pt of particles){
    const prevY = pt.y;
    pt.x += pt.vx*dt; pt.y += pt.vy*dt;
    if(pt.gravity) pt.vy += 1100*dt;
    if(pt.drag){ pt.vx *= pt.drag; }
    if(pt.rotSpeed) pt.rot += pt.rotSpeed*dt;
    if(pt.collides && solids && pt.vy > 0){
      for(const s of solids){
        if(pt.x > s.x && pt.x < s.x+s.w && prevY <= s.y && pt.y >= s.y){
          pt.y = s.y;
          if(!pt.bounced && pt.vy > 120){ pt.vy *= -0.35; pt.vx *= 0.6; pt.bounced = true; pt.rotSpeed *= 0.5; }
          else { pt.vy = 0; pt.vx *= 0.7; pt.rotSpeed = 0; }
          break;
        }
      }
    }
    pt.life -= dt;
  }
  particles = particles.filter(pt=>pt.life > 0);
}

/* =========================================================================
   DEATH / WIN
========================================================================= */
function killPlayer(reason){
  if(gameState !== 'playing') return;
  const ls = levelState, p = ls.player;
  const ivx = p.vx, ivy = p.vy;
  p.dead = true; p.vx = 0; p.vy = 0;
  gameState = 'dead';
  ls.deadT = 0;
  ls.deathReason = reason;
  attemptDeaths++;
  save.totalDeaths++;
  persistSave();
  spawnDeathBurst(p, reason, ivx, ivy);
  Sound.death(reason);
  vibrate(HAPTIC.strong);
  if(!save.settings.reducedMotion){ camera.shake = Math.max(camera.shake, 10); ls.flash = 1; }
  updateHud();
  const pool = (ls.data.deathMessages || []).concat(GLOBAL_DEATH_MESSAGES);
  if(Math.random() < 0.5) showToast(pool[Math.floor(Math.random()*pool.length)]);
}

function triggerWin(){
  if(gameState !== 'playing') return;
  const ls = levelState, data = ls.data, p = ls.player;
  p.won = true; p.vx = 0;
  gameState = 'won';
  ls.winT = 0;
  if(save.completedLevels.indexOf(data.id) < 0) save.completedLevels.push(data.id);
  const isFinale = currentLevelIndex + 1 >= LEVELS.length;
  if(!isFinale) save.unlockedLevel = Math.max(save.unlockedLevel, LEVELS[currentLevelIndex+1].id); // never lowers progress
  const st = isPlainObject(save.levelStats[data.id]) ? save.levelStats[data.id] : {};
  st.clears = (parseInt(st.clears,10) || 0) + 1;
  const t = Math.round(attemptTime*100)/100;
  const prevBest = parseFloat(st.bestTime);
  const newBest = !(prevBest > 0) || t < prevBest;
  if(newBest) st.bestTime = t;
  if(!(st.bestDeaths >= 0) || attemptDeaths < st.bestDeaths) st.bestDeaths = attemptDeaths;
  save.levelStats[data.id] = st;
  persistSave();

  if(isFinale){ Sound.finale(); vibrate(HAPTIC.strong); }
  else { Sound.victory(); vibrate(HAPTIC.small); }
  $('winMsg').textContent = data.completionMessage || ' ';
  $('btnNext').hidden = isFinale;
  $('btnWinMenu').hidden = !isFinale;
  $('winTitle').textContent = isFinale ? 'ALL 5 LEVELS CLEARED' : 'LEVEL ' + data.id + ' CLEAR';
  let stats = 'Time ' + t.toFixed(2) + 's' + (newBest && st.clears > 1 ? ' (best!)' : '') + ' · Deaths ' + attemptDeaths;
  if(isFinale) stats += ' · Total deaths ' + save.totalDeaths;
  $('winStats').textContent = stats;
  $('winHint').textContent = touchUI ? '' : (isFinale ? 'Press Enter for level select' : 'Press Enter for the next level');
  if(isFinale){
    const gx = ls.goal.x + ls.goal.w/2, gy = ls.goal.y + ls.goal.h/2;
    spawnConfetti(gx, gy);
    setTimeout(()=>spawnConfetti(gx, gy), 350);
  }
  setTimeout(()=>{
    if(gameState !== 'won') return;
    showOverlay('winOverlay');
    const focusBtn = isFinale ? $('btnWinMenu') : $('btnNext');
    try{ focusBtn.focus({preventScroll:true}); }catch(e){}
  }, 450);
  updateHud();
}

function goNextFromWin(){
  Sound.uiClick();
  if(currentLevelIndex + 1 < LEVELS.length) loadLevel(currentLevelIndex + 1);
  else openMenu();
}

/* =========================================================================
   LAYOUT / RENDERING
========================================================================= */
function layout(){
  const r = app.getBoundingClientRect();
  let w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
  if(w/h > MAX_ASPECT) w = Math.floor(h*MAX_ASPECT); // ultra-wide: side bars
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.round(w*dpr), bh = Math.round(h*dpr);
  if(canvas.width !== bw || canvas.height !== bh){ canvas.width = bw; canvas.height = bh; }
  view.cssW = w; view.cssH = h; view.dpr = dpr;
  view.scale = Math.min(h/VH, w/MIN_VIEW_W);
  view.w = w/view.scale;
  view.h = h/view.scale;
  const extra = Math.max(0, view.h - VH);
  view.band = touchUI ? Math.min(extra, TOUCH_BAND_CSS/view.scale) : 0;
  view.offY = extra - view.band;
  root.classList.toggle('dgm-portrait', view.band > 1);
  stage.style.setProperty('--dgm-band', Math.round(view.band*view.scale) + 'px');
  // Touch layouts without a control band (landscape): let the camera run
  // past the level edges far enough that the spawn point and the exit are
  // never hidden under the d-pad or the jump button.
  view.padL = view.padR = 0;
  if(touchUI && view.band <= 1){
    const st = stage.getBoundingClientRect();
    const dp = dpad.getBoundingClientRect(), jb = btnJump.getBoundingClientRect();
    if(dp.width) view.padL = Math.max(0, (dp.right - st.left + 24)/view.scale - 60);
    if(jb.width) view.padR = Math.max(0, (st.right - jb.left + 24)/view.scale - 80);
  }
}
if(typeof ResizeObserver === 'function') new ResizeObserver(()=>layout()).observe(app);
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', ()=>setTimeout(layout, 120));

function cameraTarget(ls){
  const p = ls.player;
  const minX = -view.padL;
  const maxX = ls.data.width - view.w + view.padR;
  if(maxX <= minX) return (minX + maxX)/2;
  const tx = p.x + p.w/2 - view.w*0.4 + p.facing*view.w*0.04;
  return Math.max(minX, Math.min(tx, maxX));
}
function snapCameraToPlayer(){ if(levelState) camera.x = cameraTarget(levelState); }
function updateCamera(ls, dt){
  const tx = cameraTarget(ls);
  camera.x += (tx - camera.x) * (1 - Math.exp(-dt*7));
  camera.shake = Math.max(0, camera.shake - dt*40);
}

function makeHillLayer(seed, width, baseY, amplitude){
  const pts = [];
  const segments = Math.max(8, Math.floor(width/220));
  for(let i=0;i<=segments;i++){
    const x = (width/segments)*i - 1200;
    const n = Math.sin(i*1.3+seed)*0.6 + Math.sin(i*0.6+seed*1.7)*0.4;
    pts.push({x, y: baseY - amplitude*0.5 - n*amplitude*0.5});
  }
  return pts;
}
function drawHillLayer(pts, color, factor){
  ctx.save();
  ctx.translate(-camera.x*factor, 0);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(pts[pts.length-1].x, VH);
  ctx.lineTo(pts[0].x, VH);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

const COL = { sky:'#efe9dc', far:'#e5dcc7', near:'#d9cfb4', ink:'#1a1a1a', inkHi:'#323232', red:'#e0323c', redDark:'#b91c26', gold:'#f2b632', cream:'#fffdf8', deck:'#24221e' };

function draw(){
  const s = view.scale*view.dpr;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = COL.sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if(!levelState) return;
  const ls = levelState;
  let shx = 0, shy = 0;
  if(camera.shake > 0.2 && !save.settings.reducedMotion){
    shx = (Math.random()-0.5)*camera.shake; shy = (Math.random()-0.5)*camera.shake;
  }
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.translate(shx, view.offY + shy);

  drawHillLayer(ls.hillsFar, COL.far, 0.25);
  drawHillLayer(ls.hillsNear, COL.near, 0.5);

  ctx.save();
  ctx.translate(-camera.x, 0);
  drawAnnotations(ls.data.annotations);
  drawCheckpoints(ls);
  drawGoal(ls);
  drawPlatforms(ls);
  drawHazards(ls);
  drawParticles();
  if(!ls.player.dead) drawPlayer(ls.player);
  drawChasers(ls);
  ctx.restore();

  // touch-control deck under the world (portrait only)
  if(view.band > 0){
    ctx.fillStyle = COL.deck;
    ctx.fillRect(-10, VH, view.w + 20, view.band + 10);
    ctx.fillStyle = 'rgba(224,50,60,0.55)';
    ctx.fillRect(-10, VH, view.w + 20, 3/view.scale);
  }

  if(ls.flash > 0){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = 'rgba(224,50,60,' + (ls.flash*0.14).toFixed(3) + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function roundRect(x, y, w, h, r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function drawPlatforms(ls){
  const x0 = camera.x - 50, x1 = camera.x + view.w + 50;
  for(const p of ls.plats){
    if(p.removed) continue;
    if(p.cx > x1 || p.cx + p.w < x0) continue;
    let alpha = 1;
    if(p.type === 'invisible'){
      if(!p.discovered) continue;
      p.revealT = Math.min(1, (p.revealT || 0) + 0.06);
      alpha = 0.35 + 0.4*p.revealT;
    }
    const x = p.cx + (p.shake || 0), y = p.cy;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COL.ink;
    roundRect(x, y, p.w, p.h, 8);
    ctx.fill();
    // subtle top lip keeps edges readable against the dark mass
    ctx.fillStyle = COL.inkHi;
    ctx.fillRect(x+6, y+3, p.w-12, 3);
    if(p.type === 'moving'){
      ctx.strokeStyle = 'rgba(26,26,26,0.22)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(p.path.x1 + p.w/2, p.path.y1 + p.h/2);
      ctx.lineTo(p.path.x2 + p.w/2, p.path.y2 + p.h/2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COL.cream;
      ctx.beginPath(); ctx.arc(x+14, y+p.h/2, 3, 0, 6.283); ctx.arc(x+p.w-14, y+p.h/2, 3, 0, 6.283); ctx.fill();
    }
    if(p.triggered){
      ctx.strokeStyle = 'rgba(224,50,60,0.85)';
      ctx.lineWidth = 3;
      const ch = Math.min(p.h, 70);
      ctx.beginPath();
      ctx.moveTo(x+p.w*0.2, y+2); ctx.lineTo(x+p.w*0.35, y+ch*0.5); ctx.lineTo(x+p.w*0.28, y+ch);
      ctx.moveTo(x+p.w*0.7, y+2); ctx.lineTo(x+p.w*0.58, y+ch*0.45); ctx.lineTo(x+p.w*0.66, y+ch*0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawSpikeTeeth(x, y, w, h, color){
  const n = Math.max(2, Math.round(w/13));
  const sw = w/n, baseY = y+h;
  ctx.fillStyle = color || COL.red;
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const jitter = (i%3===1) ? 0.8 : (i%3===2 ? 0.92 : 1);
    const x0 = x + i*sw;
    ctx.moveTo(x0+0.5, baseY);
    ctx.lineTo(x0+sw/2, baseY - h*jitter);
    ctx.lineTo(x0+sw-0.5, baseY);
  }
  ctx.fill();
}
function drawDownTeeth(x, y, w, h, color){
  const n = Math.max(2, Math.round(w/14));
  const sw = w/n;
  ctx.fillStyle = color;
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const x0 = x + i*sw;
    ctx.moveTo(x0+0.5, y); ctx.lineTo(x0+sw/2, y+h); ctx.lineTo(x0+sw-0.5, y);
  }
  ctx.fill();
}

let sawSpin = 0;
function drawHazards(ls){
  sawSpin += save.settings.reducedMotion ? 0.06 : 0.22;
  for(const hz of ls.hazards){
    if(hz.type === 'chaser') continue;
    if(hz.type === 'hiddenSpike'){
      if(!hz.revealed) continue;
      const k = hz.popT;
      drawSpikeTeeth(hz.x, hz.y + hz.h*(1-k), hz.w, hz.h*k);
      continue;
    }
    if(hz.type === 'saw'){
      const cx = hz.cx + hz.w/2, cy = hz.cy + hz.h/2, r = Math.min(hz.w, hz.h)/2;
      if(hz.path){
        ctx.strokeStyle = 'rgba(26,26,26,0.18)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hz.path.x1+hz.w/2, hz.path.y1+hz.h/2); ctx.lineTo(hz.path.x2+hz.w/2, hz.path.y2+hz.h/2); ctx.stroke();
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sawSpin);
      ctx.fillStyle = COL.red;
      ctx.beginPath();
      const teeth = 12;
      for(let i=0;i<teeth;i++){
        const a0 = (i/teeth)*6.2832, a1 = ((i+0.5)/teeth)*6.2832;
        ctx.lineTo(Math.cos(a0)*r*0.74, Math.sin(a0)*r*0.74);
        ctx.lineTo(Math.cos(a1)*r, Math.sin(a1)*r);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = COL.ink;
      ctx.beginPath(); ctx.arc(0, 0, r*0.42, 0, 6.2832); ctx.fill();
      ctx.fillStyle = COL.red;
      ctx.beginPath(); ctx.arc(0, 0, r*0.12, 0, 6.2832); ctx.fill();
      ctx.restore();
      continue;
    }
    if(hz.type === 'fallingCeiling'){
      const x = hz.x + (hz.shake || 0), y = hz.y;
      const bodyH = hz.h*0.62;
      const warn = hz.state === 'warning';
      if(hz.state !== 'rested'){
        // chain to the ceiling so it reads as "hanging", not floating
        ctx.strokeStyle = 'rgba(26,26,26,0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x+hz.w*0.25, -400); ctx.lineTo(x+hz.w*0.25, y); ctx.moveTo(x+hz.w*0.75, -400); ctx.lineTo(x+hz.w*0.75, y); ctx.stroke();
      }
      ctx.fillStyle = COL.ink;
      roundRect(x, y, hz.w, bodyH, 5); ctx.fill();
      if(hz.state === 'rested'){
        ctx.fillStyle = COL.ink;
        ctx.fillRect(x, y+bodyH-6, hz.w, hz.h-bodyH+6);
        ctx.fillStyle = COL.inkHi; ctx.fillRect(x+6, y+3, hz.w-12, 3);
      } else {
        drawDownTeeth(x, y+bodyH, hz.w, hz.h-bodyH, COL.red);
        if(warn && Math.floor(hz.stateT*14)%2 === 0){
          ctx.strokeStyle = COL.red; ctx.lineWidth = 4;
          roundRect(x-4, y-4, hz.w+8, bodyH+8, 7); ctx.stroke();
        }
        ctx.fillStyle = warn ? COL.red : COL.cream;
        ctx.font = '900 34px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', x+hz.w/2, y+bodyH*0.78);
        ctx.textAlign = 'start';
      }
      continue;
    }
    if(hz.type === 'spike') drawSpikeTeeth(hz.x, hz.y, hz.w, hz.h);
  }
}

function drawChasers(ls){
  for(const hz of ls.hazards){
    if(hz.type !== 'chaser' || hz.front < camera.x - 400) continue;
    const f = hz.front;
    const left = Math.max(camera.x - 200, f - 3000);
    const top = -view.offY - 50, bottom = VH + view.band + 50;
    ctx.fillStyle = COL.ink;
    ctx.fillRect(left, top, f - 26 - left, bottom - top);
    // red sawtooth edge, scrolling while it moves
    const tooth = 36, off = hz.running ? (hz.front % tooth) : 0;
    ctx.fillStyle = COL.red;
    ctx.beginPath();
    for(let y = top - tooth + off; y < bottom; y += tooth){
      ctx.moveTo(f - 28, y); ctx.lineTo(f, y + tooth/2); ctx.lineTo(f - 28, y + tooth);
    }
    ctx.fill();
    if(hz.running && !save.settings.reducedMotion){
      ctx.strokeStyle = 'rgba(26,26,26,0.25)'; ctx.lineWidth = 3;
      for(let i=0;i<5;i++){
        const yy = 120 + i*150 + ((ls.elapsed*400 + i*77) % 60);
        ctx.beginPath(); ctx.moveTo(f + 14, yy); ctx.lineTo(f + 44 + (i%2)*20, yy); ctx.stroke();
      }
    }
  }
}

function drawCheckpoints(ls){
  const cps = ls.data.checkpoints || [];
  for(let i=0;i<cps.length;i++){
    const c = cps[i], on = i <= checkpointIndex;
    ctx.fillStyle = COL.ink;
    ctx.fillRect(c.x - 2, c.y - 110, 5, 110);
    const wave = on && !save.settings.reducedMotion ? Math.sin(ls.elapsed*6)*4 : 0;
    ctx.beginPath();
    ctx.moveTo(c.x + 3, c.y - 108);
    ctx.lineTo(c.x + 46, c.y - 96 + wave);
    ctx.lineTo(c.x + 3, c.y - 80);
    ctx.closePath();
    ctx.fillStyle = on ? COL.gold : COL.cream;
    ctx.fill();
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 3; ctx.stroke();
  }
}

function drawGoal(ls){
  const g = ls.goal;
  const won = ls.player.won;
  const x = g.x, y = g.y, w = g.w, h = g.h;
  // warm light spilling from the exit — the one gold thing in the level
  const glow = ctx.createRadialGradient(x+w/2, y+h*0.55, 10, x+w/2, y+h*0.55, 110);
  glow.addColorStop(0, 'rgba(242,182,50,0.35)');
  glow.addColorStop(1, 'rgba(242,182,50,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x-110, y-80, w+220, h+160);
  // frame
  ctx.fillStyle = COL.ink;
  roundRect(x-7, y-7, w+14, h+7, 9); ctx.fill();
  // opening (lit)
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x, y, w, h);
  // door leaf swings open on win
  const open = won ? Math.min(1, ls.winT*3) : 0;
  ctx.fillStyle = '#e9e1cd';
  ctx.fillRect(x, y, w*(1-open*0.8), h);
  ctx.fillStyle = COL.ink;
  if(open < 0.6) ctx.fillRect(x + w*(1-open*0.8) - 14, y + h*0.5, 6, 11);
  // EXIT sign
  ctx.fillStyle = COL.ink;
  roundRect(x + w/2 - 26, y - 34, 52, 22, 4); ctx.fill();
  ctx.fillStyle = COL.gold;
  ctx.font = '800 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', x + w/2, y - 18);
  ctx.textAlign = 'start';
}

function drawAnnotations(list){
  if(!list || !list.length) return;
  ctx.font = '700 30px Caveat, "Comic Sans MS", cursive';
  ctx.fillStyle = '#6b6352';
  for(const a of list){
    ctx.fillText((touchUI && a.touchText) ? a.touchText : a.text, a.x, a.y);
  }
}

function drawParticles(){
  for(const pt of particles){
    ctx.globalAlpha = Math.max(0, Math.min(1, pt.life/pt.maxLife*1.4));
    ctx.fillStyle = pt.color;
    if(pt.shape === 'line'){
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot || 0);
      ctx.fillRect(-pt.size/2, -2.5, pt.size, 5);
      ctx.restore();
    } else if(pt.shape === 'head'){
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size/2, 0, 6.2832); ctx.fill();
    } else {
      ctx.fillRect(pt.x - pt.size/2, pt.y - pt.size/2, pt.size, pt.size);
    }
  }
  ctx.globalAlpha = 1;
}

/* ---- stickman: joint-based procedural animation ----
   limbs are two-segment chains computed from a handful of continuous pose
   parameters (lean, crouch, stride phase) so motion blends naturally. */
const LEG_THIGH=14, LEG_SHIN=14, ARM_UPPER=12, ARM_FORE=12, TORSO_LEN=20, NECK_HEAD=11, HEAD_R=8;

function limbEnd(ox, oy, a1, l1, bend, l2){
  const kx = ox + Math.sin(a1)*l1, ky = oy + Math.cos(a1)*l1;
  const a2 = a1 - bend;
  return {kx, ky, ex:kx + Math.sin(a2)*l2, ey:ky + Math.cos(a2)*l2};
}

function computePose(p){
  const t = p.t, phase = p.locoPhase || 0;
  const speedT = Math.min(1, Math.abs(p.vx)/MOVE_SPEED);
  const pose = { torsoLean:0, headTilt:0, hipDrop:0, thighL:0, thighR:0, shinL:0.08, shinR:0.08,
    armL:0, armR:0, elbowL:0.3, elbowR:0.3, squashX:1, squashY:1 };
  const shake = p.standingOn && p.standingOn.shake ? p.standingOn.shake : 0;
  switch(p.state){
    case 'idle': {
      const breathe = Math.sin(p.idleT*1.3);
      pose.hipDrop = -breathe*1.2 + shake*0.6;
      pose.torsoLean = Math.sin(p.idleT*0.35)*0.02 + shake*0.012;
      pose.headTilt = Math.sin(p.idleT*0.5+1)*0.05;
      pose.thighL = 0.04*Math.sin(p.idleT*0.6); pose.thighR = 0.04*Math.sin(p.idleT*0.6+2);
      pose.shinL = 0.05; pose.shinR = 0.05;
      pose.armL = 0.15+0.04*Math.sin(p.idleT*0.7); pose.armR = -0.15-0.04*Math.sin(p.idleT*0.7+1);
      pose.elbowL = 0.35; pose.elbowR = 0.35;
      break;
    }
    case 'walk':
    case 'run': {
      const ampThigh = 0.22+0.58*speedT, ampShin = 0.18+0.92*speedT, ampArm = 0.22+0.46*speedT;
      pose.thighL = ampThigh*Math.sin(phase); pose.thighR = ampThigh*Math.sin(phase+Math.PI);
      pose.shinL = Math.max(0.05, ampShin*Math.sin(phase-1.1)); pose.shinR = Math.max(0.05, ampShin*Math.sin(phase+Math.PI-1.1));
      pose.armL = -ampArm*Math.sin(phase); pose.armR = -ampArm*Math.sin(phase+Math.PI);
      pose.elbowL = 0.3+Math.max(0,0.5*Math.sin(phase+0.6)); pose.elbowR = 0.3+Math.max(0,0.5*Math.sin(phase+Math.PI+0.6));
      pose.hipDrop = Math.abs(Math.sin(phase))*(1.5+4*speedT)*0.6 + shake*0.6;
      pose.torsoLean = (0.05+0.26*speedT) + (p.accelLean||0) + shake*0.012;
      pose.headTilt = Math.sin(phase*2)*0.02*speedT - pose.torsoLean*0.3;
      break;
    }
    case 'jump': {
      const launchT = Math.min(1, (p.airTime||0)/0.14);
      pose.thighL = -0.55-0.1*launchT; pose.thighR = -0.4-0.1*launchT;
      pose.shinL = 0.75-0.15*launchT; pose.shinR = 0.55-0.1*launchT;
      pose.torsoLean = -0.12 + (p.accelLean||0)*0.5;
      pose.armL = -1.9-0.15*Math.sin(t*5); pose.armR = -1.7-0.15*Math.sin(t*5+1);
      pose.hipDrop = -2*(1-launchT);
      pose.squashX = 1.08-0.1*launchT; pose.squashY = 0.92+0.14*launchT;
      break;
    }
    case 'fall': {
      const fallFrac = Math.min(1, Math.abs(p.vy)/900);
      pose.thighL = 0.35+0.12*Math.sin(t*8); pose.thighR = 0.35+0.12*Math.sin(t*8+1.4);
      pose.shinL = 0.55+0.15*Math.sin(t*9+0.6); pose.shinR = 0.55+0.15*Math.sin(t*9+2);
      pose.torsoLean = 0.06*speedT - fallFrac*0.05;
      pose.headTilt = -fallFrac*0.08;
      pose.armL = -1.1+0.3*Math.sin(t*7); pose.armR = 1.1-0.3*Math.sin(t*7+1);
      pose.elbowL = 0.45; pose.elbowR = 0.45;
      pose.squashX = 0.95-0.03*fallFrac; pose.squashY = 1.05+0.08*fallFrac;
      break;
    }
    case 'land': {
      const crouch = Math.max(0, p.landTimer)/0.14;
      pose.thighL = 0.42*crouch; pose.thighR = 0.42*crouch;
      pose.shinL = 0.7*crouch; pose.shinR = 0.7*crouch;
      pose.headTilt = 0.05*crouch;
      pose.armL = 0.5*crouch; pose.armR = -0.5*crouch;
      pose.elbowL = 0.25+0.2*crouch; pose.elbowR = 0.25+0.2*crouch;
      pose.hipDrop = 5*crouch;
      pose.squashX = 1+0.18*crouch; pose.squashY = 1-0.22*crouch;
      break;
    }
    case 'victory': {
      pose.hipDrop = -Math.abs(Math.sin(t*6))*3.5;
      pose.thighL = 0.3*Math.sin(t*6); pose.thighR = -0.3*Math.sin(t*6);
      pose.shinL = 0.3; pose.shinR = 0.3;
      pose.headTilt = 0.05*Math.sin(t*6);
      pose.armL = -2.6+0.12*Math.sin(t*8); pose.armR = 2.6-0.12*Math.sin(t*8+1);
      pose.elbowL = 0.2; pose.elbowR = 0.2;
      break;
    }
  }
  if(p.bumpTimer > 0){
    const bt = p.bumpTimer/0.14;
    pose.squashX *= (1-0.22*bt); pose.squashY *= (1+0.12*bt);
  }
  return pose;
}

function drawStickman(c, pose, lineW){
  const hipY = -(LEG_THIGH+LEG_SHIN) + pose.hipDrop;
  const shX = Math.sin(pose.torsoLean)*TORSO_LEN, shY = hipY - Math.cos(pose.torsoLean)*TORSO_LEN;
  const ha = pose.torsoLean + pose.headTilt;
  const hx = shX + Math.sin(ha)*NECK_HEAD, hy = shY - Math.cos(ha)*NECK_HEAD;
  c.strokeStyle = '#161616'; c.fillStyle = '#161616';
  c.lineWidth = lineW; c.lineCap = 'round'; c.lineJoin = 'round';
  const legL = limbEnd(0, hipY, pose.thighL, LEG_THIGH, pose.shinL, LEG_SHIN);
  const legR = limbEnd(0, hipY, pose.thighR, LEG_THIGH, pose.shinR, LEG_SHIN);
  const armL = limbEnd(shX, shY, pose.armL, ARM_UPPER, pose.elbowL, ARM_FORE);
  const armR = limbEnd(shX, shY, pose.armR, ARM_UPPER, pose.elbowR, ARM_FORE);
  c.beginPath();
  c.moveTo(0, hipY); c.lineTo(shX, shY);
  c.moveTo(0, hipY); c.lineTo(legL.kx, legL.ky); c.lineTo(legL.ex, legL.ey);
  c.moveTo(0, hipY); c.lineTo(legR.kx, legR.ky); c.lineTo(legR.ex, legR.ey);
  c.moveTo(shX, shY); c.lineTo(armL.kx, armL.ky); c.lineTo(armL.ex, armL.ey);
  c.moveTo(shX, shY); c.lineTo(armR.kx, armR.ky); c.lineTo(armR.ex, armR.ey);
  c.stroke();
  c.beginPath(); c.arc(hx, hy, HEAD_R, 0, 6.2832); c.fill();
}

function drawPlayer(p){
  const pose = computePose(p);
  ctx.save();
  ctx.translate(p.x + p.w/2, p.y + p.h);
  ctx.scale(p.facing, 1);
  const pop = p.spawnT < 1 ? 0.6 + 0.4*p.spawnT + Math.sin(p.spawnT*Math.PI)*0.12 : 1;
  ctx.scale(pose.squashX*pop, pose.squashY*pop);
  if(p.won){
    const fade = Math.max(0, 1 - Math.max(0, levelState.winT - 0.15)*3);
    ctx.globalAlpha = fade;
  }
  drawStickman(ctx, pose, 5);
  ctx.restore();
}

/* =========================================================================
   HUD / UI
========================================================================= */
function updateHud(){
  const data = LEVELS[currentLevelIndex];
  $('levelLabel').textContent = 'LEVEL ' + data.id;
  $('levelSub').textContent = data.name;
  $('progressText').textContent = data.id + ' / ' + LEVELS.length;
  $('deathsText').textContent = 'Deaths: ' + save.totalDeaths;
}
function isUnlocked(i){
  const lvl = LEVELS[i];
  return lvl.id <= save.unlockedLevel || i === 0 || save.completedLevels.indexOf(lvl.id) >= 0 ||
    save.completedLevels.indexOf(LEVELS[i-1].id) >= 0;
}
function buildLevelGrid(){
  const grid = $('levelGrid');
  grid.textContent = '';
  LEVELS.forEach((lvl, i)=>{
    const unlocked = isUnlocked(i);
    const done = save.completedLevels.indexOf(lvl.id) >= 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lvl-tile' + (unlocked ? '' : ' locked') + (done ? ' done' : '') + (i === currentLevelIndex && levelState ? ' current' : '');
    const num = document.createElement('span'); num.className = 'n'; num.textContent = unlocked ? String(lvl.id) : '\u{1F512}';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = unlocked ? lvl.name : 'Locked';
    btn.appendChild(num); btn.appendChild(nm);
    const st = save.levelStats[lvl.id];
    if(done && st && st.bestTime){
      const b = document.createElement('span'); b.className = 'bt'; b.textContent = Number(st.bestTime).toFixed(1) + 's';
      btn.appendChild(b);
    }
    btn.setAttribute('aria-label', unlocked ? ('Level ' + lvl.id + ': ' + lvl.name + (done ? ' (cleared)' : '')) : ('Level ' + lvl.id + ' locked'));
    if(unlocked){
      btn.addEventListener('click', ()=>{
        Sound.unlock(); Sound.uiClick();
        $('startScreen').hidden = true;
        loadLevel(i);
      });
    } else btn.disabled = true;
    grid.appendChild(btn);
  });
}

function showOverlay(id){
  root.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show'));
  $(id).classList.add('show');
}
function hideAllOverlays(){
  root.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show'));
}
function focusFirst(id){
  const b = $(id).querySelector('button:not([disabled]):not([hidden])');
  if(b){ try{ b.focus({preventScroll:true}); }catch(e){} }
}

function showToast(text){
  const el = $('toastMsg');
  el.textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function showLevelToast(data){
  $('worldToastSub').textContent = 'LEVEL ' + data.id;
  $('worldToastMain').textContent = data.name;
  const el = $('worldToast');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

function pauseGame(){
  if(gameState !== 'playing' && gameState !== 'dead') return;
  gameState = 'paused';
  clearKeys();
  showOverlay('pauseOverlay');
  focusFirst('pauseOverlay');
}
function resumeGame(){
  if(gameState !== 'paused') return;
  Sound.uiClick();
  gameState = levelState && levelState.player.dead ? 'dead' : 'playing';
  hideAllOverlays();
  lastFrame = 0;
}
function togglePause(){
  if(gameState === 'playing' || gameState === 'dead'){ Sound.uiClick(); pauseGame(); }
  else if(gameState === 'paused') resumeGame();
}
let settingsReturn = null;
function openSettings(){
  Sound.uiClick();
  if(gameState === 'playing' || gameState === 'dead'){ gameState = 'paused'; clearKeys(); }
  settingsReturn = gameState === 'paused' ? 'pause' : null;
  refreshSettingsUI();
  showOverlay('settingsOverlay');
  focusFirst('settingsOverlay');
}
function closeSettings(){
  Sound.uiClick();
  if(settingsReturn === 'pause' && gameState === 'paused'){ showOverlay('pauseOverlay'); focusFirst('pauseOverlay'); }
  else hideAllOverlays();
}
function openMenu(){
  if(gameState === 'playing' || gameState === 'dead') gameState = 'paused';
  buildLevelGrid();
  showOverlay('menuOverlay');
  focusFirst('menuOverlay');
}
function closeMenu(){
  Sound.uiClick();
  hideAllOverlays();
  if(!levelState){ return; }
  if(gameState === 'won'){ showOverlay('winOverlay'); return; }
  if(gameState === 'paused'){ gameState = levelState.player.dead ? 'dead' : 'playing'; lastFrame = 0; }
}

function refreshSettingsUI(){
  root.querySelectorAll('.switch').forEach(sw=>{
    const on = !!save.settings[sw.dataset.setting];
    sw.classList.toggle('on', on);
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
root.querySelectorAll('.switch').forEach(sw=>{
  sw.addEventListener('click', ()=>{
    const key = sw.dataset.setting;
    save.settings[key] = !save.settings[key];
    persistSave();
    refreshSettingsUI();
    Sound.unlock();
    Sound.uiClick();
    if(key === 'music'){ if(save.settings.music) Sound.startMusic(); else Sound.stopMusic(); }
    if(key === 'vibration' && save.settings.vibration) vibrate(HAPTIC.small);
  });
});

function bindClick(id, fn){ $(id).addEventListener('click', fn); }
bindClick('btnRestart', ()=>{ Sound.unlock(); Sound.uiClick(); if(levelState && gameState !== 'menu'){ restartLevel(); } });
bindClick('btnSettings', openSettings);
bindClick('btnPause', ()=>{ Sound.unlock(); togglePause(); });
bindClick('btnNext', goNextFromWin);
bindClick('btnReplay', ()=>{ Sound.uiClick(); attemptDeaths = 0; restartLevel(); });
bindClick('btnWinMenu', ()=>{ Sound.uiClick(); openMenu(); });
bindClick('btnResume', resumeGame);
bindClick('btnPauseRestart', ()=>{ Sound.uiClick(); restartLevel(); });
bindClick('btnPauseSettings', openSettings);
bindClick('btnPauseMenu', ()=>{ Sound.uiClick(); openMenu(); });
bindClick('btnCloseSettings', closeSettings);
bindClick('btnCloseMenu', closeMenu);
bindClick('btnPlay', ()=>{
  Sound.unlock(); Sound.uiClick();
  $('startScreen').hidden = true;
  pointerActive = true;
  // continue from the furthest unlocked level that exists in this version
  let idx = 0;
  for(let i=0;i<LEVELS.length;i++) if(isUnlocked(i)) idx = i;
  if(save.completedLevels.length >= LEVELS.length) idx = 0;
  loadLevel(idx);
  try{ stage.focus({preventScroll:true}); }catch(e){}
});
bindClick('btnLevelSelectStart', ()=>{ Sound.unlock(); Sound.uiClick(); openMenu(); });
bindClick('btnSettingsStart', ()=>{ Sound.unlock(); openSettings(); });

// Fullscreen toggle (embedded mode only, where the API exists).
const fsBtn = $('btnFullscreen');
const fsTarget = app;
if(!isFullscreenMode && (document.fullscreenEnabled || document.webkitFullscreenEnabled)){
  fsBtn.hidden = false;
  fsBtn.addEventListener('click', ()=>{
    Sound.uiClick();
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if(active){ (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    else { const req = fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen; if(req){ const r = req.call(fsTarget); if(r && r.catch) r.catch(()=>{}); } }
  });
  const onFs = ()=>{ root.classList.toggle('dgm-is-fs', !!(document.fullscreenElement || document.webkitFullscreenElement)); setTimeout(layout, 50); };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);
}

// Embedded: pause when the game scrolls mostly out of view.
if(!isFullscreenMode && typeof IntersectionObserver === 'function'){
  new IntersectionObserver((entries)=>{
    const e = entries[0];
    if(e && e.intersectionRatio < 0.35 && gameState === 'playing') pauseGame();
  }, {threshold:[0, 0.35]}).observe(app);
}

/* =========================================================================
   MAIN LOOP — fixed 120 Hz simulation, rendered on requestAnimationFrame.
   Results are identical at 30, 60, 120 or 144 Hz displays.
========================================================================= */
function simStep(dt){
  simTime += dt;
  const ls = levelState;
  if(!ls) return;
  if(gameState === 'playing'){
    ls.elapsed += dt;
    attemptTime += dt;
    updateWorld(ls, dt);
    updatePlayer(ls, dt);
  } else if(gameState === 'dead'){
    ls.elapsed += dt;
    ls.deadT += dt;
    updateWorld(ls, dt);
    if(ls.deadT >= RESPAWN_DELAY) respawn();
  } else if(gameState === 'won'){
    ls.winT += dt;
    ls.player.t += dt;
  }
  if(ls.flash > 0) ls.flash = Math.max(0, ls.flash - dt*6);
  if(gameState !== 'paused'){
    updateCamera(levelState, dt);
    updateParticles(dt);
  }
}

function frame(ts){
  advanceFrame(ts);
  requestAnimationFrame(frame);
}
function advanceFrame(ts){
  if(!lastFrame) lastFrame = ts;
  const frameDt = Math.min(0.25, Math.max(0, (ts - lastFrame)/1000));
  lastFrame = ts;
  if(!loopPaused){
    accumulator += frameDt;
    let steps = 0;
    while(accumulator >= STEP - 1e-9 && steps < MAX_STEPS){ simStep(STEP); accumulator -= STEP; steps++; }
    if(steps >= MAX_STEPS) accumulator = 0; // drop time instead of spiralling
  }
  draw();
}

/* Intro stickman on the start screen (stops once the screen is hidden). */
function animateIntro(){
  const c = $('introCanvas');
  const ic = c.getContext('2d');
  const p = { t:0, idleT:0, locoPhase:0, vx:MOVE_SPEED, vy:0, state:'run', airTime:0, accelLean:0, landTimer:0, standingOn:null };
  let last = 0;
  function loop(ts){
    if($('startScreen').hidden) return;
    const dt = last ? Math.min(0.05, (ts-last)/1000) : 0.016; last = ts;
    p.t += dt; p.locoPhase = (p.locoPhase + (MOVE_SPEED/STRIDE_LEN)*dt*Math.PI*2) % (Math.PI*2);
    ic.setTransform(1,0,0,1,0,0);
    ic.clearRect(0, 0, c.width, c.height);
    ic.fillStyle = '#1a1a1a'; ic.fillRect(20, 82, 160, 8);
    ic.translate(100, 82); ic.scale(1.25, 1.25);
    drawStickman(ic, computePose(p), 4);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

/* =========================================================================
   PUBLIC API
   A small read-only surface for integrations (future accounts, leaderboard
   submission via the WordPress REST API, analytics). It never exposes a
   way to grant unlocks or currency.
========================================================================= */
const api = {
  version: GAME_VERSION,
  levels: LEVELS.map(l=>({id:l.id, name:l.name})),
  getProgress(){ return JSON.parse(JSON.stringify({unlockedLevel:save.unlockedLevel, completedLevels:save.completedLevels, totalDeaths:save.totalDeaths, levelStats:save.levelStats})); },
  getState(){ return gameState; }
};
if(DEBUG){
  // Deterministic hooks used by the automated play-through tests.
  api.debug = {
    LEVELS, keys, consts:{STEP, MOVE_SPEED, JUMP_VELOCITY, GRAVITY, PLAYER_W, PLAYER_H},
    setLoopPaused(v){ loopPaused = !!v; },
    start(i){ $('startScreen').hidden = true; pointerActive = true; loadLevel(i); },
    step(n){ for(let i=0;i<(n||1);i++) simStep(STEP); },
    frame(ms){ advanceFrame((lastFrame || performance.now()) + ms); },
    press(k, v){ if(k === 'jump' && v && !keys.jump) jumpPressedAt = simTime; keys[k] = v; },
    level(){ return levelState; },
    state(){ return gameState; },
    checkpoint(){ return checkpointIndex; },
    view(){ return Object.assign({}, view); },
    camera(){ return Object.assign({}, camera); },
    solids(){ return levelState ? solidsOf(levelState).map(s=>({x:s.x,y:s.y,w:s.w,h:s.h})) : []; },
    respawn, restartLevel, layout
  };
}
window.Razebait = api;

/* =========================================================================
   BOOT
========================================================================= */
if(!touchUI) $('startHint').hidden = false; else $('startHint').hidden = true;
layout();
refreshSettingsUI();
updateHud();
buildLevelGrid();
animateIntro();
requestAnimationFrame(frame);
})();
