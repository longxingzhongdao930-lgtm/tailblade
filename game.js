// game.js - TAILBLADE
// Single-file game logic. Designed to run without external assets.
// Author note: keep code organized by sections (Input, Audio, Entities, Stage, Game)

(() => {
  'use strict';

  // Constants & utilities
  const STATE = { TITLE:0, PLAYING:1, PAUSED:2, BOSS:3, GAME_OVER:4, CLEAR:5 };
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const now = ()=>performance.now();

  // Canvas setup & responsive scaling
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let DPR = Math.max(1, window.devicePixelRatio || 1);

  function resizeCanvas() {
    // Fill the available landscape area while preserving high-DPI
    const w = window.innerWidth;
    const h = window.innerHeight;
    // We enforce landscape gameplay: set internal resolution to a landscape-oriented size
    const targetHeight = 720; // internal reference
    const targetWidth = Math.round(targetHeight * 16/9);
    // scale to fit window while preserving aspect ratio
    let scale = Math.min(w / targetWidth, h / targetHeight);
    // Avoid fractional scaling that causes blurriness on pixel art; we'll scale integer-ish
    canvas.style.width = Math.floor(targetWidth * scale) + 'px';
    canvas.style.height = Math.floor(targetHeight * scale) + 'px';
    // Set backing store size based on DPR
    canvas.width = targetWidth * DPR;
    canvas.height = targetHeight * DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.imageSmoothingEnabled = false;
    Game.camera.onResize(targetWidth, targetHeight);
  }

  // Prevent double-tap zoom on iOS: track last touch
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

  // Touch buttons
  const touchButtons = Array.from(document.querySelectorAll('.touchBtn'));
  // pointer tracking per button
  const activePointers = new Map();

  // Input system (pointer + keyboard)
  const Input = {
    keys: {},
    pointers: {
      left:false, right:false, jump:false, attack:false, dash:false
    },
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
      this.pointers[action]=true;
      activePointers.set(id, action);
    },
    onPointerUp(id){
      if(activePointers.has(id)){
        const act = activePointers.get(id);
        this.pointers[act]=false;
        activePointers.delete(id);
      }
    },
    onPointerCancel(id){
      this.onPointerUp(id);
    },
    resetAll(){
      for(let k in this.pointers) this.pointers[k]=false;
      activePointers.clear();
    }
  };

  // Attach pointer events to buttons
  touchButtons.forEach(btn=>{
    btn.addEventListener('pointerdown', e=>{
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      const act = btn.dataset.action;
      Input.onPointerDown(act, e.pointerId);
      btn.classList.add('active');
    });
    btn.addEventListener('pointerup', e=>{
      e.preventDefault();
      const pid = e.pointerId;
      Input.onPointerUp(pid);
      btn.classList.remove('active');
    });
    btn.addEventListener('pointercancel', e=>{
      Input.onPointerCancel(e.pointerId);
      btn.classList.remove('active');
    });
    // If pointer leaves the button while pressed, still keep state per pointer events.
    btn.addEventListener('pointerout', e=>{
      // do not cancel here, rely on pointerup/cancel to clear, but if pointer is moving we keep pressed
    });
  });

  // Keyboard
  window.addEventListener('keydown', e=>{
    const action = Input.mapKeyToAction(e.key);
    if(action==='pause'){
      Game.togglePause();
      e.preventDefault();
      return;
    }
    if(action){
      Input.keys[action]=true;
      Input.pointers[action]=true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e=>{
    const action = Input.mapKeyToAction(e.key);
    if(action){
      Input.keys[action]=false;
      Input.pointers[action]=false;
      e.preventDefault();
    }
  });

  // Audio manager (WebAudio synth effects)
  class AudioManager {
    constructor(){
      this.ctx = null;
      this.masterGain = null;
      this.unlocked = false;
    }
    ensure(){
      if(this.ctx) return;
      try{
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.ctx.destination);
      }catch(e){ console.warn('Audio failed', e); }
    }
    unlockOnUserGesture(){
      if(this.unlocked) return;
      this.ensure();
      if(!this.ctx) return;
      // create a short silent buffer to unlock autoplay restrictions
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this.masterGain);
      g.gain.value = 0;
      o.start();
      o.stop(this.ctx.currentTime + 0.01);
      this.unlocked = true;
    }
    playBeep(freq=440, time=0.08, type='sine', vol=0.6){
      if(!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(this.masterGain);
      o.start();
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + time);
      o.stop(this.ctx.currentTime + time + 0.02);
    }
    playAttack(){
      this.playBeep(900, 0.06, 'square', 0.5);
      this.playBeep(1400, 0.04, 'sawtooth', 0.3);
    }
    playHit(){ this.playBeep(220, 0.08, 'sine', 0.6); }
    playJump(){ this.playBeep(600, 0.12, 'triangle', 0.5); }
    playDash(){ this.playBeep(1200, 0.08, 'sawtooth', 0.5); }
    playCoin(){ this.playBeep(1400, 0.12, 'triangle', 0.6); }
    playEnemyDie(){ this.playBeep(300, 0.2, 'square', 0.6); }
    playBossAppear(){ this.playBeep(220,0.6,'sine',0.7); }
    playBossAttack(){ this.playBeep(100,0.18,'sawtooth',0.7); }
    playPlayerHurt(){ this.playBeep(120,0.12,'triangle',0.7); }
  }
  const audio = new AudioManager();

  // Storage (localStorage + placeholder for Supabase integration)
  const Storage = {
    keyPrefix: 'tailblade_v1_',
    save(key, val){ localStorage.setItem(this.keyPrefix+key, JSON.stringify(val)); },
    load(key, def=null){ const v = localStorage.getItem(this.keyPrefix+key); return v ? JSON.parse(v) : def; }
  };

  // Camera (simple follow)
  class CameraClass {
    constructor(){
      this.x = 0;
      this.y = 0;
      this.w = 1280;
      this.h = 720;
    }
    onResize(w,h){
      this.w = w; this.h = h;
    }
    follow(x,y, lerp=0.12){
      const targetX = x - this.w/2 + 160;
      this.x += (targetX - this.x) * lerp;
    }
  }
  const Camera = new CameraClass();

  // Particles (simple pooled)
  class Particle {
    constructor(){ this.alive=false; }
    init(x,y, vx, vy, life, color, size){
      this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.max=life; this.color=color; this.size=size; this.alive=true;
    }
    update(dt){
      if(!this.alive) return;
      this.life -= dt;
      if(this.life<=0){ this.alive=false; return; }
      this.vy += 1200 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
    draw(ctx, cam){
      if(!this.alive) return;
      const alpha = clamp(this.life / this.max, 0, 1);
      ctx.fillStyle = `rgba(${this.color.r},${this.color.g},${this.color.b},${alpha})`;
      // draw as pixel square
      ctx.fillRect(Math.round(this.x - cam.x) , Math.round(this.y - cam.y) , this.size, this.size);
    }
  }

  const ParticleSystem = {
    pool: [],
    init(n=200){
      for(let i=0;i<n;i++) this.pool.push(new Particle());
    },
    spawn(x,y, n, col, size=2, speed=120, life=0.5){
      for(let i=0;i<n;i++){
        const p = this.pool.find(p=>!p.alive);
        if(!p) continue;
        const ang = Math.random()*Math.PI*2;
        const sp = (Math.random()*0.6+0.4)*speed;
        p.init(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp - 60, life*(Math.random()*0.7+0.6), col, size);
      }
    },
    update(dt){ this.pool.forEach(p=>p.update(dt)); },
    draw(ctx, cam){ this.pool.forEach(p=>p.draw(ctx,cam)); }
  };

  // Basic Entity class
  class Entity {
    constructor(x,y){
      this.x=x; this.y=y; this.vx=0; this.vy=0;
      this.w=32; this.h=32; this.dead=false;
    }
    rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
    intersects(other){
      return !(this.x+this.w < other.x || this.x > other.x+other.w || this.y+this.h < other.y || this.y > other.y+other.h);
    }
  }

  // Player class
  class Player extends Entity {
    constructor(x,y){
      super(x,y);
      this.w=36; this.h=40;
      this.speed = 260;
      this.accel = 2000;
      this.friction = 1600;
      this.maxSpeed = 300;
      this.gravity = 2200;
      this.jumpSpeed = -700;
      this.onGround = false;
      this.facing = 1;
      this.state = 'idle';
      this.hp = 6;
      this.maxHp = 6;
      this.invulnerable = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.score = 0;
      // attack system
      this.attackTimer = 0;
      this.attackCooldown = 0.18;
      this.attackStage = 0;
      // dash
      this.dashCooldown = 0;
      this.dashTime = 0;
      this.canDoubleJump = false;
      this.residuals = []; // for dash images
    }

    update(dt, input, stage){
      // timers
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if(this.comboTimer===0) this.combo = 0;
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      if(this.dashTime>0) this.dashTime = Math.max(0, this.dashTime - dt);

      // horizontal movement
      let targetVX = 0;
      if(input.pointers.left) targetVX -= this.speed;
      if(input.pointers.right) targetVX += this.speed;
      // dash modifies speed
      if(this.dashTime>0){ targetVX = this.facing * 900; }

      // accelerate toward target
      const dv = targetVX - this.vx;
      const accel = (Math.abs(targetVX) > 0 ? this.accel : this.friction);
      const change = clamp(dv, -accel*dt, accel*dt);
      this.vx += change;

      // gravity
      this.vy += this.gravity * dt;

      // jump
      if(input.pointers.jump){
        if(this.onGround){
          this.vy = this.jumpSpeed;
          this.onGround = false;
          audio.playJump();
        } else if(this.canDoubleJump && this.vy > -200){
          this.vy = this.jumpSpeed * 0.95;
          this.canDoubleJump = false;
          audio.playJump();
        }
        input.pointers.jump = false; // don't hold to repeatedly trigger
      }

      // dash
      if(input.pointers.dash && this.dashCooldown<=0){
        this.dashTime = 0.18;
        this.dashCooldown = 1.2;
        audio.playDash();
        this.invulnerable = 0.12;
        // create dash residuals
        for(let i=0;i<6;i++){
          ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 1, {r:180,g:220,b:255}, 3, 200, 0.24);
        }
      }

      // attacks
      if(input.pointers.attack && this.attackTimer<=0){
        this.attackTimer = this.attackCooldown;
        this.attackStage = (this.attackStage % 3) + 1;
        this.performAttack(stage);
      }

      // apply velocity
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // ground collision (simple)
      this.onGround = false;
      for(const p of stage.platforms){
        // axis-aligned bounding box collision
        if(this.x + this.w > p.x && this.x < p.x + p.w && this.y + this.h > p.y && this.y < p.y + p.h){
          // simple resolution: pull to top
          if(this.vy > 0 && (this.y + this.h - this.vy*dt) <= p.y + 6){
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

      // world bounds floor
      if(this.y > stage.height + 200){
        this.takeDamage(99, {x:0,y:0}, stage);
      }

      // update facing
      if(Math.abs(this.vx) > 1) this.facing = this.vx > 0 ? 1 : -1;

      // combo timer
      if(this.combo > 0) this.comboTimer = Math.max(0, this.comboTimer - dt);

      // clamp
      this.vx = clamp(this.vx, -1200, 1200);
      this.vy = clamp(this.vy, -2000, 2000);
    }

    performAttack(stage){
      audio.playAttack();
      // hitstop & screen shake can be implemented by notifying Game
      Game.hitStop(80);
      Game.shake(6);
      // spawn sword arc (we'll check enemies in stage)
      const arc = {
        x: this.x + (this.facing>0 ? this.w : -40),
        y: this.y + 6,
        w: 48,
        h: 28,
        power: 1 + this.attackStage, // small combo boost
        knock: 220 + this.attackStage*40
      };
      // create particles
      ParticleSystem.spawn(arc.x + arc.w/2, arc.y + arc.h/2, 6, {r:255,g:200,b:120}, 2, 220, 0.3);

      // detect hits
      for(const e of Game.stage.enemies){
        if(e.dead) continue;
        if(arc.x < e.x + e.w && arc.x + arc.w > e.x && arc.y < e.y + e.h && arc.y + arc.h > e.y){
          // hit
          e.takeDamage(arc.power, this.facing, arc.knock/2);
          // hit effects
          Game.addScore(150);
          this.combo += 1;
          this.comboTimer = 1.6;
          Game.shake(8);
          ParticleSystem.spawn(e.x+e.w/2, e.y+e.h/2, 12, {r:255,g:120,b:60}, 2, 260, 0.45);
          audio.playHit();
        }
      }
    }

    takeDamage(dmg, from, stage){
      if(this.invulnerable>0) return;
      this.hp -= dmg;
      this.invulnerable = 1.0;
      audio.playPlayerHurt();
      Game.shake(12);
      ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 14, {r:255,g:60,b:60}, 3, 320, 0.6);
      this.vx = from.x * 2;
      this.vy = -420;
      if(this.hp <= 0){
        this.die(stage);
      }
    }

    die(stage){
      Game.onPlayerDie();
    }

    draw(ctx, cam){
      // draw shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(Math.round(this.x - cam.x + 6), Math.round(this.y - cam.y + this.h - 6), 24, 6);

      // pixel-art cat: draw using small rectangles
      const px = Math.round(this.x - cam.x);
      const py = Math.round(this.y - cam.y);
      const scale = 1;
      // body
      const bodyColor = '#3a2b20';
      const accent = '#ffd37a';
      ctx.fillStyle = bodyColor;
      ctx.fillRect(px+4, py+8, 28, 22); // torso
      // head
      ctx.fillRect(px+6, py-6, 20, 18);
      // ears
      ctx.fillRect(px+6, py-10, 6, 6);
      ctx.fillRect(px+20, py-10, 6, 6);
      // tail
      ctx.fillRect(px+30, py+12, 6, 6);
      ctx.fillRect(px+34, py+14, 4, 4);
      // sword
      ctx.fillStyle = '#9fb8da';
      const swordX = this.facing>0 ? px+28 : px-12;
      ctx.fillRect(swordX, py+6, 6, 24);
      ctx.fillRect(swordX-2, py+4, 10, 4);
      // scarf
      ctx.fillStyle = '#b24d8b';
      ctx.fillRect(px+8, py+12, 12, 6);
      // eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(px+12, py-2, 4, 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(px+13, py-1, 2, 2);
      // simple cape
      ctx.fillStyle = '#122030';
      ctx.fillRect(px+8, py+18, 20, 12);
    }
  }

  // Enemy types
  class Enemy extends Entity{
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
      // simple AI: patrol or chase
      const dist = player.x - this.x;
      if(Math.abs(dist) < 220){
        this.dir = dist>0 ? 1 : -1;
      }
      this.vx = this.dir * this.speed;
      this.x += this.vx * dt;
      // ground collision
      for(const p of stage.platforms){
        if(this.x + this.w > p.x && this.x < p.x + p.w && this.y + this.h > p.y && this.y < p.y + p.h){
          if(this.y + this.h - this.vy*dt <= p.y + 6){
            this.y = p.y - this.h;
            this.vy = 0;
          } else {
            if(this.x < p.x) this.x = p.x - this.w;
            else this.x = p.x + p.w;
            this.dir *= -1;
          }
        }
      }
      // attack player if close
      this.attackCooldown = Math.max(0,this.attackCooldown - dt);
      if(this.attackCooldown<=0 && Math.abs(player.x - this.x) < this.attackRange && Math.abs(player.y - this.y) < 24){
        // damage
        player.takeDamage(this.damage, {x: this.dir * 2, y:-1}, stage);
        this.attackCooldown = 0.8;
      }
    }
    takeDamage(n, fromDir, knock){
      this.hp -= n;
      this.vx = fromDir * -200;
      this.vy = -180;
      if(this.hp <= 0) this.die();
      else{
        ParticleSystem.spawn(this.x + this.w/2, this.y + this.h/2, 6, {r:255,g:120,b:80}, 2, 140, 0.5);
      }
    }
    die(){
      this.dead = true;
      ParticleSystem.spawn(this.x + this.w/2, this.y + this.h/2, 18, {r:240,g:180,b:120}, 3, 300, 0.8);
      audio.playEnemyDie();
      Game.addScore(this.score);
    }
    draw(ctx, cam){
      if(this.dead) return;
      const px = Math.round(this.x - cam.x);
      const py = Math.round(this.y - cam.y);
      // pixel enemy body varies by type
      if(this.type==='normal'){
        ctx.fillStyle = '#7b3b3b';
        ctx.fillRect(px,py, this.w, this.h);
        ctx.fillStyle = '#ffd';
        ctx.fillRect(px+6, py+6, 4,4);
      } else if(this.type==='fast'){
        ctx.fillStyle = '#3b7b46';
        ctx.fillRect(px,py, this.w, this.h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px+4, py+6, 4,4);
      } else {
        ctx.fillStyle = '#4a3b7b';
        ctx.fillRect(px,py,this.w,this.h);
        ctx.fillStyle = '#ffd37a';
        ctx.fillRect(px+8,py+8,6,6);
      }
    }
  }

  // Boss class: NIGHT GUARDIAN
  class Boss extends Entity {
    constructor(x,y){
      super(x,y);
      this.w=220; this.h=220;
      this.maxHp = 120;
      this.hp = this.maxHp;
      this.phaseTimer = 0;
      this.state = 'idle';
      this.attackCooldown = 1.2;
      this.visible = false;
    }
    appear(){
      this.visible = true;
      audio.playBossAppear();
      Game.shake(18);
    }
    update(dt, player, stage){
      if(!this.visible || this.hp<=0) return;
      this.phaseTimer -= dt;
      this.attackCooldown -= dt;
      // simple behavior: choose pattern every few seconds
      if(this.attackCooldown <= 0){
        this.chooseAttack(player);
        this.attackCooldown = 1.8;
      }
      // move slowly to center X near player
      const targetX = stage.goalX - 400;
      this.x += (targetX - this.x) * dt * 0.4;
    }
    chooseAttack(player){
      const r = Math.random();
      if(r < 0.33) this.pounce(player);
      else if(r < 0.66) this.shockwave();
      else this.areaSlam();
    }
    pounce(player){
      // telegraph
      Game.shake(8);
      audio.playBossAttack();
      // short dash
      const dir = player.x > this.x ? 1 : -1;
      // perform delayed movement
      setTimeout(()=>{ this.x += dir * 360; ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 28, {r:200,g:80,b:80}, 4, 360, 0.9); }, 300);
    }
    shockwave(){
      // create a ground wave that damages if player on ground nearby
      Game.shake(10);
      audio.playBossAttack();
      // spawn particles
      ParticleSystem.spawn(this.x+this.w/2, this.y+this.h, 40, {r:255,g:180,b:90}, 3, 240, 0.9);
      // damage player if in mid-range
      if(Math.abs(Game.player.x - this.x) < 300 && Game.player.onGround){
        Game.player.takeDamage(2, {x: this.x > Game.player.x ? -1 : 1, y:0}, Game.stage);
      }
    }
    areaSlam(){
      Game.shake(14);
      audio.playBossAttack();
      // big slam after delay
      setTimeout(()=>{
        ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 60, {r:220,g:200,b:100}, 4, 360, 1.2);
        if(Math.abs(Game.player.x - this.x) < 200) Game.player.takeDamage(3, {x: this.x > Game.player.x ? -1 : 1, y:-1}, Game.stage);
      }, 360);
    }
    takeDamage(n){
      this.hp -= n;
      if(this.hp <= 0){
        this.die();
      } else {
        ParticleSystem.spawn(this.x+this.w/2, this.y+this.h/2, 10, {r:255,g:120,b:120}, 3, 240, 0.7);
      }
    }
    die(){
      Game.onBossDefeated();
    }
    draw(ctx, cam){
      if(!this.visible || this.hp<=0) return;
      const px = Math.round(this.x - cam.x);
      const py = Math.round(this.y - cam.y);
      // big cat monster stylized
      ctx.fillStyle = '#1f1b2b';
      ctx.fillRect(px,py,this.w,this.h);
      ctx.fillStyle = '#e0a8ff';
      // eyes
      ctx.fillRect(px+40,py+36, 18, 10);
      ctx.fillRect(px+this.w-58,py+36, 18, 10);
      // mouth area
      ctx.fillRect(px+60,py+120, this.w-120, 40);
      // claw
      ctx.fillStyle = '#ffcf7f';
      ctx.fillRect(px+20,py+this.h-18, 36, 8);
    }
  }

  // Stage definition: platforms, coins, enemies
  class StageClass {
    constructor(){
      this.width = 6000;
      this.height = 720;
      this.platforms = [];
      this.coins = [];
      this.enemies = [];
      this.goalX = 5400;
    }
    build(){
      this.platforms = [];
      this.coins = [];
      this.enemies = [];
      // ground
      this.platforms.push({x:-1000, y: 620, w: 8000, h: 160});
      // Some gaps and platforms
      // series of stepping platforms
      let x = 300;
      for(let i=0;i<8;i++){
        this.platforms.push({x: x, y: 520 - (i%3)*24, w: 140, h: 20});
        // coins above them
        this.coins.push({x: x+48, y: 480 - (i%3)*24, taken:false});
        x += 220 + (i%2)*40;
      }
      // enemy clusters
      this.enemies.push(new Enemy(800, 560, 'normal'));
      this.enemies.push(new Enemy(950, 560, 'fast'));
      this.enemies.push(new Enemy(1150, 560, 'normal'));
      // mid area with a drop
      this.platforms.push({x:1500, y:580, w:360, h:20});
      this.platforms.push({x:1900, y:500, w:180, h:20});
      this.coins.push({x:1960,y:460,taken:false});
      this.enemies.push(new Enemy(1550, 520, 'big'));
      // coin jump area
      this.platforms.push({x:2300,y:520,w:120,h:20});
      this.platforms.push({x:2450,y:460,w:120,h:20});
      this.coins.push({x:2478,y:420,taken:false});
      // approach boss
      this.platforms.push({x:3200,y:560,w:800,h:20});
      // scatter coins
      for(let i=0;i<12;i++){
        this.coins.push({x: 2600 + i*60, y: 520 - (i%4)*24, taken:false});
      }
      // final stretch, spawn some enemies
      for(let i=0;i<6;i++){
        this.enemies.push(new Enemy(3400 + i*220, 520, (i%3===0)?'fast':'normal'));
      }
      // boss location
      this.boss = new Boss(this.goalX, 300);
    }
  }

  // Game object handles main loop and state
  const Game = {
    state: STATE.TITLE,
    lastTime: 0,
    dtCap: 0.05,
    accumulator: 0,
    player: null,
    stage: null,
    camera: Camera,
    paused: false,
    shakeTime: 0,
    shakeIntensity: 0,
    hitStopTime: 0,
    highScore: Storage.load('highscore', 0),
    bestCombo: Storage.load('bestCombo', 0),

    init(){
      ParticleSystem.init(400);
      this.stage = new StageClass();
      this.stage.build();
      this.player = new Player(120, 520);
      this.player.score = 0;
      this.camera.x = 0;
      this.camera.y = 0;
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      // input: start btn
      startBtn.addEventListener('click', ()=>{ this.startFromTitle(); });
      // pause/resume
      pauseBtn.addEventListener('click', ()=> this.togglePause());
      resumeBtn.addEventListener('click', ()=> this.resume());
      retryBtn.addEventListener('click', ()=> this.restart());
      playAgainBtn.addEventListener('click', ()=> this.restart());
      // startpage ensures AudioContext unlocked
      startBtn.addEventListener('pointerdown', ()=>{ audio.ensure(); audio.unlockOnUserGesture(); });

      // quick testing: hide orientation overlay initially
      this.updateUI();
      requestAnimationFrame(this.loop.bind(this));
      // orientation handling
      window.addEventListener('orientationchange', ()=> this.onOrientationChange() );
      window.addEventListener('resize', ()=> this.checkOrientation() );
      this.checkOrientation();
    },

    checkOrientation(){
      // show orientation overlay when portrait on mobile
      if(window.innerHeight > window.innerWidth){
        orientOverlay.classList.remove('hidden');
      } else {
        orientOverlay.classList.add('hidden');
      }
    },

    onOrientationChange(){
      this.checkOrientation();
      setTimeout(resizeCanvas, 200);
    },

    startFromTitle(){
      // hide title
      titleScreen.classList.add('hidden');
      audio.unlockOnUserGesture();
      this.start();
    },

    start(){
      this.state = STATE.PLAYING;
      this.player = new Player(120,520);
      this.stage.build();
      this.stage.boss.hp = this.stage.boss.maxHp;
      this.stage.boss.visible = false;
      this.stage.enemies.forEach(e=>e.dead=false);
      this.lastTime = performance.now();
      this.updateUI();
      audio.playBeep(440,0.12,'sine',0.6);
    },

    restart(){
      this.state = STATE.PLAYING;
      gameReset();
    },

    togglePause(){
      if(this.state === STATE.PLAYING || this.state === STATE.BOSS){
        this.state = STATE.PAUSED;
        pauseScreen.classList.remove('hidden');
      } else if(this.state === STATE.PAUSED){
        this.resume();
      }
    },

    resume(){
      if(this.state === STATE.PAUSED) this.state = STATE.PLAYING;
      pauseScreen.classList.add('hidden');
    },

    loop(t){
      requestAnimationFrame(this.loop.bind(this));
      let dt = (t - this.lastTime) / 1000;
      this.lastTime = t;
      if(dt > this.dtCap) dt = this.dtCap;
      // hit stop
      if(this.hitStopTime > 0){
        this.hitStopTime -= dt;
        dt = 0;
      }
      this.update(dt);
      this.draw();
    },

    update(dt){
      // don't update game world when paused or title or end states
      if(this.state === STATE.TITLE) return;
      if(this.state === STATE.PAUSED) return;
      if(this.state === STATE.GAME_OVER) return;
      if(this.state === STATE.CLEAR) return;

      // audio context ensure unlocked after first input
      // update player
      this.player.update(dt, Input, this.stage);

      // camera follow
      this.camera.follow(this.player.x, this.player.y);

      // update enemies
      for(const e of this.stage.enemies){
        e.update(dt, this.player, this.stage);
      }
      // boss logic: trigger boss when player passes trigger X
      if(!this.stage.boss.visible && this.player.x > this.stage.goalX - 600){
        this.stage.boss.appear();
        this.state = STATE.BOSS;
        bossHud.classList.remove('hidden');
      }
      if(this.stage.boss.visible){
        this.stage.boss.update(dt, this.player, this.stage);
      }

      // coins pickup
      for(const coin of this.stage.coins){
        if(coin.taken) continue;
        if(this.player.x + this.player.w > coin.x && this.player.x < coin.x + 12 && this.player.y + this.player.h > coin.y && this.player.y < coin.y + 12){
          coin.taken = true;
          this.addScore(50);
          ParticleSystem.spawn(coin.x+6, coin.y+6, 12, {r:255,g:240,b:120}, 2, 180, 0.6);
          audio.playCoin();
        }
      }

      // particles
      ParticleSystem.update(dt);

      // UI updates
      this.updateUI();

      // check boss HUD
      if(this.stage.boss.visible){
        bossFill.style.width = Math.max(0, (this.stage.boss.hp / this.stage.boss.maxHp) * 100) + '%';
      }
    },

    draw(){
      // clear
      ctx.clearRect(0,0, canvas.width, canvas.height);
      // camera shake
      let camX = this.camera.x;
      let camY = this.camera.y;
      if(this.shakeTime > 0){
        const s = this.shakeIntensity;
        camX += (Math.random()*2-1) * s;
        camY += (Math.random()*2-1) * s;
        this.shakeTime = Math.max(0, this.shakeTime - 0.016);
      }
      // draw background parallax layers
      this.drawBackground(ctx, camX);

      // draw platforms
      ctx.fillStyle = '#2b2b2b';
      for(const p of this.stage.platforms){
        ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.w, p.h);
      }

      // draw coins
      for(const coin of this.stage.coins){
        if(coin.taken) continue;
        const cx = Math.round(coin.x - camX);
        const cy = Math.round(coin.y - camY);
        ctx.fillStyle = '#ffd24d';
        ctx.fillRect(cx, cy, 12, 12);
        // inner shine
        ctx.fillStyle = '#fff2b8';
        ctx.fillRect(cx+3, cy+3, 6, 6);
      }

      // draw enemies
      for(const e of this.stage.enemies) e.draw(ctx, {x:camX, y:camY});

      // draw boss if present
      if(this.stage.boss.visible) this.stage.boss.draw(ctx, {x:camX, y:camY});

      // draw player
      this.player.draw(ctx, {x:camX, y:camY});

      // draw particles
      ParticleSystem.draw(ctx, {x:camX, y:camY});

      // debug optionally
      // ctx.fillStyle = '#fff'; ctx.fillText(`x:${Math.round(this.player.x)}`,10,20);
    },

    drawBackground(ctx, camX){
      // parallax layers: far sky, buildings, streetlights
      const w = canvas.width / DPR;
      const h = canvas.height / DPR;
      // sky gradient
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0, '#071129');
      g.addColorStop(1, '#081224');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);

      // moon & stars fixed
      ctx.fillStyle = '#fff7d0';
      ctx.beginPath();
      ctx.arc(140 - camX*0.02 % w, 90, 28, 0, Math.PI*2);
      ctx.fill();

      // stars
      for(let i=0;i<30;i++){
        const sx = (i*77 + (camX*0.01)) % (w+200);
        const sy = 40 + (i*13)%120;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect((sx+w)%w, sy, 2,2);
      }

      // far buildings (parallax slow)
      ctx.fillStyle = '#0f1a2a';
      for(let i=0;i<8;i++){
        const bx = Math.round((i*420 - camX*0.15) % (w+420));
        ctx.fillRect(bx - 40, h-280, 120, 200);
      }

      // midground fog
      ctx.fillStyle = 'rgba(120,150,220,0.03)';
      ctx.fillRect(0, h-260, w, 200);

      // street lamps (near)
      for(let i=0;i<12;i++){
        const sx = Math.round((i*320 - camX*0.6));
        const sy = h-260;
        ctx.fillStyle = '#2e2e3b';
        ctx.fillRect(sx+8, sy+20, 8, 120);
        ctx.fillStyle = 'rgba(255,200,120,0.12)';
        ctx.fillRect(sx, sy+10, 24, 40);
      }
    },

    addScore(n){
      this.player.score += n;
      if(this.player.score > this.highScore){
        this.highScore = this.player.score;
        Storage.save('highscore', this.highScore);
      }
      // best combo save
      if(this.player.combo > this.bestCombo){
        this.bestCombo = this.player.combo;
        Storage.save('bestCombo', this.bestCombo);
      }
    },

    updateUI(){
      scoreText.textContent = String(this.player.score).padStart(6,'0');
      comboText.textContent = 'x' + String(this.player.combo);
      areaText.textContent = '1';
      hpFill.style.width = Math.round((this.player.hp / this.player.maxHp) * 100) + '%';
    },

    shake(intensity = 6, time = 0.25){
      this.shakeIntensity = intensity;
      this.shakeTime = time;
    },

    hitStop(ms){
      this.hitStopTime = ms/1000;
    },

    onPlayerDie(){
      this.state = STATE.GAME_OVER;
      gameOverScreen.classList.remove('hidden');
      finalScore.textContent = 'SCORE ' + String(this.player.score).padStart(6,'0');
    },

    onBossDefeated(){
      this.state = STATE.CLEAR;
      clearScreen.classList.remove('hidden');
      clearScore.textContent = 'SCORE ' + String(this.player.score).padStart(6,'0');
      audio.playBeep(880,0.6,'sine',0.9);
    }
  };

  function gameReset(){
    Game.player = new Player(120,520);
    Game.stage.build();
    Game.state = STATE.PLAYING;
    gameOverScreen.classList.add('hidden');
    clearScreen.classList.add('hidden');
    bossHud.classList.add('hidden');
  }

  // Hook UI control behaviour for Start/Retry etc already set up in init()

  // Start
  Game.init();

  // Small safety: ensure inputs cleared on visibilitychange
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ Input.resetAll(); }
  });

  // Prevent context menu long press
  window.addEventListener('contextmenu', e=>e.preventDefault());

  // For keyboard pause
  window.Game = Game;

})();
