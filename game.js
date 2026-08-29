// game.js - TAILBLADE (Phase A improvements)
// Focus: input buffering, variable jump, animation frames, touch UI feedback, audio limiter

(() => {
  'use strict';

  // Constants & utilities
  const STATE = { TITLE:0, PLAYING:1, PAUSED:2, BOSS:3, GAME_OVER:4, CLEAR:5 };
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const now = ()=>performance.now();

  // Canvas & DPI
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let DPR = Math.max(1, window.devicePixelRatio || 1);

  function resizeCanvas(){
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const refH = 720;
    const refW = Math.round(refH * 16/9);
    // fit to window while preserving aspect
    const scale = Math.min(winW / refW, winH / refH);
    canvas.style.width = Math.floor(refW * scale) + 'px';
    canvas.style.height = Math.floor(refH * scale) + 'px';
    canvas.width = refW * DPR;
    canvas.height = refH * DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.imageSmoothingEnabled = false;
    Game.camera.onResize(refW, refH);
  }

  // Prevent double-tap zoom
  let lastTouch = 0;
  document.addEventListener('touchstart', (e)=>{
    const t = Date.now();
    if (t - lastTouch < 300) e.preventDefault();
    lastTouch = t;
  }, {passive:false});

  // UI elements
  const titleScreen = document.getElementById('titleScreen');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseScreen = document.getElementById('pauseScreen');
  const resumeBtn = document.getElementById('resumeBtn');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const retryBtn = document.getElementById('retryBtn');
  const clearScreen = document.getElementById('clearScreen');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const orientOverlay = document.getElementById('orientOverlay');
  const bossHud = document.getElementById('bossHud');
  const bossFill = document.getElementById('bossFill');

  const scoreText = document.getElementById('scoreText');
  const comboText = document.getElementById('comboText');
  const areaText = document.getElementById('areaText');
  const hpFill = document.getElementById('hpFill');
  const finalScore = document.getElementById('finalScore');
  const clearScore = document.getElementById('clearScore');

  // Touch buttons & hold bars
  const touchButtons = Array.from(document.querySelectorAll('.touchBtn'));

  // Input system with buffering
  const Input = {
    keys: {},
    pointers: { left:false, right:false, jump:false, attack:false, dash:false },
    // buffers: store recent pressed time to allow buffered execution
    buffer: { jump:0, attack:0 },
    bufferTime: 0.14, // seconds
    mapKeyToAction(k){
      if(['a','ArrowLeft'].includes(k)) return 'left';
      if(['d','ArrowRight'].includes(k)) return 'right';
      if(['w','ArrowUp',' '].includes(k)) return 'jump';
      if(['z','j'].includes(k)) return 'attack';
      if(['Shift','k'].includes(k)) return 'dash';
      if(k==='Escape') return 'pause';
      return null;
    },
    onPointerDown(action, id){
      this.pointers[action] = true;
      activePointers.set(id, action);
      // buffer jump/attack
      if(action === 'jump' || action === 'attack'){
        this.buffer[action] = this.bufferTime;
      }
    },
    onPointerUp(id){
      if(activePointers.has(id)){
        const act = activePointers.get(id);
        this.pointers[act] = false;
        activePointers.delete(id);
      }
    },
    onPointerCancel(id){
      this.onPointerUp(id);
    },
    resetAll(){
      for(let k in this.pointers) this.pointers[k] = false;
      activePointers.clear();
      this.buffer.jump = 0; this.buffer.attack = 0;
    },
    tick(dt){
      for(const k of Object.keys(this.buffer)){
        if(this.buffer[k] > 0) this.buffer[k] = Math.max(0, this.buffer[k] - dt);
      }
    }
  };

  // pointer tracking per active pointer id
  const activePointers = new Map();

  // Attach pointer events to buttons with robust cancel handling
  touchButtons.forEach(btn=>{
    btn.addEventListener('pointerdown', e=>{
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      const act = btn.dataset.action;
      Input.onPointerDown(act, e.pointerId);
      btn.classList.add('active');
      // small visual press
      updateHoldBar(btn, 0);
    }, {passive:false});
    btn.addEventListener('pointerup', e=>{
      e.preventDefault();
      Input.onPointerUp(e.pointerId);
      btn.classList.remove('active');
      updateHoldBar(btn, 0);
    });
    btn.addEventListener('pointercancel', e=>{
      Input.onPointerCancel(e.pointerId);
      btn.classList.remove('active');
      updateHoldBar(btn, 0);
    });
    btn.addEventListener('pointerleave', e=>{
      // If pointer leaves, keep state until pointerup/cancel captured
    });
  });

  // keyboard
  window.addEventListener('keydown', e=>{
    const action = Input.mapKeyToAction(e.key);
    if(action === 'pause'){ Game.togglePause(); e.preventDefault(); return; }
    if(action){
      Input.keys[action] = true;
      Input.pointers[action] = true;
      if(action === 'jump' || action === 'attack') Input.buffer[action] = Input.bufferTime;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e=>{
    const action = Input.mapKeyToAction(e.key);
    if(action){
      Input.keys[action] = false;
      Input.pointers[action] = false;
      e.preventDefault();
    }
  });

  // Update holdBar visual (progress 0..1)
  function updateHoldBar(btnElem, prog){
    const bar = btnElem.querySelector('.holdBar');
    if(!bar) return;
    const inner = bar.querySelector('::before');
    // update using style trick: set background-size or CSS variable
    const pseudo = bar;
    // set width via real child by creating inner element dynamically (since :before can't be set)
    let innerEl = bar._inner;
    if(!innerEl){
      innerEl = document.createElement('i');
      innerEl.style.position='absolute';
      innerEl.style.left='0'; innerEl.style.top='0'; innerEl.style.bottom='0';
      innerEl.style.width='0%';
      innerEl.style.background='linear-gradient(90deg,#7fd4ff,#ffcf7f)';
      innerEl.style.transition='width 0.06s linear';
      bar.appendChild(innerEl);
      bar._inner = innerEl;
    }
    innerEl.style.width = Math.round(prog*100) + '%';
  }

  // Audio manager with simple dedup (limit same sound within cooldown)
  class AudioManager {
    constructor(){
      this.ctx = null;
      this.master = null;
      this.unlocked = false;
      this.lastPlayed = {};
      this.minInterval = 40; // ms
    }
    ensure(){
      if(this.ctx) return;
      try{
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(this.ctx.destination);
      }catch(e){ console.warn('Audio not available', e); }
    }
    unlockOnGesture(){
      if(this.unlocked) return;
      this.ensure();
      if(!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this.master);
      g.gain.value = 0;
      o.start();
      o.stop(this.ctx.currentTime + 0.01);
      this.unlocked = true;
    }
    canPlay(key){
      const t = Date.now();
      if(!this.lastPlayed[key] || (t - this.lastPlayed[key] > this.minInterval)){
        this.lastPlayed[key] = t;
        return true;
      }
      return false;
    }
    playTone(freq=440, time=0.06, type='sine', vol=0.6, key='tone'){
      if(!this.ctx) return;
      if(!this.canPlay(key)) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(this.master);
      o.start();
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + time);
      o.stop(this.ctx.currentTime + time + 0.02);
    }
    playAttack(){ this.playTone(980,0.06,'square',0.5,'attack'); this.playTone(1400,0.04,'sawtooth',0.28,'attack2'); }
    playHit(){ this.playTone(240,0.08,'sine',0.6,'hit'); }
    playJump(){ this.playTone(620,0.12,'triangle',0.55,'jump'); }
    playDash(){ this.playTone(1200,0.08,'sawtooth',0.55,'dash'); }
    playCoin(){ this.playTone(1500,0.12,'triangle',0.7,'coin'); }
    playEnemyDie(){ this.playTone(320,0.2,'square',0.6,'edie'); }
    playBossAppear(){ this.playTone(220,0.6,'sine',0.8,'boss'); }
    playBossAttack(){ this.playTone(110,0.16,'sawtooth',0.75,'bossatk'); }
    playPlayerHurt(){ this.playTone(140,0.12,'triangle',0.7,'hurt'); }
  }
  const audio = new AudioManager();

  // Storage
  const Storage = {
    keyPrefix: 'tailblade_v1_',
    save(key, val){ localStorage.setItem(this.keyPrefix+key, JSON.stringify(val)); },
    load(key, def=null){ const v = localStorage.getItem(this.keyPrefix+key); return v ? JSON.parse(v) : def; }
  };

  // Camera
  class CameraClass {
    constructor(){ this.x=0; this.y=0; this.w=1280; this.h=720; }
    onResize(w,h){ this.w=w; this.h=h; }
    follow(x,y,lerp=0.12){ const targetX = x - this.w/2 + 160; this.x += (targetX - this.x) * lerp; }
  }
  const Camera = new CameraClass();

  // Particles
  class Particle { constructor(){ this.alive=false; }
    init(x,y,vx,vy,life,col,size){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.max=life; this.col=col; this.size=size; this.alive=true; }
    update(dt){ if(!this.alive) return; this.life-=dt; if(this.life<=0){ this.alive=false; return; } this.vy += 1200*dt; this.x+=this.vx*dt; this.y+=this.vy*dt; }
    draw(ctx,cam){ if(!this.alive) return; const a = clamp(this.life/this.max,0,1); ctx.fillStyle = `rgba(${this.col.r},${this.col.g},${this.col.b},${a})`; ctx.fillRect(Math.round(this.x - cam.x), Math.round(this.y - cam.y), this.size, this.size); }
  }
  const ParticleSystem = {
    pool: [],
    init(n=400){ for(let i=0;i<n;i++) this.pool.push(new Particle()); },
    spawn(x,y,n,col,size=2,speed=120,life=0.5){ for(let i=0;i<n;i++){ const p = this.pool.find(p=>!p.alive); if(!p) continue; const a = Math.random()*Math.PI*2; const s = (Math.random()*0.6+0.4)*speed; p.init(x,y,Math.cos(a)*s,Math.sin(a)*s-60,life*(Math.random()*0.7+0.6),col,size); } },
    update(dt){ this.pool.forEach(p=>p.update(dt)); },
    draw(ctx,cam){ this.pool.forEach(p=>p.draw(ctx,cam)); }
  };

  // Entity base
  class Entity { constructor(x,y){ this.x=x; this.y=y; this.vx=0; this.vy=0; this.w=32; this.h=32; this.dead=false; } rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; } }

  // Player with animation frame system, variable jump, buffers
  class Player extends Entity {
    constructor(x,y){
      super(x,y);
      this.w=36; this.h=40;
      this.speed = 260;
      this.accel = 2200;
      this.friction = 1600;
      this.maxSpeed = 360;
      this.gravity = 2200;
      this.jumpSpeed = -740;
      this.onGround = false;
      this.facing = 1;
      this.state = 'idle';
      this.hp = 6; this.maxHp = 6;
      this.invulnerable = 0;
      this.combo = 0; this.comboTimer = 0;
      // attack
      this.attackTimer = 0; this.attackCooldown = 0.18; this.attackStage = 0;
      // dash
      this.dashCooldown = 0; this.dashTime = 0;
      this.canDoubleJump = true;
      // variable jump
      this.jumpHoldTime = 0; this.maxJumpHold = 0.18;
      // animation
      this.anim = { name:'idle', frame:0, t:0 };
      this.score = 0;
    }

    update(dt, input, stage){
      // timers
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if(this.comboTimer===0) this.combo = 0;
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      if(this.dashTime>0) this.dashTime = Math.max(0, this.dashTime - dt);

      // input tick (buffers)
      input.tick(dt);

      // horizontal target speed with smoothing using ease function
      let target = 0;
      if(input.pointers.left) target -= this.speed;
      if(input.pointers.right) target += this.speed;
      if(this.dashTime>0) target = this.facing * 920;
      // smooth acceleration: approach target with variable accel
      const dv = target - this.vx;
      const acc = Math.abs(target) > 1 ? this.accel : this.friction;
      const change = clamp(dv, -acc*dt, acc*dt);
      this.vx += change;

      // gravity
      this.vy += this.gravity * dt;

      // variable jump: if buffer active and can jump, perform
      if(input.buffer.jump > 0 && (this.onGround || this.canDoubleJump)){
        // if mid-air and double-jump
        if(!this.onGround){ this.canDoubleJump = false; }
        this.vy = this.jumpSpeed;
        this.onGround = false;
        this.jumpHoldTime = this.maxJumpHold;
        input.buffer.jump = 0;
        audio.playJump();
      }

      // while holding jump, reduce gravity slightly (variable jump)
      if(input.pointers.jump && this.jumpHoldTime > 0){
        this.vy += this.gravity * dt * -0.35; // small upward assist
        this.jumpHoldTime = Math.max(0, this.jumpHoldTime - dt);
      } else {
        this.jumpHoldTime = 0;
      }

      // dash
      if(input.pointers.dash && this.dashCooldown<=0){
        this.dashTime = 0.16;
        this.dashCooldown = 1.1;
        this.invulnerable = 0.12;
        audio.playDash();
        // create residuals over next frames
        for(let i=0;i<8;i++) ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 1, {r:120,g:200,b:255}, 3, 260, 0.26);
      }

      // attack buffered or immediate
      if((input.pointers.attack || input.buffer.attack > 0) && this.attackTimer <= 0){
        this.attackTimer = this.attackCooldown;
        this.attackStage = (this.attackStage % 3) + 1;
        input.buffer.attack = 0;
        this.performAttack(stage);
      }

      // apply velocity
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // ground/platform collisions
      this.onGround = false;
      for(const p of stage.platforms){
        if(this.x + this.w > p.x && this.x < p.x + p.w && this.y + this.h > p.y && this.y < p.y + p.h){
          if(this.vy > 0 && (this.y + this.h - this.vy*dt) <= p.y + 8){
            this.y = p.y - this.h;
            this.vy = 0;
            this.onGround = true;
            this.canDoubleJump = true;
          } else {
            // side collision
            if(this.x < p.x) this.x = p.x - this.w;
            else this.x = p.x + p.w;
            this.vx = 0;
          }
        }
      }

      // fall out
      if(this.y > stage.height + 240){
        this.takeDamage(99, {x:0,y:0}, stage);
      }

      // facing
      if(Math.abs(this.vx) > 4) this.facing = this.vx > 0 ? 1 : -1;

      // combo timer reset handled above

      // clamp
      this.vx = clamp(this.vx, -1400, 1400);
      this.vy = clamp(this.vy, -2000, 2000);

      // animate state selection
      this.updateAnim(dt);
    }

    updateAnim(dt){
      // choose anim name by state & velocities
      if(this.attackTimer > 0) this.anim.name = 'attack' + this.attackStage;
      else if(!this.onGround) this.anim.name = (this.vy < 0) ? 'jump' : 'fall';
      else if(Math.abs(this.vx) > 30) this.anim.name = 'run';
      else this.anim.name = 'idle';
      // frame advance
      const rates = { idle:0.18, run:0.08, jump:0.12, fall:0.12, attack1:0.06, attack2:0.06, attack3:0.06 };
      this.anim.t += dt;
      const rate = rates[this.anim.name] || 0.12;
      if(this.anim.t >= rate){ this.anim.t = 0; this.anim.frame = (this.anim.frame + 1) % 4; }
    }

    performAttack(stage){
      audio.playAttack();
      Game.hitStop(70);
      Game.shake(6);
      // attack arc
      const arc = { x: this.x + (this.facing>0 ? this.w : -48), y: this.y + 8, w: 48, h: 30, power: 1 + this.attackStage, knock: 220 + this.attackStage*50 };
      // visual slashes
      ParticleSystem.spawn(arc.x + arc.w/2, arc.y + arc.h/2, 8, {r:255,g:200,b:140}, 2, 260, 0.36);
      // hit detection
      for(const e of Game.stage.enemies){
        if(e.dead) continue;
        if(arc.x < e.x + e.w && arc.x + arc.w > e.x && arc.y < e.y + e.h && arc.y + arc.h > e.y){
          e.takeDamage(arc.power, this.facing, arc.knock/2);
          this.combo += 1; this.comboTimer = 1.8;
          Game.shake(9);
          ParticleSystem.spawn(e.x+e.w/2, e.y+e.h/2, 12, {r:255,g:120,b:80}, 2, 240, 0.45);
          audio.playHit();
          Game.addScore(140 + this.attackStage*20);
        }
      }
    }

    takeDamage(dmg, from, stage){
      if(this.invulnerable>0) return;
      this.hp -= dmg;
      this.invulnerable = 1.0;
      audio.playPlayerHurt();
      Game.shake(12);
      ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 14, {r:255,g:80,b:80}, 3, 320, 0.6);
      this.vx = from.x * 220;
      this.vy = -420;
      if(this.hp <= 0) this.die(stage);
    }

    die(){ Game.onPlayerDie(); }

    draw(ctx, cam){
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(Math.round(this.x - cam.x + 6), Math.round(this.y - cam.y + this.h - 6), 28, 6);

      const px = Math.round(this.x - cam.x);
      const py = Math.round(this.y - cam.y);

      // draw simple 3-frame anim by varying positions/colors
      // body base
      const body = '#3a2b20';
      const trim = '#ffd37a';
      ctx.save();
      // slight bob while running
      let bob = 0;
      if(this.anim.name === 'run') bob = Math.sin((this.anim.frame/4)*Math.PI*2)*1.6;
      ctx.translate(0, bob);

      // draw cape sway
      ctx.fillStyle = '#122030';
      ctx.fillRect(px+8, py+18, 20, 12);

      // head with ear animation
      ctx.fillStyle = body;
      ctx.fillRect(px+6, py-6, 20, 18);
      // ears small movement for run
      const earOffset = (this.anim.name === 'run') ? ((this.anim.frame%2)*2 -1) : 0;
      ctx.fillRect(px+6, py-10 + earOffset, 6, 6);
      ctx.fillRect(px+20, py-10 - earOffset, 6, 6);

      // torso
      ctx.fillRect(px+4, py+8, 28, 22);
      // tail swing
      const tailOffset = (this.anim.name === 'run') ? ((this.anim.frame%4)-1.5)*2 : 0;
      ctx.fillRect(px+30 + tailOffset, py+12, 6, 6);
      // sword with different angle on attacks
      ctx.fillStyle = '#9fb8da';
      let swordX = px+28;
      if(this.facing < 0) swordX = px-12;
      // swing effect for attacks
      if(this.anim.name.startsWith('attack')){
        ctx.fillRect(swordX, py+4, 8, 28);
        // slash arc
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(this.facing>0 ? px+40 : px-32, py+4, 24*this.attackStage, 10);
      } else {
        ctx.fillRect(swordX, py+6, 6, 24);
      }

      // scarf
      ctx.fillStyle = '#b24d8b';
      ctx.fillRect(px+8, py+12, 12, 6);

      // eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(px+12, py-2, 4, 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(px+13, py-1, 2, 2);

      ctx.restore();
    }
  }

  // Enemy (unchanged core, but ensures consistent API)
  class Enemy extends Entity {
    constructor(x,y,t){
      super(x,y);
      this.type = t || 'normal';
      if(this.type==='normal'){ this.w=28; this.h=28; this.maxHp=2; this.speed=60; this.score=200; }
      else if(this.type==='fast'){ this.w=24; this.h=24; this.maxHp=1; this.speed=120; this.score=150; }
      else if(this.type==='big'){ this.w=44; this.h=44; this.maxHp=8; this.speed=40; this.score=450; }
      this.hp = this.maxHp;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.damage = (this.type==='big')?2:1;
      this.attackRange = 28;
      this.knock = 200;
      this.attackCooldown = 0;
    }
    update(dt, player, stage){
      if(this.dead) return;
      const dist = player.x - this.x;
      if(Math.abs(dist) < 220) this.dir = dist>0 ? 1 : -1;
      this.vx = this.dir * this.speed;
      this.x += this.vx * dt;
      for(const p of stage.platforms){
        if(this.x + this.w > p.x && this.x < p.x + p.w && this.y + this.h > p.y && this.y < p.y + p.h){
          if(this.y + this.h - this.vy*dt <= p.y + 6){
            this.y = p.y - this.h; this.vy = 0;
          } else {
            if(this.x < p.x) this.x = p.x - this.w;
            else this.x = p.x + p.w;
            this.dir *= -1;
          }
        }
      }
      this.attackCooldown = Math.max(0,this.attackCooldown - dt);
      if(this.attackCooldown<=0 && Math.abs(player.x - this.x) < this.attackRange && Math.abs(player.y - this.y) < 24){
        player.takeDamage(this.damage, {x:this.dir*2, y:-1}, stage);
        this.attackCooldown = 0.8;
      }
    }
    takeDamage(n, fromDir, knock){
      this.hp -= n; this.vx = fromDir * -200; this.vy = -180;
      if(this.hp <= 0) this.die();
      else ParticleSystem.spawn(this.x + this.w/2, this.y + this.h/2, 6, {r:255,g:120,b:80}, 2, 140, 0.5);
    }
    die(){ this.dead = true; ParticleSystem.spawn(this.x + this.w/2, this.y + this.h/2, 18, {r:240,g:180,b:120}, 3, 300, 0.8); audio.playEnemyDie(); Game.addScore(this.score); }
    draw(ctx, cam){
      if(this.dead) return;
      const px = Math.round(this.x - cam.x);
      const py = Math.round(this.y - cam.y);
      if(this.type==='normal'){ ctx.fillStyle='#7b3b3b'; ctx.fillRect(px,py,this.w,this.h); ctx.fillStyle='#ffd'; ctx.fillRect(px+6,py+6,4,4); }
      else if(this.type==='fast'){ ctx.fillStyle='#3b7b46'; ctx.fillRect(px,py,this.w,this.h); ctx.fillStyle='#fff'; ctx.fillRect(px+4,py+6,4,4); }
      else { ctx.fillStyle='#4a3b7b'; ctx.fillRect(px,py,this.w,this.h); ctx.fillStyle='#ffd37a'; ctx.fillRect(px+8,py+8,6,6); }
    }
  }

  // Boss (with telegraph state)
  class Boss extends Entity {
    constructor(x,y){
      super(x,y);
      this.w=220; this.h=220; this.maxHp=120; this.hp=this.maxHp;
      this.phaseTimer=0; this.state='idle'; this.attackCooldown=1.8; this.visible=false;
      this.telegraph=0; // >0 means telegraph in progress (seconds)
      this.telegraphType=null;
    }
    appear(){ this.visible=true; audio.playBossAppear(); Game.shake(18); }
    update(dt, player, stage){
      if(!this.visible || this.hp<=0) return;
      this.attackCooldown -= dt;
      if(this.telegraph>0){ this.telegraph -= dt; if(this.telegraph<=0) this.executeTelegraph(player); return; }
      if(this.attackCooldown <= 0){
        this.chooseTelegraph(player);
        this.attackCooldown = 2.0;
      }
      // subtle move
      const targetX = stage.goalX - 400;
      this.x += (targetX - this.x) * dt * 0.4;
    }
    chooseTelegraph(player){
      const r = Math.random();
      if(r < 0.33) this.startTelegraph('pounce', 0.5);
      else if(r < 0.66) this.startTelegraph('shockwave', 0.7);
      else this.startTelegraph('areaslam', 0.9);
    }
    startTelegraph(type, time){
      this.telegraph = time;
      this.telegraphType = type;
      // create visual telegraph (particles)
      ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 18, {r:255,g:180,b:90}, 4, 160, time);
      Game.shake(6);
    }
    executeTelegraph(player){
      if(this.telegraphType === 'pounce') this.pounce(player);
      else if(this.telegraphType === 'shockwave') this.shockwave(player);
      else this.areaSlam(player);
      this.telegraphType = null;
    }
    pounce(player){ audio.playBossAttack(); const dir = player.x > this.x ? 1 : -1; setTimeout(()=>{ this.x += dir * 420; ParticleSystem.spawn(this.x+this.w/2,this.y+this.h/2,28,{r:200,g:80,b:80},4,360,0.9); }, 60); }
    shockwave(){ audio.playBossAttack(); ParticleSystem.spawn(this.x+this.w/2,this.y+this.h,40,{r:255,g:180,b:90},3,240,0.9); if(Math.abs(Game.player.x - this.x) < 300 && Game.player.onGround) Game.player.takeDamage(2, {x:this.x > Game.player.x ? -1 : 1, y:0}, Game.stage); }
    areaSlam(){ audio.playBossAttack(); setTimeout(()=>{ ParticleSystem.spawn(this.x+this.w/2,this.y+this.h/2,60,{r:220,g:200,b:100},4,360,1.2); if(Math.abs(Game.player.x - this.x) < 200) Game.player.takeDamage(3, {x:this.x > Game.player.x ? -1 : 1, y:-1}, Game.stage); }, 360); }
    takeDamage(n){ this.hp -= n; if(this.hp<=0) this.die(); else ParticleSystem.spawn(this.x+this.w/2,this.y+this.h/2,10,{r:255,g:120,b:120},3,240,0.7); }
    die(){ Game.onBossDefeated(); }
    draw(ctx, cam){
      if(!this.visible || this.hp<=0) return;
      const px = Math.round(this.x - cam.x), py = Math.round(this.y - cam.y);
      // boss body with telegraph glow
      ctx.fillStyle = this.telegraph > 0 ? '#3a2238' : '#1f1b2b';
      ctx.fillRect(px,py,this.w,this.h);
      ctx.fillStyle = '#e0a8ff';
      ctx.fillRect(px+40,py+36,18,10); ctx.fillRect(px+this.w-58,py+36,18,10);
      ctx.fillStyle = '#ffcf7f';
      ctx.fillRect(px+20,py+this.h-18,36,8);
      if(this.telegraph>0){
        ctx.fillStyle = 'rgba(255,120,90,0.08)';
        ctx.fillRect(px-20, py-20, this.w+40, this.h+40);
      }
    }
  }

  // Stage
  class StageClass {
    constructor(){ this.width=6000; this.height=720; this.platforms=[]; this.coins=[]; this.enemies=[]; this.goalX=5400; }
    build(){
      this.platforms=[]; this.coins=[]; this.enemies=[];
      this.platforms.push({x:-1000,y:620,w:8000,h:160});
      let x=300;
      for(let i=0;i<8;i++){ this.platforms.push({x:x,y:520-(i%3)*24,w:140,h:20}); this.coins.push({x:x+48,y:480-(i%3)*24,taken:false}); x+=220+(i%2)*40; }
      this.enemies.push(new Enemy(800,560,'normal')); this.enemies.push(new Enemy(950,560,'fast')); this.enemies.push(new Enemy(1150,560,'normal'));
      this.platforms.push({x:1500,y:580,w:360,h:20}); this.platforms.push({x:1900,y:500,w:180,h:20}); this.coins.push({x:1960,y:460,taken:false}); this.enemies.push(new Enemy(1550,520,'big'));
      this.platforms.push({x:2300,y:520,w:120,h:20}); this.platforms.push({x:2450,y:460,w:120,h:20}); this.coins.push({x:2478,y:420,taken:false});
      this.platforms.push({x:3200,y:560,w:800,h:20});
      for(let i=0;i<12;i++){ this.coins.push({x:2600+i*60,y:520-(i%4)*24,taken:false}); }
      for(let i=0;i<6;i++){ this.enemies.push(new Enemy(3400 + i*220, 520, (i%3===0)?'fast':'normal')); }
      this.boss = new Boss(this.goalX, 300);
    }
  }

  // Game core
  const Game = {
    state: STATE.TITLE, lastTime:0, dtCap:0.05, accumulator:0,
    player:null, stage:null, camera:Camera,
    shakeTime:0, shakeIntensity:0, hitStopTime:0,
    highScore:Storage.load('highscore',0), bestCombo:Storage.load('bestCombo',0),

    init(){
      ParticleSystem.init(500);
      this.stage = new StageClass(); this.stage.build();
      this.player = new Player(120,520);
      this.camera.x = 0; this.camera.y = 0;
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      window.addEventListener('orientationchange', ()=>this.checkOrientation());
      window.addEventListener('resize', ()=>this.checkOrientation());
      startBtn.addEventListener('click', ()=>{ this.startFromTitle(); });
      startBtn.addEventListener('pointerdown', ()=>{ audio.ensure(); audio.unlockOnGesture(); });
      pauseBtn.addEventListener('click', ()=> this.togglePause());
      resumeBtn.addEventListener('click', ()=> this.resume());
      retryBtn.addEventListener('click', ()=> this.restart());
      playAgainBtn.addEventListener('click', ()=> this.restart());
      this.updateUI();
      this.lastTime = performance.now();
      requestAnimationFrame(this.loop.bind(this));
      this.checkOrientation();
      document.addEventListener('visibilitychange', ()=>{ if(document.hidden) Input.resetAll(); });
    },

    checkOrientation(){ if(window.innerHeight > window.innerWidth) orientOverlay.classList.remove('hidden'); else orientOverlay.classList.add('hidden'); },

    startFromTitle(){ titleScreen.classList.add('hidden'); audio.unlockOnGesture(); this.start(); },

    start(){ this.state = STATE.PLAYING; this.player = new Player(120,520); this.stage.build(); this.stage.boss.hp = this.stage.boss.maxHp; this.stage.boss.visible=false; this.stage.enemies.forEach(e=>e.dead=false); this.lastTime = performance.now(); this.updateUI(); audio.playTone(440,0.12,'sine',0.6,'start'); },

    restart(){ this.state = STATE.PLAYING; gameReset(); },

    togglePause(){ if(this.state === STATE.PLAYING || this.state === STATE.BOSS){ this.state = STATE.PAUSED; pauseScreen.classList.remove('hidden'); } else if(this.state === STATE.PAUSED) this.resume(); },

    resume(){ if(this.state === STATE.PAUSED) this.state = STATE.PLAYING; pauseScreen.classList.add('hidden'); },

    loop(t){ requestAnimationFrame(this.loop.bind(this)); let dt = (t - this.lastTime) / 1000; this.lastTime = t; if(dt > this.dtCap) dt = this.dtCap; if(this.hitStopTime > 0){ this.hitStopTime -= dt; dt = 0; } this.update(dt); this.draw(); },

    update(dt){
      if(this.state === STATE.TITLE || this.state === STATE.PAUSED || this.state === STATE.GAME_OVER || this.state === STATE.CLEAR) return;
      if(!audio.unlocked){ /* audio will be unlocked on start */ }
      this.player.update(dt, Input, this.stage);
      this.camera.follow(this.player.x, this.player.y);

      // enemies
      for(const e of this.stage.enemies) e.update(dt, this.player, this.stage);

      // boss trigger
      if(!this.stage.boss.visible && this.player.x > this.stage.goalX - 600){ this.stage.boss.appear(); this.state = STATE.BOSS; bossHud.classList.remove('hidden'); }

      if(this.stage.boss.visible) this.stage.boss.update(dt, this.player, this.stage);

      // coins pickup
      for(const coin of this.stage.coins){
        if(coin.taken) continue;
        if(this.player.x + this.player.w > coin.x && this.player.x < coin.x + 12 && this.player.y + this.player.h > coin.y && this.player.y < coin.y + 12){
          coin.taken = true; this.addScore(50); ParticleSystem.spawn(coin.x+6, coin.y+6, 12, {r:255,g:240,b:120}, 2, 180, 0.6); audio.playCoin();
        }
      }

      ParticleSystem.update(dt);
      Input.tick(dt);

      // Update touch UI hold bars (visualizing jump hold & dash cooldown)
      touchButtons.forEach(btn=>{
        const action = btn.dataset.action;
        if(action === 'jump'){
          const prog = clamp(this.player.jumpHoldTime / this.player.maxJumpHold, 0, 1);
          updateHoldBar(btn, prog);
        } else if(action === 'dash'){
          const prog = clamp(1 - (this.player.dashCooldown / 1.1), 0, 1);
          updateHoldBar(btn, prog);
        } else {
          updateHoldBar(btn, 0);
        }
      });

      this.updateUI();
      if(this.stage.boss.visible) bossFill.style.width = Math.max(0, (this.stage.boss.hp / this.stage.boss.maxHp) * 100) + '%';
    },

    draw(){
      ctx.clearRect(0,0, canvas.width, canvas.height);
      let camX = this.camera.x, camY = this.camera.y;
      if(this.shakeTime > 0){ const s = this.shakeIntensity; camX += (Math.random()*2-1) * s; camY += (Math.random()*2-1) * s; this.shakeTime = Math.max(0, this.shakeTime - 0.016); }
      this.drawBackground(ctx, camX);

      // platforms
      ctx.fillStyle = '#2b2b2b';
      for(const p of this.stage.platforms) ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.w, p.h);

      // coins
      for(const coin of this.stage.coins){
        if(coin.taken) continue;
        const cx = Math.round(coin.x - camX), cy = Math.round(coin.y - camY);
        ctx.fillStyle = '#ffd24d'; ctx.fillRect(cx, cy, 12, 12); ctx.fillStyle = '#fff2b8'; ctx.fillRect(cx+3, cy+3, 6, 6);
      }

      // enemies
      for(const e of this.stage.enemies) e.draw(ctx, {x:camX, y:camY});

      // boss
      if(this.stage.boss.visible) this.stage.boss.draw(ctx, {x:camX, y:camY});

      // player
      this.player.draw(ctx, {x:camX, y:camY});

      // particles
      ParticleSystem.draw(ctx, {x:camX, y:camY});
    },

    drawBackground(ctx, camX){
      const w = canvas.width / DPR, h = canvas.height / DPR;
      const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#071129'); g.addColorStop(1,'#081224'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#fff7d0'; ctx.beginPath(); ctx.arc(140 - camX*0.02 % w, 90, 28, 0, Math.PI*2); ctx.fill();
      for(let i=0;i<30;i++){ const sx = (i*77 + (camX*0.01)) % (w+200); const sy = 40 + (i*13)%120; ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect((sx+w)%w, sy, 2,2); }
      ctx.fillStyle = '#0f1a2a'; for(let i=0;i<8;i++){ const bx = Math.round((i*420 - camX*0.15) % (w+420)); ctx.fillRect(bx - 40, h-280, 120, 200); }
      ctx.fillStyle = 'rgba(120,150,220,0.03)'; ctx.fillRect(0, h-260, w, 200);
      for(let i=0;i<12;i++){ const sx = Math.round((i*320 - camX*0.6)); const sy = h-260; ctx.fillStyle = '#2e2e3b'; ctx.fillRect(sx+8, sy+20, 8, 120); ctx.fillStyle = 'rgba(255,200,120,0.12)'; ctx.fillRect(sx, sy+10, 24, 40); }
    },

    addScore(n){
      this.player.score += n;
      if(this.player.score > this.highScore){ this.highScore = this.player.score; Storage.save('highscore', this.highScore); }
      if(this.player.combo > this.bestCombo){ this.bestCombo = this.player.combo; Storage.save('bestCombo', this.bestCombo); }
    },

    updateUI(){
      scoreText.textContent = String(this.player.score).padStart(6,'0');
      comboText.textContent = 'x' + String(this.player.combo);
      areaText.textContent = '1';
      hpFill.style.width = Math.round((this.player.hp / this.player.maxHp) * 100) + '%';
    },

    shake(intensity=6, time=0.25){ this.shakeIntensity=intensity; this.shakeTime=time; },

    hitStop(ms){ this.hitStopTime = ms/1000; },

    onPlayerDie(){ this.state = STATE.GAME_OVER; gameOverScreen.classList.remove('hidden'); finalScore.textContent = 'SCORE ' + String(this.player.score).padStart(6,'0'); },

    onBossDefeated(){ this.state = STATE.CLEAR; clearScreen.classList.remove('hidden'); clearScore.textContent = 'SCORE ' + String(this.player.score).padStart(6,'0'); audio.playTone(880,0.6,'sine',0.9,'clear'); }
  };

  function gameReset(){ Game.player = new Player(120,520); Game.stage.build(); Game.state = STATE.PLAYING; gameOverScreen.classList.add('hidden'); clearScreen.classList.add('hidden'); bossHud.classList.add('hidden'); }

  // init
  resizeCanvas();
  Game.init();

  // safety cleanup
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.Game = Game;

})();
