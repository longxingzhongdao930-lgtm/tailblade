"use strict";

/* =========================================================
   TAILBLADE
   Pixel Action Game
   No libraries / GitHub Pages compatible
========================================================= */

(() => {

  /* =======================================================
     CANVAS
  ======================================================= */

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d", {
    alpha: false
  });

  ctx.imageSmoothingEnabled = false;


  /* =======================================================
     UI
  ======================================================= */

  const startScreen =
    document.getElementById("start-screen");

  const gameUI =
    document.getElementById("game-ui");

  const gameOverScreen =
    document.getElementById("game-over-screen");

  const touchControls =
    document.getElementById("touch-controls");

  const startButton =
    document.getElementById("start-button");

  const restartButton =
    document.getElementById("restart-button");

  const titleButton =
    document.getElementById("title-button");

  const scoreElement =
    document.getElementById("score");

  const hpFill =
    document.getElementById("hp-fill");

  const hpText =
    document.getElementById("hp-text");

  const finalScoreElement =
    document.getElementById("final-score");

  const bestScoreElement =
    document.getElementById("start-best-score");

  const newRecordElement =
    document.getElementById("new-record");

  const comboElement =
    document.getElementById("combo");

  const comboNumberElement =
    document.getElementById("combo-number");


  /* =======================================================
     CONSTANTS
  ======================================================= */

  const W = 960;
  const H = 540;

  const GROUND_Y = 405;

  const WORLD_WIDTH = 8000;

  const PLAYER_W = 42;
  const PLAYER_H = 64;

  const GRAVITY = 1450;

  const RUN_SPEED = 285;
  const JUMP_SPEED = 620;

  const ATTACK_DURATION = 0.32;

  const INVINCIBLE_TIME = 0.8;

  const MAX_HP = 100;


  /* =======================================================
     COLORS
  ======================================================= */

  const COLORS = {
    skyTop: "#0b0812",
    skyBottom: "#1c1025",

    moon: "#f4e9c8",

    groundFar: "#1b1322",
    ground: "#120d18",

    purple: "#593b70",
    purple2: "#7c4d9e",

    gold: "#f0a63c",
    goldLight: "#f8e0b0",

    cat: "#e8b96a",
    catDark: "#bd8840",
    catLight: "#f8e0b0",

    cloth: "#3f6fb5",
    clothDark: "#2a4a7e",

    enemy: "#8c4968",
    enemyDark: "#4d253b",

    white: "#f4e9c8",

    cyan: "#4fd6c0",

    danger: "#e05a5a"
  };


  /* =======================================================
     GAME STATE
  ======================================================= */

  let state = "title";

  let lastTime = 0;

  let elapsed = 0;

  let cameraX = 0;

  let score = 0;

  let bestScore =
    Number(localStorage.getItem(
      "tailblade_best_score"
    )) || 0;

  let combo = 0;

  let comboTimer = 0;

  let shake = 0;

  let flash = 0;

  let spawnTimer = 0;

  let distance = 0;

  let particles = [];

  let enemies = [];

  let stars = [];

  let platforms = [];


  /* =======================================================
     INPUT
  ======================================================= */

  const keys = new Set();

  const input = {
    left: false,
    right: false,
    jump: false,
    attack: false,

    jumpPressed: false,
    attackPressed: false
  };


  /* =======================================================
     PLAYER
  ======================================================= */

  const player = {
    x: 180,
    y: GROUND_Y - PLAYER_H,

    vx: 0,
    vy: 0,

    w: PLAYER_W,
    h: PLAYER_H,

    hp: MAX_HP,

    grounded: true,

    facing: 1,

    attackTimer: 0,

    attackCooldown: 0,

    invincible: 0,

    hurtTimer: 0,

    anim: 0,

    dead: false
  };


  /* =======================================================
     INITIALIZE STARS
  ======================================================= */

  for (let i = 0; i < 120; i++) {

    stars.push({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * 250,

      size:
        Math.random() < 0.75
          ? 1
          : 2,

      alpha:
        0.25 +
        Math.random() * 0.65,

      twinkle:
        Math.random() * Math.PI * 2
    });

  }


  /* =======================================================
     INPUT KEYBOARD
  ======================================================= */

  window.addEventListener(
    "keydown",
    (event) => {

      const key =
        event.key.toLowerCase();

      if (
        key === "arrowleft" ||
        key === "a"
      ) {
        input.left = true;
        event.preventDefault();
      }

      if (
        key === "arrowright" ||
        key === "d"
      ) {
        input.right = true;
        event.preventDefault();
      }

      if (
        key === "arrowup" ||
        key === "w" ||
        key === " "
      ) {

        if (!input.jump) {
          input.jumpPressed = true;
        }

        input.jump = true;

        event.preventDefault();
      }

      if (
        key === "z" ||
        key === "x" ||
        key === "j"
      ) {

        if (!input.attack) {
          input.attackPressed = true;
        }

        input.attack = true;

        event.preventDefault();
      }

    },
    { passive: false }
  );


  window.addEventListener(
    "keyup",
    (event) => {

      const key =
        event.key.toLowerCase();

      if (
        key === "arrowleft" ||
        key === "a"
      ) {
        input.left = false;
      }

      if (
        key === "arrowright" ||
        key === "d"
      ) {
        input.right = false;
      }

      if (
        key === "arrowup" ||
        key === "w" ||
        key === " "
      ) {
        input.jump = false;
      }

      if (
        key === "z" ||
        key === "x" ||
        key === "j"
      ) {
        input.attack = false;
      }

    }
  );


  /* =======================================================
     TOUCH
  ======================================================= */

  function bindTouchButton(
    id,
    downFunction,
    upFunction
  ) {

    const button =
      document.getElementById(id);

    if (!button) return;

    const down = (event) => {

      event.preventDefault();

      button.classList.add("pressed");

      downFunction();

    };

    const up = (event) => {

      event.preventDefault();

      button.classList.remove("pressed");

      upFunction();

    };

    button.addEventListener(
      "pointerdown",
      down,
      { passive: false }
    );

    button.addEventListener(
      "pointerup",
      up,
      { passive: false }
    );

    button.addEventListener(
      "pointercancel",
      up,
      { passive: false }
    );

    button.addEventListener(
      "pointerleave",
      up,
      { passive: false }
    );

  }


  bindTouchButton(
    "left-button",
    () => {
      input.left = true;
    },
    () => {
      input.left = false;
    }
  );


  bindTouchButton(
    "right-button",
    () => {
      input.right = true;
    },
    () => {
      input.right = false;
    }
  );


  bindTouchButton(
    "jump-button",
    () => {

      if (!input.jump) {
        input.jumpPressed = true;
      }

      input.jump = true;

    },
    () => {
      input.jump = false;
    }
  );


  bindTouchButton(
    "attack-button",
    () => {

      if (!input.attack) {
        input.attackPressed = true;
      }

      input.attack = true;

    },
    () => {
      input.attack = false;
    }
  );


  /* =======================================================
     START / RESTART
  ======================================================= */

  startButton.addEventListener(
    "click",
    startGame
  );

  restartButton.addEventListener(
    "click",
    startGame
  );

  titleButton.addEventListener(
    "click",
    showTitle
  );


  function startGame() {

    state = "playing";

    elapsed = 0;

    cameraX = 0;

    score = 0;

    combo = 0;

    comboTimer = 0;

    distance = 0;

    spawnTimer = 0.7;

    shake = 0;

    flash = 0;

    particles = [];

    enemies = [];

    resetPlayer();

    startScreen.hidden = true;

    gameOverScreen.hidden = true;

    gameUI.hidden = false;

    touchControls.hidden = false;

    updateUI();

  }


  function showTitle() {

    state = "title";

    startScreen.hidden = false;

    gameOverScreen.hidden = true;

    gameUI.hidden = true;

    touchControls.hidden = true;

    bestScoreElement.textContent =
      String(bestScore);

    clearInput();

  }


  function resetPlayer() {

    player.x = 180;

    player.y =
      GROUND_Y - PLAYER_H;

    player.vx = 0;

    player.vy = 0;

    player.hp = MAX_HP;

    player.grounded = true;

    player.facing = 1;

    player.attackTimer = 0;

    player.attackCooldown = 0;

    player.invincible = 0;

    player.hurtTimer = 0;

    player.anim = 0;

    player.dead = false;

  }


  /* =======================================================
     INPUT RESET
  ======================================================= */

  function clearInput() {

    input.left = false;
    input.right = false;

    input.jump = false;
    input.attack = false;

    input.jumpPressed = false;
    input.attackPressed = false;

    keys.clear();

  }


  /* =======================================================
     UPDATE
  ======================================================= */

  function update(dt) {

    elapsed += dt;

    if (state !== "playing") {
      return;
    }

    updatePlayer(dt);

    updateEnemies(dt);

    updateParticles(dt);

    updateCamera(dt);

    updateSpawning(dt);

    updateCombo(dt);

    updateEffects(dt);

    checkWorldBounds();

    updateUI();

    input.jumpPressed = false;
    input.attackPressed = false;

  }


  /* =======================================================
     PLAYER
  ======================================================= */

  function updatePlayer(dt) {

    player.anim += dt * 12;

    if (player.attackCooldown > 0) {
      player.attackCooldown -= dt;
    }

    if (player.attackTimer > 0) {
      player.attackTimer -= dt;
    }

    if (player.invincible > 0) {
      player.invincible -= dt;
    }

    if (player.hurtTimer > 0) {
      player.hurtTimer -= dt;
    }


    let direction = 0;

    if (input.left) {
      direction -= 1;
    }

    if (input.right) {
      direction += 1;
    }


    if (direction !== 0) {

      player.vx +=
        direction *
        1600 *
        dt;

      player.facing = direction;

    } else {

      const friction = 1900 * dt;

      if (player.vx > 0) {
        player.vx =
          Math.max(
            0,
            player.vx - friction
          );
      }

      if (player.vx < 0) {
        player.vx =
          Math.min(
            0,
            player.vx + friction
          );
      }

    }


    player.vx = clamp(
      player.vx,
      -RUN_SPEED,
      RUN_SPEED
    );


    /* JUMP */

    if (
      input.jumpPressed &&
      player.grounded
    ) {

      player.vy =
        -JUMP_SPEED;

      player.grounded = false;

      spawnJumpParticles();

    }


    /* ATTACK */

    if (
      input.attackPressed &&
      player.attackCooldown <= 0 &&
      player.hurtTimer <= 0
    ) {

      player.attackTimer =
        ATTACK_DURATION;

      player.attackCooldown =
        ATTACK_DURATION + 0.1;

      performAttack();

    }


    /* GRAVITY */

    player.vy +=
      GRAVITY * dt;


    player.x +=
      player.vx * dt;

    player.y +=
      player.vy * dt;


    /* GROUND */

    if (
      player.y + player.h >=
      GROUND_Y
    ) {

      player.y =
        GROUND_Y - player.h;

      player.vy = 0;

      if (!player.grounded) {
        spawnLandingParticles();
      }

      player.grounded = true;

    } else {

      player.grounded = false;

    }

  }


  /* =======================================================
     ATTACK
  ======================================================= */

  function performAttack() {

    shake = 0.05;

    const range = 78;

    const attackX =
      player.facing === 1
        ? player.x + player.w
        : player.x - range;

    const attackY =
      player.y + 14;

    const attackBox = {
      x: attackX,
      y: attackY,
      w: range,
      h: 40
    };


    let hitSomething = false;


    for (
      let i = enemies.length - 1;
      i >= 0;
      i--
    ) {

      const enemy =
        enemies[i];

      if (
        rectsOverlap(
          attackBox,
          enemy
        )
      ) {

        hitSomething = true;

        enemy.hp -= 18;

        enemy.hitTimer = 0.16;

        enemy.vx +=
          player.facing * 250;

        spawnHitParticles(
          enemy.x + enemy.w / 2,
          enemy.y + enemy.h / 2
        );

        score += 25;

        combo += 1;

        comboTimer = 1.25;


        if (enemy.hp <= 0) {

          score += 100;

          spawnDeathParticles(
            enemy.x + enemy.w / 2,
            enemy.y + enemy.h / 2
          );

          enemies.splice(i, 1);

        }

      }

    }


    if (hitSomething) {
      shake = 0.09;
      flash = 0.045;
    } else {

      spawnAttackTrail();

    }

  }


  /* =======================================================
     ENEMIES
  ======================================================= */

  function updateEnemies(dt) {

    for (
      let i = enemies.length - 1;
      i >= 0;
      i--
    ) {

      const enemy =
        enemies[i];

      enemy.anim += dt * 8;

      if (enemy.hitTimer > 0) {
        enemy.hitTimer -= dt;
      }


      const dx =
        player.x - enemy.x;


      /* MOVE TOWARD PLAYER */

      if (Math.abs(dx) < 350) {

        const direction =
          dx > 0 ? 1 : -1;

        enemy.vx +=
          direction *
          enemy.speed *
          2 *
          dt;

        enemy.facing =
          direction;

      }


      enemy.vx *=
        Math.pow(0.001, dt);


      enemy.vx = clamp(
        enemy.vx,
        -enemy.speed,
        enemy.speed
      );


      enemy.x +=
        enemy.vx * dt;


      /* ATTACK */

      enemy.attackCooldown -= dt;

      if (
        enemy.attackCooldown <= 0 &&
        distanceBetween(
          player.x,
          player.y,
          enemy.x,
          enemy.y
        ) < 65
      ) {

        damagePlayer(
          enemy.damage
        );

        enemy.attackCooldown =
          1.1 +
          Math.random() * 0.4;

      }


      /* REMOVE BEHIND */

      if (
        enemy.x <
        cameraX - 250
      ) {

        enemies.splice(i, 1);

      }

    }

  }


  /* =======================================================
     DAMAGE PLAYER
  ======================================================= */

  function damagePlayer(amount) {

    if (
      player.invincible > 0 ||
      player.dead
    ) {
      return;
    }


    player.hp -= amount;

    player.invincible =
      INVINCIBLE_TIME;

    player.hurtTimer =
      0.2;

    player.vx =
      -player.facing * 260;

    player.vy =
      -180;

    shake = 0.18;

    flash = 0.12;

    combo = 0;

    comboTimer = 0;

    spawnDamageParticles();


    if (player.hp <= 0) {

      player.hp = 0;

      gameOver();

    }

  }


  /* =======================================================
     SPAWN
  ======================================================= */

  function updateSpawning(dt) {

    spawnTimer -= dt;

    if (spawnTimer <= 0) {

      spawnEnemy();

      const difficulty =
        Math.min(
          1.8,
          distance / 4000
        );

      spawnTimer =
        1.25 -
        difficulty * 0.45 +
        Math.random() * 0.45;

    }

  }


  function spawnEnemy() {

    const side =
      Math.random() < 0.72
        ? 1
        : -1;


    let x;

    if (side === 1) {

      x =
        cameraX +
        W +
        100 +
        Math.random() * 300;

    } else {

      x =
        cameraX -
        150 -
        Math.random() * 200;

    }


    const type =
      Math.random();


    enemies.push({

      x,

      y:
        GROUND_Y - 52,

      w: 40,

      h: 52,

      vx: 0,

      hp:
        type > 0.8
          ? 48
          : 34,

      damage:
        type > 0.8
          ? 18
          : 12,

      speed:
        type > 0.8
          ? 95
          : 72,

      facing:
        -side,

      attackCooldown:
        0.8 +
        Math.random() * 0.6,

      hitTimer: 0,

      anim:
        Math.random() * 10

    });

  }


  /* =======================================================
     CAMERA
  ======================================================= */

  function updateCamera(dt) {

    const target =
      Math.max(
        0,
        player.x - W * 0.36
      );


    cameraX +=
      (target - cameraX) *
      (1 -
        Math.exp(-7 * dt));


    cameraX =
      clamp(
        cameraX,
        0,
        WORLD_WIDTH - W
      );


    distance =
      Math.max(
        0,
        player.x - 180
      );


    score =
      Math.max(
        score,
        Math.floor(distance / 5)
      );

  }


  /* =======================================================
     WORLD BOUNDS
  ======================================================= */

  function checkWorldBounds() {

    if (
      player.x <
      cameraX - 100
    ) {
      player.x =
        cameraX - 100;
    }


    if (
      player.x >
      cameraX + W - 70
    ) {
      player.x =
        cameraX + W - 70;
    }


    if (
      player.x >
      WORLD_WIDTH - 160
    ) {

      player.x =
        WORLD_WIDTH - 160;

    }

  }


  /* =======================================================
     COMBO
  ======================================================= */

  function updateCombo(dt) {

    if (comboTimer > 0) {

      comboTimer -= dt;

      if (comboTimer <= 0) {
        combo = 0;
      }

    }

  }


  /* =======================================================
     EFFECTS
  ======================================================= */

  function updateEffects(dt) {

    shake =
      Math.max(
        0,
        shake - dt
      );

    flash =
      Math.max(
        0,
        flash - dt
      );

  }


  /* =======================================================
     PARTICLES
  ======================================================= */

  function addParticle(
    x,
    y,
    options = {}
  ) {

    particles.push({

      x,
      y,

      vx:
        options.vx ??
        (Math.random() - 0.5) * 120,

      vy:
        options.vy ??
        (Math.random() - 0.5) * 120,

      life:
        options.life ??
        0.5,

      maxLife:
        options.life ??
        0.5,

      size:
        options.size ??
        4,

      color:
        options.color ??
        COLORS.gold,

      gravity:
        options.gravity ??
        250

    });

  }


  function spawnHitParticles(x, y) {

    for (let i = 0; i < 12; i++) {

      addParticle(
        x,
        y,
        {
          vx:
            (Math.random() - 0.5) *
            300,

          vy:
            (Math.random() - 0.5) *
            300,

          life:
            0.25 +
            Math.random() * 0.2,

          size:
            3 +
            Math.random() * 4,

          color:
            i % 2
              ? COLORS.gold
              : COLORS.white,

          gravity: 150

        }
      );

    }

  }


  function spawnDeathParticles(x, y) {

    for (let i = 0; i < 22; i++) {

      addParticle(
        x,
        y,
        {
          vx:
            (Math.random() - 0.5) *
            400,

          vy:
            (Math.random() - 0.7) *
            400,

          life:
            0.35 +
            Math.random() * 0.5,

          size:
            3 +
            Math.random() * 5,

          color:
            i % 2
              ? COLORS.purple2
              : COLORS.gold,

          gravity: 300

        }
      );

    }

  }


  function spawnJumpParticles() {

    for (let i = 0; i < 8; i++) {

      addParticle(
        player.x +
          player.w / 2,
        GROUND_Y - 4,
        {
          vx:
            (Math.random() - 0.5) *
            130,

          vy:
            -Math.random() * 100,

          life:
            0.25 +
            Math.random() * 0.2,

          size:
            3,

          color:
            COLORS.gold,

          gravity: 220

        }
      );

    }

  }


  function spawnLandingParticles() {

    for (let i = 0; i < 7; i++) {

      addParticle(
        player.x +
          player.w / 2,
        GROUND_Y,
        {
          vx:
            (Math.random() - 0.5) *
            150,

          vy:
            -Math.random() * 80,

          life:
            0.25,

          size:
            3,

          color:
            COLORS.purple2,

          gravity: 300

        }
      );

    }

  }


  function spawnDamageParticles() {

    for (let i = 0; i < 14; i++) {

      addParticle(
        player.x +
          player.w / 2,
        player.y +
          player.h / 2,
        {
          vx:
            (Math.random() - 0.5) *
            280,

          vy:
            (Math.random() - 0.6) *
            280,

          life:
            0.35,

          size:
            4,

          color:
            COLORS.danger,

          gravity: 260

        }
      );

    }

  }


  function spawnAttackTrail() {

    for (let i = 0; i < 5; i++) {

      const offset =
        player.facing *
        (25 + i * 10);

      addParticle(
        player.x +
          player.w / 2 +
          offset,
        player.y +
          24 +
          Math.random() * 16,
        {
          vx:
            player.facing *
            (40 + i * 20),

          vy:
            (Math.random() - 0.5) *
            50,

          life:
            0.15 +
            i * 0.02,

          size:
            3,

          color:
            COLORS.gold,

          gravity: 0

        }
      );

    }

  }


  function updateParticles(dt) {

    for (
      let i = particles.length - 1;
      i >= 0;
      i--
    ) {

      const p =
        particles[i];

      p.life -= dt;

      if (p.life <= 0) {

        particles.splice(i, 1);

        continue;

      }


      p.vy +=
        p.gravity * dt;

      p.x +=
        p.vx * dt;

      p.y +=
        p.vy * dt;

    }

  }


  /* =======================================================
     DRAW
  ======================================================= */

  function draw() {

    ctx.save();

    ctx.clearRect(
      0,
      0,
      W,
      H
    );


    /* CAMERA SHAKE */

    if (shake > 0) {

      const power =
        shake * 35;

      ctx.translate(
        (Math.random() - 0.5) * power,
        (Math.random() - 0.5) * power
      );

    }


    drawBackground();

    drawGround();

    drawWorldDetails();

    drawEnemies();

    drawPlayer();

    drawParticles();

    ctx.restore();


    if (flash > 0) {

      ctx.fillStyle =
        `rgba(255,235,210,${flash * 2})`;

      ctx.fillRect(
        0,
        0,
        W,
        H
      );

    }

  }


  /* =======================================================
     BACKGROUND
  ======================================================= */

  function drawBackground() {

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        H
      );

    gradient.addColorStop(
      0,
      COLORS.skyTop
    );

    gradient.addColorStop(
      1,
      COLORS.skyBottom
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      W,
      H
    );


    /* MOON */

    ctx.fillStyle =
      COLORS.moon;

    ctx.globalAlpha = 0.92;

    ctx.beginPath();

    ctx.arc(
      760,
      105,
      45,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha = 1;


    /* STARS */

    for (const star of stars) {

      const x =
        star.x -
        cameraX *
        0.25;

      if (
        x < -10 ||
        x > W + 10
      ) {
        continue;
      }

      const twinkle =
        Math.sin(
          elapsed * 1.5 +
          star.twinkle
        ) *
        0.25 +
        0.75;

      ctx.globalAlpha =
        star.alpha *
        twinkle;

      ctx.fillStyle =
        COLORS.white;

      ctx.fillRect(
        Math.floor(x),
        Math.floor(star.y),
        star.size,
        star.size
      );

    }

    ctx.globalAlpha = 1;


    /* FAR MOUNTAINS */

    drawMountains(
      0.12,
      330,
      COLORS.groundFar
    );

    drawMountains(
      0.2,
      365,
      "#25172e"
    );

  }


  function drawMountains(
    parallax,
    baseY,
    color
  ) {

    ctx.fillStyle = color;

    ctx.beginPath();

    ctx.moveTo(
      0,
      H
    );

    for (
      let x = -100;
      x <= W + 100;
      x += 80
    ) {

      const worldX =
        x +
        cameraX *
        parallax;

      const height =
        40 +
        Math.sin(
          worldX * 0.009
        ) *
        25 +
        Math.sin(
          worldX * 0.023
        ) *
        18;

      ctx.lineTo(
        x,
        baseY - height
      );

    }

    ctx.lineTo(
      W,
      H
    );

    ctx.closePath();

    ctx.fill();

  }


  /* =======================================================
     GROUND
  ======================================================= */

  function drawGround() {

    ctx.fillStyle =
      COLORS.ground;

    ctx.fillRect(
      0,
      GROUND_Y,
      W,
      H - GROUND_Y
    );


    /* GROUND TOP */

    ctx.fillStyle =
      COLORS.purple2;

    ctx.fillRect(
      0,
      GROUND_Y,
      W,
      3
    );


    /* GRID */

    ctx.globalAlpha = 0.16;

    ctx.strokeStyle =
      COLORS.purple;

    ctx.lineWidth = 1;

    for (
      let x =
        -(
          cameraX %
          60
        );
      x < W;
      x += 60
    ) {

      ctx.beginPath();

      ctx.moveTo(
        x,
        GROUND_Y
      );

      ctx.lineTo(
        x - 40,
        H
      );

      ctx.stroke();

    }


    for (
      let y =
        GROUND_Y + 25;
      y < H;
      y += 28
    ) {

      ctx.beginPath();

      ctx.moveTo(
        0,
        y
      );

      ctx.lineTo(
        W,
        y
      );

      ctx.stroke();

    }

    ctx.globalAlpha = 1;

  }


  /* =======================================================
     WORLD DETAILS
  ======================================================= */

  function drawWorldDetails() {

    const start =
      Math.floor(
        cameraX / 180
      ) * 180;


    for (
      let worldX = start - 200;
      worldX <
        cameraX + W + 300;
      worldX += 180
    ) {

      const x =
        worldX -
        cameraX;


      /* TORCH */

      if (
        Math.floor(
          worldX / 180
        ) %
        3 ===
        0
      ) {

        drawTorch(
          x,
          GROUND_Y - 5
        );

      }


      /* RUIN */

      if (
        Math.floor(
          worldX / 180
        ) %
        5 ===
        1
      ) {

        drawRuin(
          x + 70,
          GROUND_Y
        );

      }

    }

  }


  function drawTorch(x, y) {

    ctx.fillStyle =
      "#3a263f";

    ctx.fillRect(
      x - 3,
      y - 55,
      6,
      55
    );

    const glow =
      15 +
      Math.sin(
        elapsed * 8 +
        x
      ) *
      3;

    const gradient =
      ctx.createRadialGradient(
        x,
        y - 62,
        2,
        x,
        y - 62,
        glow
      );

    gradient.addColorStop(
      0,
      "rgba(240,166,60,.6)"
    );

    gradient.addColorStop(
      1,
      "rgba(240,166,60,0)"
    );

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(
      x,
      y - 62,
      glow,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      COLORS.gold;

    ctx.fillRect(
      x - 4,
      y - 68,
      8,
      12
    );

  }


  function drawRuin(x, y) {

    ctx.fillStyle =
      "#21152b";

    ctx.fillRect(
      x,
      y - 85,
      34,
      85
    );

    ctx.fillRect(
      x + 40,
      y - 110,
      32,
      110
    );

    ctx.fillRect(
      x + 80,
      y - 70,
      30,
      70
    );

    ctx.fillStyle =
      "#08060d";

    ctx.fillRect(
      x + 8,
      y - 60,
      12,
      25
    );

    ctx.fillRect(
      x + 49,
      y - 82,
      11,
      27
    );

  }


  /* =======================================================
     PLAYER DRAW
  ======================================================= */

  function drawPlayer() {

    if (
      player.invincible > 0 &&
      Math.floor(
        player.invincible * 18
      ) %
        2 ===
        0
    ) {
      return;
    }


    const x =
      Math.floor(
        player.x -
        cameraX
      );

    const y =
      Math.floor(
        player.y
      );


    ctx.save();

    ctx.translate(
      x + player.w / 2,
      y
    );

    ctx.scale(
      player.facing,
      1
    );


    const run =
      player.grounded
        ? Math.sin(
            player.anim
          ) *
          Math.min(
            5,
            Math.abs(
              player.vx
            ) / 50
          )
        : 0;


    /* TAIL */

    ctx.strokeStyle =
      COLORS.cat;

    ctx.lineWidth = 7;

    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(
      8,
      43
    );

    ctx.quadraticCurveTo(
      35,
      52,
      27,
      30
    );

    ctx.stroke();


    /* LEGS */

    ctx.fillStyle =
      COLORS.catDark;

    ctx.fillRect(
      -14,
      47 + run,
      9,
      17
    );

    ctx.fillRect(
      5,
      47 - run,
      9,
      17
    );


    /* BODY */

    ctx.fillStyle =
      COLORS.cat;

    ctx.fillRect(
      -17,
      20,
      34,
      35
    );


    /* CLOTH */

    ctx.fillStyle =
      COLORS.cloth;

    ctx.fillRect(
      -17,
      35,
      34,
      20
    );

    ctx.fillStyle =
      COLORS.clothDark;

    ctx.fillRect(
      -17,
      48,
      34,
      7
    );


    /* HEAD */

    ctx.fillStyle =
      COLORS.cat;

    ctx.beginPath();

    ctx.moveTo(
      -19,
      22
    );

    ctx.lineTo(
      -17,
      2
    );

    ctx.lineTo(
      -7,
      9
    );

    ctx.lineTo(
      8,
      7
    );

    ctx.lineTo(
      18,
      1
    );

    ctx.lineTo(
      20,
      23
    );

    ctx.closePath();

    ctx.fill();


    /* EAR INNER */

    ctx.fillStyle =
      "#e5788a";

    ctx.beginPath();

    ctx.moveTo(
      -14,
      6
    );

    ctx.lineTo(
      -9,
      12
    );

    ctx.lineTo(
      -15,
      17
    );

    ctx.closePath();

    ctx.fill();


    /* EYE */

    ctx.fillStyle =
      COLORS.cyan;

    ctx.fillRect(
      6,
      13,
      5,
      5
    );


    /* FACE */

    ctx.fillStyle =
      "#5d3827";

    ctx.fillRect(
      14,
      20,
      3,
      3
    );


    /* SCARF */

    ctx.fillStyle =
      COLORS.gold;

    ctx.fillRect(
      -18,
      28,
      38,
      5
    );

    ctx.fillRect(
      10,
      30,
      10,
      17
    );


    /* SWORD */

    if (
      player.attackTimer > 0
    ) {

      const progress =
        1 -
        player.attackTimer /
        ATTACK_DURATION;

      const angle =
        -0.9 +
        progress *
        2.0;

      ctx.save();

      ctx.translate(
        16,
        30
      );

      ctx.rotate(
        angle
      );

      ctx.fillStyle =
        COLORS.goldLight;

      ctx.fillRect(
        0,
        -3,
        62,
        6
      );

      ctx.fillStyle =
        COLORS.gold;

      ctx.fillRect(
        10,
        -5,
        8,
        10
      );

      ctx.restore();

    } else {

      ctx.fillStyle =
        COLORS.goldLight;

      ctx.fillRect(
        16,
        30,
        7,
        32
      );

      ctx.fillStyle =
        COLORS.gold;

      ctx.fillRect(
        11,
        29,
        17,
        5
      );

    }


    ctx.restore();


    /* SHADOW */

    ctx.globalAlpha = 0.35;

    ctx.fillStyle =
      "#000";

    ctx.beginPath();

    ctx.ellipse(
      x + player.w / 2,
      GROUND_Y + 2,
      28,
      7,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha = 1;

  }


  /* =======================================================
     ENEMY DRAW
  ======================================================= */

  function drawEnemies() {

    for (const enemy of enemies) {

      const x =
        Math.floor(
          enemy.x -
          cameraX
        );

      const y =
        Math.floor(
          enemy.y
        );


      if (
        x < -100 ||
        x > W + 100
      ) {
        continue;
      }


      ctx.save();

      ctx.translate(
        x + enemy.w / 2,
        y
      );

      ctx.scale(
        enemy.facing,
        1
      );


      /* SHADOW */

      ctx.globalAlpha = 0.3;

      ctx.fillStyle = "#000";

      ctx.beginPath();

      ctx.ellipse(
        0,
        enemy.h + 2,
        24,
        6,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.globalAlpha = 1;


      /* BODY */

      ctx.fillStyle =
        enemy.hitTimer > 0
          ? COLORS.white
          : COLORS.enemy;

      ctx.fillRect(
        -17,
        20,
        34,
        30
      );


      /* HEAD */

      ctx.fillStyle =
        enemy.hitTimer > 0
          ? COLORS.white
          : COLORS.enemy;

      ctx.beginPath();

      ctx.moveTo(
        -19,
        24
      );

      ctx.lineTo(
        -15,
        2
      );

      ctx.lineTo(
        -5,
        9
      );

      ctx.lineTo(
        8,
        7
      );

      ctx.lineTo(
        18,
        2
      );

      ctx.lineTo(
        20,
        24
      );

      ctx.closePath();

      ctx.fill();


      /* CLOAK */

      ctx.fillStyle =
        COLORS.enemyDark;

      ctx.fillRect(
        -18,
        37,
        36,
        16
      );


      /* EYE */

      ctx.fillStyle =
        COLORS.gold;

      ctx.fillRect(
        7,
        14,
        5,
        5
      );


      /* WEAPON */

      ctx.fillStyle =
        COLORS.goldLight;

      ctx.fillRect(
        17,
        31,
        30,
        4
      );


      ctx.restore();

    }

  }


  /* =======================================================
     PARTICLES DRAW
  ======================================================= */

  function drawParticles() {

    for (const p of particles) {

      const alpha =
        p.life /
        p.maxLife;

      ctx.globalAlpha =
        alpha;

      ctx.fillStyle =
        p.color;

      ctx.fillRect(
        Math.floor(
          p.x -
          cameraX
        ),
        Math.floor(
          p.y
        ),
        Math.ceil(p.size),
        Math.ceil(p.size)
      );

    }

    ctx.globalAlpha = 1;

  }


  /* =======================================================
     UI
  ======================================================= */

  function updateUI() {

    scoreElement.textContent =
      String(Math.floor(score));

    const hp =
      clamp(
        player.hp,
        0,
        MAX_HP
      );

    hpFill.style.width =
      `${hp}%`;

    hpText.textContent =
      String(Math.ceil(hp));


    if (combo >= 2) {

      comboElement.hidden = false;

      comboNumberElement.textContent =
        String(combo);

    } else {

      comboElement.hidden = true;

    }

  }


  /* =======================================================
     GAME OVER
  ======================================================= */

  function gameOver() {

    if (state !== "playing") {
      return;
    }

    state = "gameover";

    player.dead = true;

    touchControls.hidden = true;

    gameUI.hidden = true;

    gameOverScreen.hidden = false;

    finalScoreElement.textContent =
      String(Math.floor(score));


    const isNewRecord =
      score > bestScore;


    if (isNewRecord) {

      bestScore =
        Math.floor(score);

      localStorage.setItem(
        "tailblade_best_score",
        String(bestScore)
      );

      newRecordElement.hidden = false;

    } else {

      newRecordElement.hidden = true;

    }

  }


  /* =======================================================
     UTILITY
  ======================================================= */

  function clamp(
    value,
    min,
    max
  ) {

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );

  }


  function rectsOverlap(
    a,
    b
  ) {

    return (
      a.x <
        b.x + b.w &&
      a.x + a.w >
        b.x &&
      a.y <
        b.y + b.h &&
      a.y + a.h >
        b.y
    );

  }


  function distanceBetween(
    x1,
    y1,
    x2,
    y2
  ) {

    const dx =
      x1 - x2;

    const dy =
      y1 - y2;

    return Math.sqrt(
      dx * dx +
      dy * dy
    );

  }


  /* =======================================================
     RESIZE
  ======================================================= */

  function resizeCanvas() {

    const dpr =
      Math.min(
        2,
        window.devicePixelRatio ||
          1
      );

    canvas.width =
      W * dpr;

    canvas.height =
      H * dpr;

    canvas.style.aspectRatio =
      `${W}/${H}`;

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    ctx.imageSmoothingEnabled =
      false;

  }


  window.addEventListener(
    "resize",
    resizeCanvas
  );

  window.addEventListener(
    "orientationchange",
    () => {
      setTimeout(
        resizeCanvas,
        150
      );
    }
  );


  /* =======================================================
     GAME LOOP
  ======================================================= */

  function loop(timestamp) {

    if (!lastTime) {
      lastTime = timestamp;
    }


    let dt =
      (timestamp - lastTime) /
      1000;


    lastTime =
      timestamp;


    dt =
      Math.min(
        dt,
        0.033
      );


    update(dt);

    draw();


    requestAnimationFrame(
      loop
    );

  }


  /* =======================================================
     INIT
  ======================================================= */

  resizeCanvas();

  bestScoreElement.textContent =
    String(bestScore);

  showTitle();

  requestAnimationFrame(
    loop
  );


})();
