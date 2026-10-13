'use strict';

/* =========================================================================
   STORAGE
========================================================================= */
const STORAGE_KEY = 'deskmanfun_save_v1';
function defaultSave(){
  return {
    unlockedLevel: 1,
    completedLevels: [],
    totalDeaths: 0,
    settings: { sound:true, music:true, vibration:true, reducedMotion:false }
  };
}
let save = loadSave();
function loadSave(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultSave(), parsed, {settings: Object.assign(defaultSave().settings, parsed.settings||{})});
  }catch(e){ return defaultSave(); }
}
function persistSave(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); }catch(e){}
}

/* =========================================================================
   AUDIO (synthesized, no external files)
========================================================================= */
const Audio_ = (function(){
  let ctx = null;
  let musicNodes = null;
  let musicTimer = null;
  function ensureCtx(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, opts){
    if(!save.settings.sound) return;
    opts = opts || {};
    const c = ensureCtx();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if(opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(opts.sweepTo,1), t0+dur);
    const vol = opts.vol!=null ? opts.vol : 0.18;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0); osc.stop(t0+dur+0.02);
  }
  function chord(freqs, dur, type, opts){
    freqs.forEach(f=>tone(f,dur,type,opts));
  }
  function noiseBurst(dur, opts){
    if(!save.settings.sound) return;
    opts = opts || {};
    const c = ensureCtx();
    const bufferSize = Math.floor(c.sampleRate*dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filt = c.createBiquadFilter();
    filt.type = opts.filterType || 'bandpass';
    filt.frequency.value = opts.freq || 1200;
    if(opts.sweepTo){
      filt.frequency.setValueAtTime(opts.freq||1200, c.currentTime);
      filt.frequency.exponentialRampToValueAtTime(Math.max(opts.sweepTo,10), c.currentTime+dur);
    }
    const gain = c.createGain();
    gain.gain.value = opts.vol!=null?opts.vol:0.2;
    src.connect(filt); filt.connect(gain); gain.connect(c.destination);
    src.start();
  }
  function sequence(notes, type, opts){
    let t=0;
    notes.forEach(n=>{
      setTimeout(()=>tone(n.f, n.d||0.12, type, opts), t*1000);
      t += (n.gap!=null?n.gap:n.d||0.12);
    });
  }
  return {
    jump(){ tone(380,0.09,'square',{sweepTo:620,vol:0.12}); },
    land(){ tone(140,0.08,'sine',{sweepTo:70,vol:0.15}); },
    footstep(){ tone(90,0.03,'square',{vol:0.03}); },
    landHeavy(){ tone(110,0.14,'sine',{sweepTo:50,vol:0.18}); },
    death(reason){
      if(reason==='spike') { noiseBurst(0.18,{freq:2200,sweepTo:200,vol:0.22}); tone(180,0.15,'sawtooth',{sweepTo:40,vol:0.15}); }
      else if(reason==='crush'){ tone(90,0.25,'sine',{sweepTo:30,vol:0.25}); }
      else if(reason==='gravity'){ sequence([{f:300,d:0.1},{f:500,d:0.1},{f:150,d:0.2}],'sine',{vol:0.15}); }
      else { noiseBurst(0.2,{freq:1500,sweepTo:100,vol:0.18}); tone(200,0.2,'triangle',{sweepTo:50,vol:0.12}); }
    },
    victory(){ sequence([{f:523,d:0.11},{f:659,d:0.11},{f:784,d:0.11},{f:1046,d:0.22}],'triangle',{vol:0.16}); },
    coin(){ sequence([{f:880,d:0.07},{f:1318,d:0.12}],'square',{vol:0.12}); },
    button(){ tone(260,0.08,'square',{sweepTo:180,vol:0.14}); },
    doorMove(){ noiseBurst(0.3,{freq:600,sweepTo:1400,vol:0.14,filterType:'highpass'}); },
    doorOpen(){ sequence([{f:300,d:0.1},{f:450,d:0.15}],'sine',{vol:0.14}); },
    teleport(){ noiseBurst(0.3,{freq:3000,sweepTo:200,vol:0.16}); },
    gravityFlip(){ sequence([{f:200,d:0.15,gap:0.1},{f:500,d:0.2}],'sine',{vol:0.17}); },
    checkpoint(){ sequence([{f:660,d:0.08},{f:880,d:0.1}],'sine',{vol:0.12}); },
    trapReveal(){ tone(1400,0.05,'square',{sweepTo:800,vol:0.1}); },
    crack(){ tone(500,0.06,'square',{sweepTo:200,vol:0.08}); },
    recordScratch(){ noiseBurst(0.25,{freq:2000,sweepTo:80,vol:0.22,filterType:'lowpass'}); },
    boing(){ tone(200,0.25,'sine',{sweepTo:700,vol:0.15}); },
    errorBeep(){ sequence([{f:400,d:0.08,gap:0.1},{f:400,d:0.08}],'square',{vol:0.12}); },
    uiClick(){ tone(600,0.04,'sine',{vol:0.08}); },
    wallBump(){ tone(120,0.07,'sine',{sweepTo:60,vol:0.1}); },
    startMusic(){
      if(musicTimer) return;
      const scale = [261.6,293.7,329.6,392.0,440.0,523.2];
      let i=0;
      function playNext(){
        if(!save.settings.music){ return; }
        const f = scale[Math.floor(Math.random()*scale.length)];
        tone(f, 0.5, 'sine', {vol:0.035});
        i++;
      }
      musicTimer = setInterval(()=>{ if(save.settings.music) playNext(); }, 850);
    },
    stopMusic(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } },
    unlock(){ ensureCtx(); }
  };
})();

function vibrate(pattern){
  if(!save.settings.vibration) return;
  if(navigator.vibrate){ try{ navigator.vibrate(pattern); }catch(e){} }
}
const HAPTIC = { small:[12], medium:[25,15,25], strong:[45,30,70] };

/* =========================================================================
   LEVEL DATA  (data-driven; add more objects to LEVELS to extend to 30)
   Schema:
   {
     id, world, worldName, name, subtitle,
     width, height, spawn:{x,y},
     theme: 'default'|'cave'|'city'|'factory',
     reverseControls: bool,
     gravityFlip: bool,
     platforms: [{x,y,w,h,type:'solid'|'disappearing'|'moving'|'breaking'|'invisible',
                  delay, path:{dx,dy,speed}, discovered}],
     hazards: [{x,y,w,h,type:'spike'|'hiddenSpike'|'saw'|'fallingCeiling', revealTrigger:{x,w}, path, active,
                 lethal:bool (default true; false = visual/reactive scare, no death on touch),
                 // saw: path:{x1,y1,x2,y2,speed,pauseStart,pause} same shape as moving platforms
                 // fallingCeiling: triggerZone:{x,w}, warningTime, fallSpeed, restY}],
     goal: {x,y,w,h, type:'normal'|'tease'|'fake', positions:[{x,y}], fakeCount},
     annotations: [{x,y,text}],
     deathMessages: [...], completionMessage: "...",
   }
========================================================================= */
const GLOBAL_DEATH_MESSAGES = [
  "Almost.", "You really fell for that?", "That was intentional.", "Try again.",
  "Interesting choice.", "You knew better.", "So close.", "Again?",
  "I warned you.", "You were doing so well.", "Skill issue. Probably.", "Come on!"
];

const LEVELS = [
  {
    id:1, world:1, worldName:'TRUST', name:'TRUST',
    width:1600, height:900, spawn:{x:90,y:618}, theme:'default',
    platforms:[
      {x:0,y:680,w:500,h:220,type:'solid'},
      {x:620,y:680,w:980,h:220,type:'solid'}
    ],
    hazards:[
      {x:500,y:600,w:120,h:80,type:'pit'},
      {x:1035,y:658,w:40,h:22,type:'spike'}
    ],
    goal:{x:0,y:0,w:70,h:100,type:'tease', positions:[{x:1320,y:580},{x:1450,y:580}], fakeIndex:0, quiet:true},
    annotations:[],
    deathMessages:[],
    silentDeaths:true,
    completionMessage:""
  },
  {
    id:2, world:1, worldName:'TRUST', name:'Disappearing Floor',
    subtitle:'The floor disappears.',
    width:3300, height:900, spawn:{x:90,y:618}, theme:'default',
    platforms:[
      {x:0,y:680,w:300,h:220,type:'solid'},
      {x:300,y:680,w:200,h:220,type:'disappearing', delay:850},
      {x:500,y:680,w:250,h:220,type:'solid'},
      {x:750,y:680,w:150,h:220,type:'disappearing', delay:700},
      {x:900,y:680,w:150,h:220,type:'disappearing', delay:650},
      {x:1050,y:680,w:150,h:220,type:'disappearing', delay:600},
      {x:1200,y:680,w:150,h:220,type:'disappearing', delay:550},
      {x:1350,y:680,w:280,h:220,type:'solid'},
      {x:1630,y:680,w:120,h:34,type:'moving', path:{x1:1630,y1:680,x2:1860,y2:680,speed:150,pauseStart:1.0,pause:1.0}},
      {x:1980,y:680,w:260,h:220,type:'solid'},
      {x:2240,y:680,w:260,h:220,type:'solid', delay:600},
      {x:2500,y:680,w:260,h:220,type:'solid'},
      {x:2760,y:680,w:400,h:220,type:'solid'}
    ],
    hazards:[
      {x:1480,y:658,w:40,h:22,type:'hiddenSpike', revealTrigger:{x:1400,w:140}, lethal:false},
      {x:2560,y:460,w:140,h:70,type:'fallingCeiling', triggerZone:{x:2460,w:160}, warningTime:0.5, fallSpeed:700, restY:590, lethal:false}
    ],
    triggers:[
      {x:2500,y:600,w:80,h:300,targetIndex:10}
    ],
    goal:{x:3060,y:580,w:70,h:100,type:'normal'},
    annotations:[],
    deathMessages:["You trusted the floor.","That was definitely the floor.","It was never going to hold.","You stopped. It noticed.","You blinked. It fell."],
    completionMessage:"Nothing under you was ever permanent. You kept moving anyway."
  },
  {
    id:3, world:1, worldName:'TRUST', name:'HIDDEN',
    subtitle:'Not everything is visible.',
    width:3970, height:900, spawn:{x:90,y:618}, theme:'default',
    platforms:[
      {x:0,y:680,w:220,h:220,type:'solid'},
      {x:330,y:680,w:210,h:220,type:'solid'},
      {x:650,y:680,w:200,h:220,type:'disappearing', delay:550},
      {x:960,y:680,w:710,h:220,type:'solid'},
      {x:1780,y:540,w:390,h:360,type:'solid'},
      {x:2220,y:780,w:300,h:120,type:'solid'},
      {x:2520,y:780,w:320,h:120,type:'invisible'},
      {x:2840,y:780,w:260,h:120,type:'solid'},
      {x:3100,y:780,w:300,h:120,type:'solid'},
      {x:3400,y:780,w:420,h:120,type:'solid'}
    ],
    hazards:[
      {x:1270,y:658,w:40,h:22,type:'hiddenSpike', revealTrigger:{x:1170,w:180}},
      {x:1950,y:500,w:60,h:60,type:'saw', path:{x1:1950,y1:500,x2:2090,y2:500,speed:160,pauseStart:0.5,pause:1.1}},
      {x:3160,y:600,w:150,h:80,type:'fallingCeiling', triggerZone:{x:3060,w:100}, warningTime:0.6, fallSpeed:900, restY:700, lethal:true}
    ],
    goal:{x:0,y:0,w:70,h:100,type:'tease', positions:[{x:3520,y:680},{x:3670,y:680}], fakeIndex:0},
    annotations:[],
    deathMessages:["Not everything is visible.","It was there the whole time.","You should have kept moving.","That wasn't on the map.","Some paths show themselves. Others don't."],
    completionMessage:"You stopped trusting your eyes. Smart."
  },
  {
    id:4, world:1, worldName:'TRUST', name:"DON'T STOP",
    subtitle:'Keep moving.',
    width:3300, height:900, spawn:{x:85,y:618}, theme:'default',
    platforms:[
      {x:0,y:680,w:300,h:220,type:'solid'},
      {x:400,y:680,w:200,h:34,type:'moving', path:{x1:400,y1:680,x2:550,y2:680,speed:140,pauseStart:1.0,pause:1.0}},
      {x:830,y:680,w:180,h:220,type:'disappearing', delay:550},
      {x:1120,y:540,w:220,h:360,type:'solid'},
      {x:1560,y:540,w:180,h:360,type:'solid'},
      {x:1920,y:540,w:150,h:34,type:'moving', path:{x1:1920,y1:540,x2:1920,y2:320,speed:110,pauseStart:1.0,pause:1.0}},
      {x:2170,y:320,w:180,h:580,type:'solid'},
      {x:2430,y:320,w:200,h:580,type:'disappearing', delay:600},
      {x:2630,y:320,w:300,h:580,type:'solid'},
      {x:3040,y:320,w:220,h:580,type:'solid'}
    ],
    hazards:[
      {x:310,y:694,w:510,h:26,type:'spike'},
      {x:1350,y:580,w:190,h:22,type:'spike'}
    ],
    triggers:[
      {x:2710,y:260,w:60,h:640,targetIndex:7}
    ],
    goal:{x:3110,y:220,w:70,h:100,type:'normal'},
    annotations:[],
    deathMessages:["Momentum is everything.","You stopped at the wrong moment.","Almost had it."],
    completionMessage:"You never stopped moving."
  },
  {
    id:5, world:1, worldName:'TRUST', name:'TRUST NOTHING',
    subtitle:'Everything you learned. At once.',
    width:3620, height:900, spawn:{x:80,y:618}, theme:'default',
    platforms:[
      {x:0,y:680,w:250,h:220,type:'solid'},
      {x:400,y:680,w:280,h:220,type:'solid'},
      {x:680,y:680,w:220,h:220,type:'solid'},
      {x:900,y:680,w:180,h:34,type:'moving', path:{x1:900,y1:680,x2:1100,y2:680,speed:150,pauseStart:1.0,pause:1.0}},
      {x:1360,y:680,w:200,h:220,type:'disappearing', delay:550},
      {x:1670,y:560,w:200,h:340,type:'solid'},
      {x:2050,y:560,w:150,h:34,type:'moving', path:{x1:2050,y1:560,x2:2050,y2:380,speed:110,pauseStart:1.0,pause:1.0}},
      {x:2300,y:380,w:190,h:520,type:'solid'},
      {x:2570,y:380,w:200,h:520,type:'disappearing', delay:600},
      {x:2770,y:380,w:280,h:520,type:'solid'},
      {x:3150,y:380,w:420,h:520,type:'solid'}
    ],
    hazards:[
      {x:600,y:658,w:36,h:22,type:'spike'},
      {x:840,y:694,w:400,h:26,type:'spike'}
    ],
    triggers:[
      {x:2920,y:300,w:60,h:480,targetIndex:8}
    ],
    goal:{x:0,y:0,w:70,h:100,type:'tease', positions:[{x:3220,y:280},{x:3370,y:280},{x:3490,y:280}], fakeIndex:0},
    annotations:[],
    deathMessages:["You trusted something.","Everything you learned, and still.","Nothing here was ever solid.","That's four lessons you forgot at once."],
    completionMessage:"Nothing lied to you. You just stopped trusting it."
  }
];

/* =========================================================================
   ENGINE CONSTANTS
========================================================================= */
const VW = 1600, VH = 900;
const GRAVITY = 2200;
const MOVE_SPEED = 380;
const GROUND_ACCEL = 2800;
const GROUND_DECEL = 3200;
const AIR_ACCEL = 1900;
const AIR_DECEL = 1400;
const RUN_THRESHOLD = 0.28;
const JUMP_VELOCITY = -840;
const MAX_FALL = 1500;
const PLAYER_W = 34, PLAYER_H = 62;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.12;
const RETRY_DELAY_MS = 400;

/* =========================================================================
   GAME STATE
========================================================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');

let currentLevelIndex = 0;
let levelState = null;
let gameState = 'menu'; // menu, playing, paused, dead, won
let keys = {left:false,right:false,jump:false};
let jumpPressedAt = -10;
let lastTime = 0;
let camera = {x:0,y:0};
let particles = [];
let toastTimer = null;
let deathTimestamp = 0;

function makeLevelState(levelData){
  const plats = levelData.platforms.map(p=>({...p, _orig:{x:p.x,y:p.y}, triggered:false, timer:0, removed:false, dir:1, phase:0, discovered:false, shake:0}));
  const hazards = levelData.hazards.map(h=>({...h,
    active: h.type!=='hiddenSpike' && h.type!=='fallingCeiling',
    revealed: h.type!=='hiddenSpike',
    state: h.type==='fallingCeiling' ? 'idle' : undefined
  }));
  const triggers = (levelData.triggers||[]).map(t=>({...t, fired:false}));
  const goal = {...levelData.goal};
  if(goal.type==='tease'){
    goal.x = goal.positions[0].x; goal.y = goal.positions[0].y;
    goal.fakeIndex = 0;
    goal.cooldown = 0;
  }
  const hillSeed = levelData.id*7.3;
  const hillsFar = makeHillLayer(hillSeed, levelData.width+400, 690, 110);
  const hillsNear = makeHillLayer(hillSeed+3.1, levelData.width+400, 685, 70);
  return {
    data: levelData,
    plats, hazards, triggers, goal, hillsFar, hillsNear,
    player:{
      x:levelData.spawn.x, y:levelData.spawn.y, vx:0, vy:0,
      w:PLAYER_W, h:PLAYER_H,
      grounded:false, facing:1, state:'idle', stateT:0, t:0,
      coyote:0, standingOn:null, runTime:0, landTimer:0, dead:false
    },
    deaths:0,
    elapsed:0,
    gravityDir: levelData.gravityFlip ? -1 : 1
  };
}

function loadLevel(index, opts){
  opts = opts || {};
  currentLevelIndex = index;
  const data = LEVELS[index];
  levelState = makeLevelState(data);
  camera.x = 0; camera.y = 0;
  particles = [];
  jumpPressedAt = -10;
  gameState = 'playing';
  hideAllOverlays();
  hideDeathPrompt();
  updateHud();
  if(!opts.silentWorld && shouldShowWorldToast(data)){
    showWorldToast(data);
  }
}

function shouldShowWorldToast(data){
  return LEVELS.findIndex(l=>l.world===data.world) === currentLevelIndex;
}

function restartLevel(){
  const data = LEVELS[currentLevelIndex];
  const deaths = levelState.deaths;
  levelState = makeLevelState(data);
  levelState.deaths = deaths;
  particles = [];
  camera.x = 0; camera.y = 0;
  jumpPressedAt = -10;
  gameState = 'playing';
  hideAllOverlays();
  hideDeathPrompt();
}

/* =========================================================================
   INPUT
========================================================================= */
const keyMap = {
  ArrowLeft:'left', KeyA:'left',
  ArrowRight:'right', KeyD:'right',
  ArrowUp:'jump', KeyW:'jump', Space:'jump'
};
window.addEventListener('keydown', e=>{
  if(gameState==='dead'){
    if(canRetryNow()){ Audio_.unlock(); restartLevel(); }
    return;
  }
  if(e.code==='KeyR'){ handleRestartKey(); return; }
  if(e.code==='Escape'){ togglePause(); return; }
  const k = keyMap[e.code];
  if(k){
    keys[k]=true;
    if(k==='jump') jumpPressedAt = levelState?levelState.elapsed:0;
    e.preventDefault();
  }
});
window.addEventListener('keyup', e=>{
  const k = keyMap[e.code];
  if(k){ keys[k]=false; e.preventDefault(); }
});

function handleRestartKey(){
  if(gameState==='playing'||gameState==='dead'){
    Audio_.unlock();
    restartLevel();
  }
}

function bindHoldButton(el, key){
  const set = (v)=>{
    keys[key]=v;
    el.classList.toggle('active', v);
    if(v && key==='jump') jumpPressedAt = levelState?levelState.elapsed:0;
  };
  el.addEventListener('pointerdown', e=>{ e.preventDefault(); Audio_.unlock(); set(true); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup', e=>{ e.preventDefault(); set(false); });
  el.addEventListener('pointercancel', e=>{ set(false); });
  el.addEventListener('pointerleave', e=>{ if(e.pointerType==='mouse') return; });
  el.addEventListener('contextmenu', e=>e.preventDefault());
}
bindHoldButton(document.getElementById('btnLeft'),'left');
bindHoldButton(document.getElementById('btnRight'),'right');
bindHoldButton(document.getElementById('btnJump'),'jump');

stage.addEventListener('pointerdown', ()=>{
  if(canRetryNow()){ Audio_.unlock(); restartLevel(); }
});

/* =========================================================================
   PHYSICS / COLLISION
========================================================================= */
function activeSolids(ls){
  const list = [];
  ls.plats.forEach(p=>{
    if(p.removed) return;
    if(p.type==='invisible' && !p.discovered){ /* still solid, just not rendered normally */ }
    list.push(currentRect(p));
  });
  return list;
}
function currentRect(p){
  if(p.type==='moving' && p.path){
    return {x:p.cx!=null?p.cx:p.x, y:p.cy!=null?p.cy:p.y, w:p.w, h:p.h, ref:p};
  }
  return {x:p.x,y:p.y,w:p.w,h:p.h,ref:p};
}

function updatePlatformMotion(p, dt){
  if((p.type==='moving' || p.type==='saw') && p.path){
    if(p.cx==null){ p.cx=p.path.x1; p.cy=p.path.y1; p.dir=1; p.waitT=p.path.pauseStart!=null?p.path.pauseStart:0; p.legDist=0; }
    p._dx=0; p._dy=0;
    if(p.waitT>0){ p.waitT -= dt; return; }
    const dx = p.path.x2-p.path.x1, dy = p.path.y2-p.path.y1;
    const len = Math.hypot(dx,dy)||1;
    const ux=dx/len, uy=dy/len;
    const prevX=p.cx, prevY=p.cy;
    p.legDist = (p.legDist||0) + p.path.speed*dt;
    if(p.legDist >= len){
      if(p.dir>0){ p.cx=p.path.x2; p.cy=p.path.y2; p.dir=-1; }
      else { p.cx=p.path.x1; p.cy=p.path.y1; p.dir=1; }
      p.waitT = p.path.pause||0;
      p.legDist = 0;
    } else {
      p.cx += ux*p.path.speed*dt*p.dir;
      p.cy += uy*p.path.speed*dt*p.dir;
    }
    p._dx = p.cx-prevX; p._dy = p.cy-prevY;
  }
}

function updateCamera(ls, dt){
  const p = ls.player;
  const targetX = p.x - VW*0.38;
  const maxX = Math.max(0, ls.data.width - VW);
  const clamped = Math.max(0, Math.min(targetX, maxX));
  camera.x += (clamped - camera.x) * Math.min(1, dt*6);
}

function rectOverlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function updatePlayerPhysics(ls, dt){
  const p = ls.player;
  const data = ls.data;
  const reversed = !!data.reverseControls;
  let moveDir = 0;
  if(keys.left) moveDir -= 1;
  if(keys.right) moveDir += 1;
  if(reversed) moveDir *= -1;

  const targetVx = moveDir*MOVE_SPEED;
  const accel = p.grounded ? GROUND_ACCEL : AIR_ACCEL;
  const decel = p.grounded ? GROUND_DECEL : AIR_DECEL;
  if(targetVx !== 0){
    const rate = (Math.sign(targetVx)===Math.sign(p.vx||targetVx)) ? accel : decel+accel;
    if(p.vx < targetVx) p.vx = Math.min(p.vx + rate*dt, targetVx);
    else if(p.vx > targetVx) p.vx = Math.max(p.vx - rate*dt, targetVx);
  } else {
    if(p.vx > 0) p.vx = Math.max(0, p.vx - decel*dt);
    else if(p.vx < 0) p.vx = Math.min(0, p.vx + decel*dt);
  }
  if(moveDir!==0){ p.facing = moveDir>0?1:-1; p.runTime += dt; } else { p.runTime = 0; }

  const g = GRAVITY*ls.gravityDir;
  p.vy += g*dt;
  if(ls.gravityDir>0) p.vy = Math.min(p.vy, MAX_FALL);
  else p.vy = Math.max(p.vy, -MAX_FALL);

  if(p.coyote>0) p.coyote -= dt;
  const sincePress = ls.elapsed - jumpPressedAt;
  const bufferedJump = sincePress >= 0 && sincePress < JUMP_BUFFER;
  if(bufferedJump && (p.grounded || p.coyote>0) && !p.usedBufferedJump){
    p.vy = JUMP_VELOCITY*ls.gravityDir;
    p.grounded = false; p.coyote = 0;
    jumpPressedAt = -10;
    Audio_.jump();
    spawnPuff(p.x+p.w/2, p.y + (ls.gravityDir>0?p.h:0), 6);
  }

  // ride moving platform (horizontal and vertical)
  if(p.standingOn && p.standingOn.type==='moving' && !p.standingOn.removed){
    p.x += p.standingOn._dx||0;
    p.y += p.standingOn._dy||0;
  }

  // horizontal move + collide
  p.x += p.vx*dt;
  p.x = Math.max(0, Math.min(p.x, data.width-p.w));
  let solids = activeSolids(ls);
  for(const s of solids){
    if(rectOverlap(p, s)){
      // ignore shallow/transient vertical overlap (corner-clip while rising past or
      // falling past a ledge at matching height) — let the vertical pass below resolve
      // it as a landing/clearance instead of a false side-wall block
      const overlapDepth = Math.min(p.y+p.h, s.y+s.h) - Math.max(p.y, s.y);
      if(overlapDepth < 14) continue;
      const hitSpeed = Math.abs(p.vx);
      if(p.vx>0) p.x = s.x - p.w;
      else if(p.vx<0) p.x = s.x + s.w;
      if(hitSpeed > 120){
        if(!(p.bumpTimer>0)) Audio_.wallBump();
        p.bumpTimer = 0.14; p.bumpDir = Math.sign(p.vx)||p.facing;
      }
      p.vx = 0;
    }
  }

  // vertical move + collide
  const prevBottom = p.y+p.h;
  const prevTop = p.y;
  p.y += p.vy*dt;
  p.grounded = false;
  let newStandingOn = null;
  solids = activeSolids(ls);
  for(const s of solids){
    if(!rectOverlap(p,s)) continue;
    if(ls.gravityDir>0){
      if(p.vy>=0 && prevBottom <= s.y+2){
        p.y = s.y - p.h; p.vy=0; p.grounded=true; p.coyote=COYOTE_TIME;
        newStandingOn = s.ref||null;
      } else if(p.vy<0 && prevTop >= s.y+s.h-2){
        p.y = s.y+s.h; p.vy=0;
      }
    } else {
      if(p.vy<=0 && prevTop >= s.y+s.h-2){
        p.y = s.y+s.h; p.vy=0; p.grounded=true; p.coyote=COYOTE_TIME;
        newStandingOn = s.ref||null;
      } else if(p.vy>0 && prevBottom <= s.y+2){
        p.y = s.y - p.h; p.vy=0;
      }
    }
  }
  if(p.grounded && !p.wasGrounded){
    if(!levelState._reducedSkip) spawnPuff(p.x+p.w/2, p.y+p.h, 5);
    if(p.fallDist>160) Audio_.landHeavy(); else if(p.fallDist>20) Audio_.land();
    p.landTimer = 0.14;
  }
  if(!p.grounded){ p.fallDist = (p.fallDist||0) + Math.abs(p.vy)*dt*0.0; p.fallDist = Math.max(p.fallDist, (p.fallDist||0)); }
  if(p.grounded) p.fallDist = 0; else p.fallDist = (p.fallDist||0) + Math.max(0,p.vy*ls.gravityDir)*dt;

  p.wasGrounded = p.grounded;
  if(p.grounded) p.standingOn = newStandingOn; else if(!p.standingOn) p.standingOn=null;
  if(!p.grounded) p.standingOn = p.grounded?newStandingOn:p.standingOn;
  if(!p.grounded && (!newStandingOn)) { /* keep last for ride-through edge case */ }
  if(!p.grounded) p.standingOn = null;

  // world bounds death
  if(p.y > data.height+150 || p.y < -400){
    triggerDeath('fall');
    return;
  }

  // disappearing / breaking platform logic
  ls.plats.forEach(pl=>{
    if(pl.removed) return;
    if((pl.type==='disappearing'||pl.type==='breaking') && p.standingOn===pl){
      if(!pl.triggered){ pl.triggered=true; pl.timer=0; }
    }
    if(pl.triggered && !pl.removed){
      pl.timer += dt;
      pl.shake = Math.sin(pl.timer*60)* Math.min(4, pl.timer*20);
      const delay = pl.delay!=null?pl.delay:400;
      if(pl.timer*1000 > delay*0.45 && !pl._cracked){ pl._cracked=true; Audio_.crack(); }
      if(pl.timer*1000 >= delay){
        pl.removed = true;
        spawnDebris(pl.x+pl.w/2, pl.y+pl.h/2, pl.w);
        if(p.standingOn===pl){ p.standingOn=null; }
        Audio_.crack();
        vibrate(HAPTIC.medium);
      }
    }
  });

  // invisible platform discovery
  ls.plats.forEach(pl=>{
    if(pl.type==='invisible' && !pl.discovered){
      const r = currentRect(pl);
      if(rectOverlap({x:p.x-4,y:p.y-4,w:p.w+8,h:p.h+8}, r)){ pl.discovered=true; }
    }
  });

  // trigger zones (e.g. stepping past a point removes a platform elsewhere)
  (ls.triggers||[]).forEach(tr=>{
    if(!tr.fired && rectOverlap(p, tr)){
      tr.fired = true;
      const target = ls.plats[tr.targetIndex];
      if(target && !target.triggered){ target.triggered = true; target.timer = 0; }
    }
  });

  // hidden spike reveal
  ls.hazards.forEach(hz=>{
    if(hz.type==='hiddenSpike' && !hz.revealed){
      if(hz.revealTrigger){
        const inZone = p.x+p.w > hz.revealTrigger.x && p.x < hz.revealTrigger.x+hz.revealTrigger.w;
        if(inZone){
          hz.revealed = true; hz.active = true;
          Audio_.trapReveal();
          vibrate(HAPTIC.medium);
        }
      }
    }
  });

  // falling ceiling state machine (idle -> warning -> falling -> rested)
  ls.hazards.forEach(hz=>{
    if(hz.type!=='fallingCeiling') return;
    if(hz.state==='idle'){
      if(hz.triggerZone){
        const inZone = p.x+p.w > hz.triggerZone.x && p.x < hz.triggerZone.x+hz.triggerZone.w;
        if(inZone){ hz.state='warning'; hz.stateT=0; Audio_.trapReveal(); vibrate(HAPTIC.small); }
      }
    } else if(hz.state==='warning'){
      hz.stateT += dt;
      hz.shake = Math.sin(hz.stateT*42)*3;
      const warnT = hz.warningTime!=null?hz.warningTime:0.55;
      if(hz.stateT >= warnT){ hz.state='falling'; hz.shake=0; }
    } else if(hz.state==='falling'){
      const restY = hz.restY!=null?hz.restY:hz.y+120;
      hz.y += (hz.fallSpeed||950)*dt;
      if(hz.y>=restY){
        hz.y=restY; hz.state='rested';
        hz.active = hz.lethal!==false;
        Audio_.crack();
        vibrate(HAPTIC.medium);
        spawnDebris(hz.x+hz.w/2, hz.y+hz.h/2, hz.w);
      }
    }
  });

  // hazard collisions
  for(const hz of ls.hazards){
    if(hz.type==='pit') continue;
    if(!hz.active) continue;
    if(hz.lethal===false) continue;
    if(rectOverlap(p, hazardCollisionRect(hz))){
      triggerDeath(hz.type==='spike'||hz.type==='hiddenSpike'?'spike':'trap');
      return;
    }
  }

  // goal logic
  handleGoal(ls, dt);

  // animation state machine
  updateAnimState(p, dt, moveDir);
}

function handleGoal(ls, dt){
  const p = ls.player;
  const g = ls.goal;
  if(g.cooldown>0) g.cooldown -= dt;
  const gr = {x:g.x,y:g.y,w:g.w,h:g.h};

  if(g.type==='normal'){
    if(rectOverlap(p,gr)) triggerWin();
    return;
  }
  if(g.type==='tease'){
    const dist = Math.hypot((p.x+p.w/2)-(g.x+g.w/2), (p.y+p.h/2)-(g.y+g.h/2));
    if(dist < 190 && g.cooldown<=0){
      if(g.fakeIndex < g.positions.length-1){
        g.fakeIndex++;
        const next = g.positions[g.fakeIndex];
        g.x = next.x; g.y = next.y;
        g.cooldown = 0.9;
        Audio_.doorMove();
        vibrate(HAPTIC.medium);
        if(!g.quiet) showToast(g.fakeIndex===g.positions.length-1 ? "Okay, for real this time." : "Nice try.");
      }
    }
    if(rectOverlap(p,gr) && g.fakeIndex>=g.positions.length-1){
      triggerWin();
    }
    return;
  }
  if(g.type==='fake'){
    if(rectOverlap(p,gr)){
      if(g.fakeCount>0){
        g.fakeCount--;
        p.vx = p.facing*-700; p.vy=-300;
        Audio_.recordScratch();
        vibrate(HAPTIC.medium);
        showToast("The door disagrees.");
      } else {
        triggerWin();
      }
    }
  }
}

const STRIDE_LEN = 108;
function updateAnimState(p, dt, moveDir){
  p.t += dt;
  p.stateT += dt;
  p.idleT = (p.idleT||0) + dt;
  if(p.bumpTimer>0) p.bumpTimer -= dt;
  p.airTime = p.grounded ? 0 : (p.airTime||0) + dt;

  const speedAbs = Math.abs(p.vx);
  if(p.grounded){
    p.locoPhase = ((p.locoPhase||0) + (speedAbs/STRIDE_LEN)*dt*Math.PI*2) % (Math.PI*2);
  }
  if(moveDir!==0 && speedAbs < MOVE_SPEED*0.85 && Math.sign(p.vx||moveDir)===Math.sign(moveDir)){
    p.accelLean = 0.14;
  } else if(moveDir===0 && speedAbs>15){
    p.accelLean = -0.12*Math.sign(p.vx);
  } else {
    p.accelLean = 0;
  }

  if(p.dead){ p.state='die'; return; }
  if(p.won){ p.state='victory'; return; }
  if(p.landTimer>0){ p.landTimer-=dt; p.state='land'; return; }
  if(!p.grounded){
    p.state = p.vy*(levelState.gravityDir) < 0 ? 'jump' : 'fall';
    return;
  }
  if(moveDir===0 && speedAbs<8){ p.state='idle'; return; }
  p.state = speedAbs>MOVE_SPEED*RUN_THRESHOLD ? 'run' : 'walk';
  const stride = Math.PI; // one footstep per half stride-cycle
  const phase = Math.floor(p.locoPhase/stride);
  if(phase!==p._lastStridePhase && speedAbs>20){ p._lastStridePhase=phase; Audio_.footstep(); }
}

/* =========================================================================
   PARTICLES
========================================================================= */
function spawnPuff(x,y,n){
  if(save.settings.reducedMotion) return;
  for(let i=0;i<n;i++){
    particles.push({x,y,vx:(Math.random()-0.5)*120,vy:-Math.random()*80-20,life:0.35,maxLife:0.35,size:3+Math.random()*2,color:'rgba(80,72,58,0.5)'});
  }
}
function spawnDebris(x,y,spread){
  if(save.settings.reducedMotion) return;
  for(let i=0;i<8;i++){
    particles.push({x:x+(Math.random()-0.5)*spread,y,vx:(Math.random()-0.5)*160,vy:-Math.random()*160,life:0.6,maxLife:0.6,size:5+Math.random()*4,color:'#1a1a1a',gravity:true});
  }
}
const GREEN_SHADES = ['#4caf3a','#3d9130','#6fc14a','#2e7d22'];
function spawnDeathBurst(x,y,dirVx,dirVy){
  dirVx = dirVx||0; dirVy = dirVy||0;
  const dirAngle = Math.atan2(dirVy, dirVx);
  const hasDir = Math.hypot(dirVx,dirVy) > 30;
  const n = save.settings.reducedMotion?8:26;
  for(let i=0;i<n;i++){
    // bias the spray toward the direction of travel at the moment of impact
    const a = hasDir ? dirAngle + (Math.random()-0.5)*2.6 : Math.random()*Math.PI*2;
    const speed = 160+Math.random()*260;
    particles.push({
      x,y, vx:Math.cos(a)*speed + dirVx*0.3, vy:Math.sin(a)*speed + dirVy*0.3,
      life:0.55+Math.random()*0.35, maxLife:0.9, size:2.5+Math.random()*3.5,
      color: GREEN_SHADES[i%GREEN_SHADES.length], gravity:true, collides:true, drag:0.985
    });
  }
  // a few small dark fragment "lines" (rotating rects) for a bit of shattered-character flavor
  const fn = save.settings.reducedMotion?0:4;
  for(let i=0;i<fn;i++){
    const a = hasDir ? dirAngle + (Math.random()-0.5)*1.8 : Math.random()*Math.PI*2;
    const speed = 140+Math.random()*180;
    particles.push({
      x,y, vx:Math.cos(a)*speed+dirVx*0.3, vy:Math.sin(a)*speed+dirVy*0.3,
      life:0.5, maxLife:0.5, size:8+Math.random()*6, color:'#1a1a1a',
      gravity:true, collides:true, shape:'line', rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*14
    });
  }
}
function spawnSparkle(x,y){
  for(let i=0;i<10;i++){
    const a = Math.random()*Math.PI*2;
    particles.push({x,y,vx:Math.cos(a)*120,vy:Math.sin(a)*120-60,life:0.5,maxLife:0.5,size:3,color:'#f2c94c',gravity:true});
  }
}
const CONFETTI_COLORS = ['#e0323c','#f2c94c','#4caf3a','#1a1a1a','#3d8bd9'];
function spawnConfetti(x,y){
  if(save.settings.reducedMotion) return;
  for(let i=0;i<46;i++){
    const a = -Math.PI/2 + (Math.random()-0.5)*2.2;
    const speed = 220+Math.random()*260;
    particles.push({
      x, y, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed,
      life:1.0+Math.random()*0.8, maxLife:1.8, size:3+Math.random()*3,
      color: CONFETTI_COLORS[i%CONFETTI_COLORS.length],
      gravity:true, drag:0.99, shape:(i%3===0?'line':'sq'), rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*10
    });
  }
}
function updateParticles(dt){
  const solids = (levelState && (gameState==='playing'||gameState==='dead'||gameState==='won')) ? activeSolids(levelState) : null;
  particles.forEach(pt=>{
    const prevY = pt.y;
    pt.x += pt.vx*dt; pt.y += pt.vy*dt;
    if(pt.gravity) pt.vy += 900*dt;
    if(pt.drag){ pt.vx *= pt.drag; pt.vy *= (1+(pt.drag-1)*0.3); }
    if(pt.rotSpeed) pt.rot += pt.rotSpeed*dt;
    if(pt.collides && solids && pt.vy>0){
      for(const s of solids){
        if(pt.x>s.x && pt.x<s.x+s.w && prevY<=s.y && pt.y>=s.y){
          pt.y = s.y;
          if(!pt.bounced && Math.abs(pt.vy)>80){ pt.vy *= -0.35; pt.vx *= 0.6; pt.bounced=true; }
          else { pt.vy = 0; pt.vx *= 0.8; pt.settled = true; }
          break;
        }
      }
    }
    pt.life -= dt;
  });
  particles = particles.filter(pt=>pt.life>0);
}

/* =========================================================================
   DEATH / WIN
========================================================================= */
function triggerDeath(reason){
  if(gameState!=='playing') return;
  const ls = levelState;
  const impactVx = ls.player.vx, impactVy = ls.player.vy;
  ls.player.dead = true;
  ls.player.vx = 0; ls.player.vy = 0;
  gameState = 'dead';
  deathTimestamp = Date.now();
  ls.deaths++;
  save.totalDeaths++;
  persistSave();
  spawnDeathBurst(ls.player.x+ls.player.w/2, ls.player.y+ls.player.h/2, impactVx, impactVy);
  Audio_.death(reason);
  vibrate(HAPTIC.strong);
  updateHud();

  const pool = (ls.data.deathMessages||[]).concat(GLOBAL_DEATH_MESSAGES);
  const showMsg = !ls.data.silentDeaths && Math.random() < 0.6;
  if(showMsg) showToast(pool[Math.floor(Math.random()*pool.length)]);
  setTimeout(()=>{
    if(gameState==='dead') showDeathPrompt();
  }, RETRY_DELAY_MS);
}

function triggerWin(){
  if(gameState!=='playing') return;
  const ls = levelState;
  ls.player.won = true;
  gameState = 'won';
  if(!save.completedLevels.includes(ls.data.id)) save.completedLevels.push(ls.data.id);
  if(save.unlockedLevel <= ls.data.id && currentLevelIndex+1 < LEVELS.length){
    save.unlockedLevel = LEVELS[currentLevelIndex+1].id;
  } else if(currentLevelIndex+1 >= LEVELS.length){
    save.unlockedLevel = Math.max(save.unlockedLevel, ls.data.id);
  }
  persistSave();
  const isFinale = currentLevelIndex+1 >= LEVELS.length;
  Audio_.victory();
  if(isFinale) setTimeout(()=>Audio_.victory(), 260);
  vibrate(isFinale ? HAPTIC.strong : HAPTIC.small);
  document.getElementById('winMsg').textContent = ls.data.completionMessage||'';
  document.getElementById('btnNext').style.display = isFinale ? 'none' : 'inline-block';
  document.getElementById('btnWinMenu').hidden = !isFinale;
  document.getElementById('winTitle').textContent = isFinale ? 'WORLD 1 COMPLETE' : 'Level Complete!';
  const statsEl = document.getElementById('winStats');
  if(isFinale){
    statsEl.style.display = 'block';
    statsEl.textContent = 'Total deaths: '+save.totalDeaths+' — every one of them taught you something.';
    const gx = ls.goal.x+ls.goal.w/2, gy = ls.goal.y+ls.goal.h/2;
    spawnConfetti(gx, gy);
    setTimeout(()=>spawnConfetti(gx, gy), 350);
  } else {
    statsEl.style.display = 'none';
  }
  setTimeout(()=>showOverlay('winOverlay'), 220);
  updateHud();
}

/* =========================================================================
   RENDERING
========================================================================= */
function resizeCanvas(){
  const rect = fitStage();
  canvas.width = rect.w * (window.devicePixelRatio||1);
  canvas.height = rect.h * (window.devicePixelRatio||1);
  canvas.style.width = rect.w+'px';
  canvas.style.height = rect.h+'px';
}
function fitStage(){
  const vp = document.getElementById('app').getBoundingClientRect();
  const targetRatio = VW/VH;
  let w = vp.width, h = vp.height;
  if(w/h > targetRatio){
    // wider than 16:9 (ultra-wide desktop): letterbox the sides, keep full height
    w = h*targetRatio;
  }
  // taller than 16:9 (portrait/mobile): fill the full viewport, no letterboxing —
  // extra vertical world space is handled in draw() by extending the sky upward.
  stage.style.width = w+'px';
  stage.style.height = h+'px';
  return {w,h};
}
window.addEventListener('resize', resizeCanvas);

const THEME_BG = {
  default:{sky:'#efe9dc', far:'#e4dcc8', near:'#d8cfb5'},
  cave:{sky:'#3a3a3a', far:'#2a2a2a', near:'#232323'},
  city:{sky:'#f0d9d6', far:'#e3c3bf', near:'#d4aaa5'},
  factory:{sky:'#6b6b6b', far:'#565656', near:'#484848'}
};

function makeHillLayer(seed, width, baseY, amplitude){
  const pts = [];
  const segments = Math.max(8, Math.floor(width/220));
  for(let i=0;i<=segments;i++){
    const x = (width/segments)*i;
    const n = Math.sin(i*1.3+seed)*0.6 + Math.sin(i*0.6+seed*1.7)*0.4;
    const y = baseY - amplitude*0.5 - n*amplitude*0.5;
    pts.push({x,y});
  }
  return pts;
}
function drawHillLayer(pts, color, camFactor, extraSky){
  if(!pts || !pts.length) return;
  ctx.save();
  ctx.translate(-camera.x*camFactor, extraSky);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(pts[pts.length-1].x, 1400);
  ctx.lineTo(pts[0].x, 1400);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function draw(){
  const scale = canvas.width/VW;
  const visibleH = canvas.height/scale; // world units visible vertically (>=VH on tall/portrait screens)
  const extraSky = Math.max(0, visibleH-VH);
  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(scale,scale);

  const theme = THEME_BG[(levelState&&levelState.data.theme)||'default'];
  ctx.fillStyle = theme.sky;
  ctx.fillRect(0,0,VW,visibleH);

  if(levelState){
    drawHillLayer(levelState.hillsFar, theme.far, 0.25, extraSky);
    drawHillLayer(levelState.hillsNear, theme.near, 0.5, extraSky);
    ctx.save();
    ctx.translate(0, extraSky);
    ctx.translate(-camera.x, -camera.y);
    drawAnnotations(levelState.data.annotations);
    drawPlatforms(levelState);
    drawHazards(levelState);
    drawGoal(levelState);
    drawParticles();
    drawPlayer(levelState.player);
    ctx.restore();
  }
  ctx.restore();
}

function drawPlatforms(ls){
  ls.plats.forEach(p=>{
    if(p.removed) return;
    if(p.type==='invisible' && !p.discovered) return;
    const r = currentRect(p);
    let x=r.x, y=r.y;
    if(p.shake) x += p.shake;
    ctx.fillStyle = p.type==='invisible' ? 'rgba(26,26,26,0.35)' : '#1a1a1a';
    roundRect(x,y,p.w,p.h,8);
    ctx.fill();
    if(p.type==='moving'){
      ctx.strokeStyle='rgba(26,26,26,0.25)';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(p.path.x1+p.w/2, p.path.y1+p.h/2);
      ctx.lineTo(p.path.x2+p.w/2, p.path.y2+p.h/2);
      ctx.stroke();
    }
    if(p.triggered && !p.removed){
      ctx.strokeStyle='rgba(224,50,60,0.7)';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(x+6,y+6); ctx.lineTo(x+p.w-10,y+p.h-8);
      ctx.moveTo(x+p.w-14,y+5); ctx.lineTo(x+10,y+p.h-6);
      ctx.stroke();
    }
  });
}

function hazardRect(hz){
  if(hz.type==='saw' && hz.path){
    return {x:hz.cx!=null?hz.cx:hz.x, y:hz.cy!=null?hz.cy:hz.y, w:hz.w, h:hz.h};
  }
  return {x:hz.x, y:hz.y, w:hz.w, h:hz.h};
}
function hazardCollisionRect(hz){
  const r = hazardRect(hz);
  if(hz.type==='spike' || hz.type==='hiddenSpike'){
    return {x:r.x+r.w*0.1, y:r.y+r.h*0.22, w:r.w*0.8, h:r.h*0.78};
  }
  if(hz.type==='saw'){
    return {x:r.x+r.w*0.14, y:r.y+r.h*0.14, w:r.w*0.72, h:r.h*0.72};
  }
  if(hz.type==='fallingCeiling'){
    return {x:r.x+r.w*0.06, y:r.y+r.h*0.3, w:r.w*0.88, h:r.h*0.7};
  }
  return r;
}
function drawSpikeTeeth(hz, color){
  const toothW = 13;
  const n = Math.max(2, Math.round(hz.w/toothW));
  const sw = hz.w/n;
  const baseY = hz.y+hz.h;
  ctx.strokeStyle = 'rgba(26,26,26,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hz.x, baseY); ctx.lineTo(hz.x+hz.w, baseY); ctx.stroke();
  ctx.fillStyle = color||'#e0323c';
  for(let i=0;i<n;i++){
    const jitter = (i%3===1) ? 0.78 : (i%3===2 ? 0.92 : 1);
    const tipY = hz.y + (hz.h*(1-jitter));
    const x0 = hz.x+i*sw, x1 = x0+sw;
    ctx.beginPath();
    ctx.moveTo(x0+1, baseY);
    ctx.lineTo(x0+sw/2, tipY);
    ctx.lineTo(x1-1, baseY);
    ctx.closePath();
    ctx.fill();
  }
}
let _sawSpin = 0;
function drawHazards(ls){
  _sawSpin += 0.22;
  ls.hazards.forEach(hz=>{
    if(hz.type==='pit') return;
    if(hz.type==='hiddenSpike' && !hz.revealed) return;
    if(hz.type==='saw'){
      const r = hazardRect(hz);
      const cx = r.x+r.w/2, cy = r.y+r.h/2, radius = Math.min(r.w,r.h)/2;
      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate(_sawSpin);
      ctx.fillStyle = '#8a8a8a';
      ctx.beginPath();
      const teeth = 10;
      for(let i=0;i<teeth;i++){
        const a0 = (i/teeth)*Math.PI*2, a1 = ((i+0.5)/teeth)*Math.PI*2, a2 = ((i+1)/teeth)*Math.PI*2;
        ctx.lineTo(Math.cos(a0)*radius*0.72, Math.sin(a0)*radius*0.72);
        ctx.lineTo(Math.cos(a1)*radius, Math.sin(a1)*radius);
        ctx.lineTo(Math.cos(a2)*radius*0.72, Math.sin(a2)*radius*0.72);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath(); ctx.arc(0,0,radius*0.42,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(0,0,radius*0.14,0,Math.PI*2); ctx.fill();
      ctx.restore();
      return;
    }
    if(hz.type==='fallingCeiling'){
      let x=hz.x, y=hz.y;
      if(hz.shake) x += hz.shake;
      const bodyH = hz.h*0.55;
      ctx.fillStyle = hz.state==='warning' ? '#e0323c' : '#3a3a3a';
      roundRect(x, y, hz.w, bodyH, 4);
      ctx.fill();
      drawSpikeTeeth({x, y:y+bodyH, w:hz.w, h:hz.h-bodyH}, hz.state==='warning' ? '#e0323c' : '#8a8a8a');
      return;
    }
    drawSpikeTeeth(hz);
  });
}

function drawGoal(ls){
  const g = ls.goal;
  const won = ls.player.won;
  ctx.save();
  ctx.fillStyle = '#c9c2ad';
  roundRect(g.x-6, g.y-6, g.w+12, g.h+12, 10);
  ctx.fill();
  ctx.fillStyle = won ? '#8a8a8a' : '#d8d2bf';
  const openAmt = won ? Math.min(1,(ls.winT||0)*3) : 0;
  roundRect(g.x+g.w*openAmt*0.6, g.y, g.w*(1-openAmt*0.6), g.h, 6);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(g.x+g.w*0.78, g.y+g.h*0.45, 6, 10);
  ctx.restore();
}

function drawAnnotations(list){
  if(!list) return;
  ctx.font = '26px Caveat, cursive';
  ctx.fillStyle = '#4a463c';
  list.forEach(a=>{
    ctx.fillText(a.text, a.x, a.y);
  });
}

function drawParticles(){
  particles.forEach(pt=>{
    ctx.globalAlpha = Math.max(0, pt.life/pt.maxLife);
    ctx.fillStyle = pt.color;
    if(pt.shape==='line'){
      ctx.save();
      ctx.translate(pt.x,pt.y);
      ctx.rotate(pt.rot||0);
      ctx.fillRect(-pt.size/2,-1.5,pt.size,3);
      ctx.restore();
    } else {
      ctx.fillRect(pt.x-pt.size/2, pt.y-pt.size/2, pt.size, pt.size);
    }
  });
  ctx.globalAlpha = 1;
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* ---- stickman: joint-based procedural animation ----
   torso/legs/arms are two-segment limbs computed from a handful of continuous
   pose parameters (lean, crouch, stride phase) so motion blends naturally
   instead of snapping between fixed poses. */
const LEG_THIGH=14, LEG_SHIN=14, ARM_UPPER=12, ARM_FORE=12, TORSO_LEN=20, NECK_HEAD=11, HEAD_R=8;

function limbEnd(originX, originY, angle1, len1, bend, len2){
  const kx = originX + Math.sin(angle1)*len1;
  const ky = originY + Math.cos(angle1)*len1;
  const a2 = angle1 - bend;
  const ex = kx + Math.sin(a2)*len2;
  const ey = ky + Math.cos(a2)*len2;
  return {kx,ky,ex,ey};
}

function computePose(p){
  const t = p.t, phase = p.locoPhase||0;
  const speedT = Math.min(1, Math.abs(p.vx)/MOVE_SPEED);
  const pose = {
    torsoLean:0, headTilt:0, hipDrop:0,
    thighL:0, thighR:0, shinL:0.08, shinR:0.08,
    armL:0, armR:0, elbowL:0.3, elbowR:0.3,
    squashX:1, squashY:1
  };

  switch(p.state){
    case 'idle': {
      const breathe = Math.sin(p.idleT*1.3);
      pose.hipDrop = -breathe*1.2;
      pose.torsoLean = Math.sin(p.idleT*0.35)*0.02;
      pose.headTilt = Math.sin(p.idleT*0.5+1)*0.05;
      pose.thighL = 0.04*Math.sin(p.idleT*0.6);
      pose.thighR = 0.04*Math.sin(p.idleT*0.6+2);
      pose.shinL = 0.05; pose.shinR = 0.05;
      pose.armL = 0.15+0.04*Math.sin(p.idleT*0.7);
      pose.armR = -0.15-0.04*Math.sin(p.idleT*0.7+1);
      pose.elbowL = 0.35; pose.elbowR = 0.35;
      if(p.standingOn && p.standingOn.shake){
        pose.hipDrop += p.standingOn.shake*0.6;
        pose.torsoLean += p.standingOn.shake*0.012;
      }
      break;
    }
    case 'walk':
    case 'run': {
      const ampThigh = 0.22+0.58*speedT;
      const ampShin = 0.18+0.92*speedT;
      const ampArm = 0.22+0.46*speedT;
      pose.thighL = ampThigh*Math.sin(phase);
      pose.thighR = ampThigh*Math.sin(phase+Math.PI);
      pose.shinL = Math.max(0.05, ampShin*Math.sin(phase-1.1));
      pose.shinR = Math.max(0.05, ampShin*Math.sin(phase+Math.PI-1.1));
      pose.armL = -ampArm*Math.sin(phase);
      pose.armR = -ampArm*Math.sin(phase+Math.PI);
      pose.elbowL = 0.3+Math.max(0,0.5*Math.sin(phase+0.6));
      pose.elbowR = 0.3+Math.max(0,0.5*Math.sin(phase+Math.PI+0.6));
      const bob = Math.abs(Math.sin(phase))*(1.5+4*speedT);
      pose.hipDrop = bob*0.6;
      pose.torsoLean = (0.05+0.26*speedT) + (p.accelLean||0);
      pose.headTilt = Math.sin(phase*2)*0.02*speedT - pose.torsoLean*0.3;
      if(p.standingOn && p.standingOn.shake){
        pose.hipDrop += p.standingOn.shake*0.6;
        pose.torsoLean += p.standingOn.shake*0.012;
      }
      break;
    }
    case 'jump': {
      const launchT = Math.min(1, (p.airTime||0)/0.14);
      pose.thighL = -0.55-0.1*launchT; pose.thighR = -0.4-0.1*launchT;
      pose.shinL = 0.75-0.15*launchT; pose.shinR = 0.55-0.1*launchT;
      pose.torsoLean = -0.12 + (p.accelLean||0)*0.5;
      pose.armL = -1.9-0.15*Math.sin(t*5); pose.armR = -1.7-0.15*Math.sin(t*5+1);
      pose.elbowL = 0.3; pose.elbowR = 0.3;
      pose.hipDrop = -2*(1-launchT);
      pose.squashX = 1.08-0.1*launchT; pose.squashY = 0.92+0.14*launchT;
      break;
    }
    case 'fall': {
      const fallFrac = Math.min(1, Math.abs(p.vy)/900);
      pose.thighL = 0.35+0.12*Math.sin(t*8); pose.thighR = 0.35+0.12*Math.sin(t*8+1.4);
      pose.shinL = 0.55+0.15*Math.sin(t*9+0.6); pose.shinR = 0.55+0.15*Math.sin(t*9+2);
      pose.torsoLean = 0.06*Math.sign(p.vx||1)*speedT - fallFrac*0.05;
      pose.headTilt = -fallFrac*0.08;
      pose.armL = -1.1+0.3*Math.sin(t*7); pose.armR = 1.1-0.3*Math.sin(t*7+1);
      pose.elbowL = 0.45; pose.elbowR = 0.45;
      pose.squashX = 0.95-0.03*fallFrac; pose.squashY = 1.05+0.08*fallFrac;
      break;
    }
    case 'land': {
      const landT = 1-Math.max(0,p.landTimer)/0.14;
      const crouch = 1-landT;
      pose.thighL = 0.42*crouch; pose.thighR = 0.42*crouch;
      pose.shinL = 0.7*crouch; pose.shinR = 0.7*crouch;
      pose.headTilt = 0.05*crouch;
      pose.armL = 0.5*crouch; pose.armR = -0.5*crouch;
      pose.elbowL = 0.25+0.2*crouch; pose.elbowR = 0.25+0.2*crouch;
      pose.hipDrop = 5*crouch;
      pose.squashX = 1+0.18*crouch; pose.squashY = 1-0.22*crouch;
      break;
    }
    case 'die': {
      pose.thighL = 0.9; pose.thighR = -0.6; pose.shinL = 0.3; pose.shinR = 0.5;
      pose.armL = -0.8; pose.armR = 0.9; pose.elbowL = 0.4; pose.elbowR = 0.2;
      pose.torsoLean = 0.1; pose.headTilt = 0.3;
      break;
    }
    case 'victory': {
      const hop = Math.abs(Math.sin(t*6))*7;
      pose.hipDrop = -hop*0.5;
      pose.thighL = 0.3*Math.sin(t*6); pose.thighR = -0.3*Math.sin(t*6);
      pose.shinL = 0.3; pose.shinR = 0.3;
      pose.headTilt = 0.05*Math.sin(t*6);
      pose.armL = -2.6+0.12*Math.sin(t*8); pose.armR = 2.6-0.12*Math.sin(t*8+1);
      pose.elbowL = 0.2; pose.elbowR = 0.2;
      break;
    }
  }

  if(p.bumpTimer>0){
    const bt = p.bumpTimer/0.14;
    pose.squashX *= (1-0.22*bt);
    pose.squashY *= (1+0.12*bt);
  }
  return pose;
}

function drawPlayer(p){
  const footX = p.x+p.w/2;
  const footY = p.y+p.h;
  const facing = p.facing;
  const pose = computePose(p);

  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(facing,1);
  if(p.state==='die') ctx.rotate(1.5708);
  ctx.scale(pose.squashX, pose.squashY);
  ctx.strokeStyle = '#161616';
  ctx.fillStyle = '#161616';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hipY = -(LEG_THIGH+LEG_SHIN) + pose.hipDrop;
  const shoulderX = Math.sin(pose.torsoLean)*TORSO_LEN;
  const shoulderY = hipY - Math.cos(pose.torsoLean)*TORSO_LEN;
  const headAngle = pose.torsoLean + pose.headTilt;
  const headX = shoulderX + Math.sin(headAngle)*NECK_HEAD;
  const headY = shoulderY - Math.cos(headAngle)*NECK_HEAD;

  // torso
  ctx.beginPath(); ctx.moveTo(0,hipY); ctx.lineTo(shoulderX,shoulderY); ctx.stroke();

  // legs (drawn behind torso/arms)
  const legL = limbEnd(0,hipY, pose.thighL, LEG_THIGH, pose.shinL, LEG_SHIN);
  const legR = limbEnd(0,hipY, pose.thighR, LEG_THIGH, pose.shinR, LEG_SHIN);
  ctx.beginPath();
  ctx.moveTo(0,hipY); ctx.lineTo(legL.kx,legL.ky); ctx.lineTo(legL.ex,legL.ey);
  ctx.moveTo(0,hipY); ctx.lineTo(legR.kx,legR.ky); ctx.lineTo(legR.ex,legR.ey);
  ctx.stroke();

  // arms
  const armL = limbEnd(shoulderX,shoulderY, pose.armL, ARM_UPPER, pose.elbowL, ARM_FORE);
  const armR = limbEnd(shoulderX,shoulderY, pose.armR, ARM_UPPER, pose.elbowR, ARM_FORE);
  ctx.beginPath();
  ctx.moveTo(shoulderX,shoulderY); ctx.lineTo(armL.kx,armL.ky); ctx.lineTo(armL.ex,armL.ey);
  ctx.moveTo(shoulderX,shoulderY); ctx.lineTo(armR.kx,armR.ky); ctx.lineTo(armR.ex,armR.ey);
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(headX, headY, HEAD_R, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

/* =========================================================================
   HUD / UI
========================================================================= */
function updateHud(){
  const data = LEVELS[currentLevelIndex];
  document.getElementById('levelLabel').textContent = 'LEVEL '+data.id;
  document.getElementById('levelSub').textContent = data.name;
  document.getElementById('levelCard').classList.toggle('reversed', !!data.reverseControls);
  document.getElementById('progressText').textContent = data.id+' / '+LEVELS.length;
  document.getElementById('deathsText').textContent = 'Deaths: '+save.totalDeaths;
  document.getElementById('hud').classList.toggle('show-intro', data.id<=3);
  document.querySelectorAll('#introStepper .step').forEach(el=>{
    const n = +el.dataset.n;
    el.classList.toggle('active', n===data.id);
    el.classList.toggle('done', n<data.id);
  });
  buildLevelGrid();
}
function buildLevelGrid(){
  const grid = document.getElementById('levelGrid');
  grid.innerHTML='';
  LEVELS.forEach((lvl,i)=>{
    const unlocked = lvl.id <= save.unlockedLevel;
    const done = save.completedLevels.includes(lvl.id);
    const div = document.createElement('div');
    div.className = 'lvl-tile'+(unlocked?'':' locked')+(done?' done':'')+(i===currentLevelIndex&&gameState!=='menu'?' current':'');
    div.textContent = unlocked ? lvl.id : '\u{1F512}';
    if(unlocked){
      div.addEventListener('click', ()=>{
        Audio_.unlock(); Audio_.uiClick();
        hideAllOverlays();
        document.getElementById('startScreen').hidden = true;
        loadLevel(i);
      });
    }
    grid.appendChild(div);
  });
}

function showOverlay(id){
  document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show'));
  document.getElementById(id).classList.add('show');
}
function hideAllOverlays(){
  document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show'));
}
function showDeathPrompt(){ document.getElementById('deathPrompt').classList.add('show'); }
function hideDeathPrompt(){ document.getElementById('deathPrompt').classList.remove('show'); }
function canRetryNow(){ return gameState==='dead' && (Date.now()-deathTimestamp) >= RETRY_DELAY_MS; }

function showToast(text){
  const el = document.getElementById('toastMsg');
  el.textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function showWorldToast(data){
  document.getElementById('worldToastSub').textContent = 'WORLD '+data.world;
  document.getElementById('worldToastMain').textContent = data.worldName;
  const el = document.getElementById('worldToast');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

/* buttons */
document.getElementById('btnRestart').addEventListener('click', ()=>{ Audio_.uiClick(); if(gameState!=='menu') restartLevel(); });
document.getElementById('btnSettings').addEventListener('click', ()=>{ Audio_.uiClick(); openSettings(); });
document.getElementById('btnPause').addEventListener('click', togglePause);
document.getElementById('btnNext').addEventListener('click', ()=>{
  Audio_.uiClick();
  if(currentLevelIndex+1 < LEVELS.length) loadLevel(currentLevelIndex+1);
});
document.getElementById('btnReplay').addEventListener('click', ()=>{ Audio_.uiClick(); restartLevel(); });
document.getElementById('btnWinMenu').addEventListener('click', ()=>{ Audio_.uiClick(); gameState='paused'; buildLevelGrid(); showOverlay('menuOverlay'); });
document.getElementById('btnResume').addEventListener('click', ()=>{ Audio_.uiClick(); gameState='playing'; hideAllOverlays(); });
document.getElementById('btnPauseRestart').addEventListener('click', ()=>{ Audio_.uiClick(); restartLevel(); });
document.getElementById('btnPauseSettings').addEventListener('click', openSettings);
document.getElementById('btnPauseMenu').addEventListener('click', ()=>{ Audio_.uiClick(); showOverlay('menuOverlay'); buildLevelGrid(); });
document.getElementById('btnCloseSettings').addEventListener('click', ()=>{
  Audio_.uiClick();
  if(gameState==='paused') showOverlay('pauseOverlay'); else hideAllOverlays();
});
document.getElementById('btnCloseMenu').addEventListener('click', ()=>{
  Audio_.uiClick();
  if(levelState) { gameState='playing'; hideAllOverlays(); }
  else hideAllOverlays();
});
document.getElementById('btnPlay').addEventListener('click', ()=>{
  Audio_.unlock(); Audio_.uiClick();
  document.getElementById('startScreen').hidden = true;
  const idx = LEVELS.findIndex(l=>l.id===save.unlockedLevel);
  loadLevel(idx>=0?idx:0);
});
document.getElementById('btnLevelSelectStart').addEventListener('click', ()=>{
  Audio_.unlock(); Audio_.uiClick();
  buildLevelGrid();
  showOverlay('menuOverlay');
});
document.getElementById('btnSettingsStart').addEventListener('click', ()=>{ Audio_.unlock(); openSettings(); });

function openSettings(){
  Audio_.uiClick();
  if(gameState==='playing') gameState='paused';
  refreshSettingsUI();
  showOverlay('settingsOverlay');
}
function togglePause(){
  if(gameState==='playing'){ gameState='paused'; showOverlay('pauseOverlay'); Audio_.uiClick(); }
  else if(gameState==='paused'){ gameState='playing'; hideAllOverlays(); Audio_.uiClick(); }
}

function refreshSettingsUI(){
  document.querySelectorAll('.switch').forEach(sw=>{
    const key = sw.dataset.setting;
    sw.classList.toggle('on', !!save.settings[key]);
  });
}
document.querySelectorAll('.switch').forEach(sw=>{
  sw.addEventListener('click', ()=>{
    const key = sw.dataset.setting;
    save.settings[key] = !save.settings[key];
    sw.classList.toggle('on', save.settings[key]);
    persistSave();
    Audio_.uiClick();
    if(key==='music'){ if(save.settings.music) Audio_.startMusic(); else Audio_.stopMusic(); }
  });
});

/* =========================================================================
   MAIN LOOP
========================================================================= */
function tick(){
  const ts = performance.now();
  if(!lastTime) lastTime = ts;
  let dt = (ts-lastTime)/1000;
  lastTime = ts;
  dt = Math.min(dt, 1/30);

  if(gameState==='playing' && levelState){
    levelState.elapsed += dt;
    levelState.plats.forEach(p=>updatePlatformMotion(p,dt));
    levelState.hazards.forEach(h=>updatePlatformMotion(h,dt));
    updatePlayerPhysics(levelState, dt);
  }
  if(gameState==='won' && levelState){
    levelState.winT = (levelState.winT||0)+dt;
  }
  if(levelState) updateCamera(levelState, dt);
  updateParticles(dt);
  draw();
}
function startLoop(){
  if(window._gameLoopHandle) return;
  window._gameLoopHandle = setInterval(tick, 16);
  if(typeof requestAnimationFrame==='function'){
    (function rafPing(){ requestAnimationFrame(rafPing); })();
  }
}

/* =========================================================================
   BOOT
========================================================================= */
function boot(){
  resizeCanvas();
  refreshSettingsUI();
  updateHud();
  buildLevelGrid();
  if(save.settings.music) Audio_.startMusic();
  drawIntroStickman();
  startLoop();
}
function drawIntroStickman(){
  const c = document.getElementById('introCanvas');
  const ic = c.getContext('2d');
  let t=0;
  function loop(){
    t+=0.016;
    ic.clearRect(0,0,200,90);
    ic.save();
    ic.translate(100,80);
    ic.scale(1,1);
    ic.strokeStyle='#1a1a1a'; ic.fillStyle='#1a1a1a'; ic.lineWidth=4; ic.lineCap='round';
    const legSwing = Math.sin(t*9)*14, armSwing=Math.sin(t*9+Math.PI)*10;
    const hipY=-24, shoulderY=-44, headY=-54;
    ic.beginPath(); ic.moveTo(0,hipY); ic.lineTo(0,shoulderY); ic.stroke();
    ic.beginPath();
    ic.moveTo(0,hipY); ic.lineTo(legSwing*0.6,hipY+18); ic.lineTo(legSwing*0.9,hipY+26);
    ic.moveTo(0,hipY); ic.lineTo(-legSwing*0.6,hipY+18); ic.lineTo(-legSwing*0.9,hipY+26);
    ic.stroke();
    ic.beginPath();
    ic.moveTo(0,shoulderY); ic.lineTo(armSwing*0.6,shoulderY+16); ic.lineTo(armSwing*0.8,shoulderY+22);
    ic.moveTo(0,shoulderY); ic.lineTo(-armSwing*0.6,shoulderY+16); ic.lineTo(-armSwing*0.8,shoulderY+22);
    ic.stroke();
    ic.beginPath(); ic.arc(0,headY,7,0,Math.PI*2); ic.fill();
    ic.restore();
  }
  setInterval(loop, 16);
}

boot();
