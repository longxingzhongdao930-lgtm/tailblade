"use strict";

(() => {
  // =========================================================
  // TAILBLADE
  // Pixel Action Game
  // =========================================================

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  ctx.imageSmoothingEnabled = false;

  // ---------------------------------------------------------
  // 設定
  // ---------------------------------------------------------

  const CONFIG = {
    gravity: 620,
    moveSpeed: 58,
    runSpeed: 98,
    jumpVelocity: 178,

    playerMaxHp: 100,

    enemyHp: 34,
    enemyDamage: 9,
    enemySpeed: 30,

    attackRange: 30,
    attackCooldown: 0.28,

    worldWidth: 3200,

    spawnInterval: 2.4,

    fixedDelta: 1 / 60
  };

  // ---------------------------------------------------------
  // 色
  // ---------------------------------------------------------

  const COLORS = {
    bg: "#07060c",
    sky: "#0d0b16",
    far: "#171225",
    mid: "#211832",
    ground: "#30233b",

    fur: "#e8b96a",
    furShade: "#bd8840",
    furLight: "#f8e0b0",

    ear: "#e5788a",
    eye: "#4fd6c0",

    cloth: "#3f6fb5",
    clothDark: "#2a4a7e",

    leather: "#7a4a2b",
    metal: "#cfd8e4",

    text: "#f4e9c8",
    dim: "#9a8fb5",
    accent: "#f0a63c",

    enemy: "#a95168",
    enemyDark: "#642c45",

    white: "#ffffff"
  };

  // ---------------------------------------------------------
  // 状態
  // ---------------------------------------------------------

  let state = "title";

  let lastTime = performance.now();
  let accumulator = 0;

  let worldTime = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;

  let cameraX = 0;

  let spawnTimer = 1.2;

  let hitStop = 0;
  let screenShake = 0;

  let enemyId = 0;

  // ---------------------------------------------------------
  // 入力
  // ---------------------------------------------------------

  const keys = new Set();

  const input = {
    left: false,
    right: false,
    jump: false,
    attack: false
  };

  const previousInput = {
    jump: false,
    attack: false
  };

  window.addEventListener("keydown", e => {
    keys.add(e.code);

    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "Space",
        "KeyA",
        "KeyD",
        "KeyJ",
        "KeyK",
        "Escape"
      ].includes(e.code)
    ) {
      e.preventDefault();
    }

    if (e.code === "Escape") {
      togglePause();
    }
  });

  window.addEventListener("keyup", e => {
    keys.delete(e.code);
  });

  // ---------------------------------------------------------
  // 仮想スティック
  // ---------------------------------------------------------

  const stick = document.getElementById("virtual-stick");
  const knob = document.getElementById("stick-knob");

  let stickPointer = null;
  let stickX = 0;
  let stickY = 0;

  function updateStick(x, y) {
    const rect = stick.getBoundingClientRect();

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = x - cx;
    let dy = y - cy;

    const max = rect.width * 0.36;

    const distance = Math.hypot(dx, dy);

    if (distance > max) {
      dx = dx / distance * max;
      dy = dy / distance * max;
    }

    stickX = dx / max;
    stickY = dy / max;

    knob.style.transform =
      `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function resetStick() {
    stickPointer = null;
    stickX = 0;
    stickY = 0;

    knob.style.transform = "translate(-50%, -50%)";
  }

  stick.addEventListener("pointerdown", e => {
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    updateStick(e.clientX, e.clientY);
  });

  stick.addEventListener("pointermove", e => {
    if (e.pointerId === stickPointer) {
      updateStick(e.clientX, e.clientY);
    }
  });

  stick.addEventListener("pointerup", resetStick);
  stick.addEventListener("pointercancel", resetStick);

  // ---------------------------------------------------------
  // ボタン
  // ---------------------------------------------------------

  const jumpButton = document.getElementById("jump-button");
  const attackButton = document.getElementById("attack-button");

  function bindButton(button, property) {
    button.addEventListener("pointerdown", e => {
      e.preventDefault();
      input[property] = true;
      button.setPointerCapture?.(e.pointerId);
    });

    const release = e => {
      e.preventDefault();
      input[property] = false;
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }

  bindButton(jumpButton, "jump");
  bindButton(attackButton, "attack");

  // ---------------------------------------------------------
  // プレイヤー
  // ---------------------------------------------------------

  const player = {
    x: 120,
    y: 100,

    vx: 0,
    vy: 0,

    width: 14,
    height: 25,

    hp: CONFIG.playerMaxHp,

    facing: 1,

    grounded: false,

    attacking: false,
    attackTimer: 0,
    attackCooldown: 0,

    hurtTimer: 0,

    jumpBuffer: 0,
    coyote: 0,

    animation: 0
  };

  // ---------------------------------------------------------
  // 敵
  // ---------------------------------------------------------

  const enemies = [];

  // ---------------------------------------------------------
  // パーティクル
  // ---------------------------------------------------------

  const particles = [];

  function particle(x, y, options = {}) {
    particles.push({
      x,
      y,

      vx: options.vx ?? 0,
      vy: options.vy ?? 0,

      life: options.life ?? 0.4,
      maxLife: options.life ?? 0.4,

      size: options.size ?? 1,

      gravity: options.gravity ?? 0,

      type: options.type ?? "square"
    });
  }

  // ---------------------------------------------------------
  // ダメージ数字
  // ---------------------------------------------------------

  const damageNumbers = [];

  function damageText(x, y, value, critical = false) {
    damageNumbers.push({
      x,
      y,
      value,
      life: 0.55,
      critical
    });
  }

  // ---------------------------------------------------------
  // 地形
  // ---------------------------------------------------------

  const platforms = [
    {
      x: 0,
      y: 150,
      w: 520,
      h: 30
    },

    {
      x: 590,
      y: 140,
      w: 420,
      h: 40
    },

    {
      x: 1080,
      y: 150,
      w: 440,
      h: 30
    },

    {
      x: 1600,
      y: 135,
      w: 380,
      h: 45
    },

    {
      x: 2050,
      y: 150,
      w: 450,
      h: 30
    },

    {
      x: 2580,
      y: 140,
      w: 620,
      h: 40
    }
  ];

  const floatingPlatforms = [
    {
      x: 390,
      y: 105,
      w: 90,
      h: 8
    },

    {
      x: 760,
      y: 95,
      w: 110,
      h: 8
    },

    {
      x: 1260,
      y: 105,
      w: 100,
      h: 8
    },

    {
      x: 1740,
      y: 88,
      w: 110,
      h: 8
    },

    {
      x: 2250,
      y: 100,
      w: 100,
      h: 8
    }
  ];

  // ---------------------------------------------------------
  // リセット
  // ---------------------------------------------------------

  function resetGame() {
    state = "playing";

    worldTime = 0;

    score = 0;
    combo = 0;
    maxCombo = 0;

    cameraX = 0;

    spawnTimer = 1.5;

    hitStop = 0;
    screenShake = 0;

    enemies.length = 0;
    particles.length = 0;
    damageNumbers.length = 0;

    player.x = 120;
    player.y = 100;

    player.vx = 0;
    player.vy = 0;

    player.hp = CONFIG.playerMaxHp;

    player.facing = 1;

    player.grounded = false;

    player.attacking = false;
    player.attackTimer = 0;
    player.attackCooldown = 0;

    player.hurtTimer = 0;

    player.jumpBuffer = 0;
    player.coyote = 0;

    updateHUD();
  }

  // ---------------------------------------------------------
  // スタート
  // ---------------------------------------------------------

  document
    .getElementById("start-button")
    .addEventListener("click", resetGame);

  document
    .getElementById("game-over-restart")
    .addEventListener("click", resetGame);

  document
    .getElementById("clear-restart")
    .addEventListener("click", resetGame);

  document
    .getElementById("resume-button")
    .addEventListener("click", () => {
      state = "playing";
      document.getElementById("pause-screen").hidden = true;
    });

  document
    .getElementById("restart-button")
    .addEventListener("click", () => {
      document.getElementById("pause-screen").hidden = true;
      resetGame();
    });

  // ---------------------------------------------------------
  // ポーズ
  // ---------------------------------------------------------

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      document.getElementById("pause-screen").hidden = false;
    } else if (state === "paused") {
      state = "playing";
      document.getElementById("pause-screen").hidden = true;
    }
  }

  // ---------------------------------------------------------
  // 入力更新
  // ---------------------------------------------------------

  function readInput() {
    input.left =
      keys.has("ArrowLeft") ||
      keys.has("KeyA") ||
      stickX < -0.18;

    input.right =
      keys.has("ArrowRight") ||
      keys.has("KeyD") ||
      stickX > 0.18;

    input.jump =
      keys.has("Space") ||
      keys.has("ArrowUp") ||
      keys.has("KeyW") ||
      keys.has("KeyJ") ||
      input.jump;

    input.attack =
      keys.has("KeyK") ||
      keys.has("KeyF") ||
      input.attack;
  }

  // ---------------------------------------------------------
  // プレイヤー更新
  // ---------------------------------------------------------

  function updatePlayer(dt) {
    readInput();

    const justJump =
      input.jump && !previousInput.jump;

    const justAttack =
      input.attack && !previousInput.attack;

    if (justJump) {
      player.jumpBuffer = 0.13;
    } else {
      player.jumpBuffer -= dt;
    }

    if (player.grounded) {
      player.coyote = 0.09;
    } else {
      player.coyote -= dt;
    }

    // -------------------------------------------------------
    // 移動
    // -------------------------------------------------------

    let direction = 0;

    if (input.left) direction -= 1;
    if (input.right) direction += 1;

    if (direction !== 0) {
      player.facing = direction;

      const target =
        direction *
        (Math.abs(player.vx) > 70
          ? CONFIG.runSpeed
          : CONFIG.moveSpeed);

      const acceleration = player.grounded ? 640 : 350;

      if (player.vx < target) {
        player.vx = Math.min(
          player.vx + acceleration * dt,
          target
        );
      }

      if (player.vx > target) {
        player.vx = Math.max(
          player.vx - acceleration * dt,
          target
        );
      }
    } else {
      const decel = player.grounded ? 900 : 500;

      if (player.vx > 0) {
        player.vx = Math.max(
          0,
          player.vx - decel * dt
        );
      }

      if (player.vx < 0) {
        player.vx = Math.min(
          0,
          player.vx + decel * dt
        );
      }
    }

    // -------------------------------------------------------
    // ジャンプ
    // -------------------------------------------------------

    if (
      player.jumpBuffer > 0 &&
      player.coyote > 0
    ) {
      player.vy = -CONFIG.jumpVelocity;

      player.grounded = false;

      player.jumpBuffer = 0;
      player.coyote = 0;

      for (let i = 0; i < 5; i++) {
        particle(
          player.x,
          player.y + player.height / 2,
          {
            vx: (Math.random() - 0.5) * 30,
            vy: -Math.random() * 25,
            life: 0.3
          }
        );
      }
    }

    // -------------------------------------------------------
    // 重力
    // -------------------------------------------------------

    player.vy += CONFIG.gravity * dt;

    // -------------------------------------------------------
    // 攻撃
    // -------------------------------------------------------

    if (
      justAttack &&
      player.attackCooldown <= 0 &&
      !player.hurtTimer
    ) {
      startAttack();
    }

    if (player.attackCooldown > 0) {
      player.attackCooldown -= dt;
    }

    if (player.attacking) {
      player.attackTimer -= dt;

      if (player.attackTimer <= 0) {
        player.attacking = false;
      }
    }

    // -------------------------------------------------------
    // 移動
    // -------------------------------------------------------

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // -------------------------------------------------------
    // 地面判定
    // -------------------------------------------------------

    resolvePlayerPlatforms();

    // -------------------------------------------------------
    // 落下
    // -------------------------------------------------------

    if (player.y > H + 60) {
      player.hp = 0;
      gameOver();
    }

    // -------------------------------------------------------
    // ワールド範囲
    // -------------------------------------------------------

    player.x = Math.max(
      10,
      Math.min(
        CONFIG.worldWidth - 10,
        player.x
      )
    );

    if (player.hurtTimer > 0) {
      player.hurtTimer -= dt;
    }

    player.animation += dt;

    previousInput.jump = input.jump;
    previousInput.attack = input.attack;

    input.jump = false;
    input.attack = false;
  }

  // ---------------------------------------------------------
  // 地形衝突
  // ---------------------------------------------------------

  function resolvePlayerPlatforms() {
    const oldY = player.y - player.vy * CONFIG.fixedDelta;

    const bottom = player.y + player.height / 2;
    const previousBottom =
      oldY + player.height / 2;

    player.grounded = false;

    const allPlatforms = [
      ...platforms,
      ...floatingPlatforms
    ];

    for (const p of allPlatforms) {
      const insideX =
        player.x + player.width / 2 > p.x &&
        player.x - player.width / 2 < p.x + p.w;

      if (!insideX) continue;

      if (
        player.vy >= 0 &&
        previousBottom <= p.y &&
        bottom >= p.y
      ) {
        player.y =
          p.y - player.height / 2;

        player.vy = 0;
        player.grounded = true;
      }
    }
  }

  // ---------------------------------------------------------
  // 攻撃
  // ---------------------------------------------------------

  function startAttack() {
    player.attacking = true;

    player.attackTimer =
      CONFIG.attackCooldown;

    player.attackCooldown =
      CONFIG.attackCooldown;

    // 攻撃開始演出
    for (let i = 0; i < 4; i++) {
      particle(
        player.x +
          player.facing * 9,
        player.y - 2,
        {
          vx: player.facing *
            (25 + Math.random() * 35),

          vy:
            (Math.random() - 0.5) * 40,

          life: 0.18,

          size: 1
        }
      );
    }

    checkAttackHit();
  }

  function checkAttackHit() {
    const attackX =
      player.x +
      player.facing * 23;

    const attackY =
      player.y - 2;

    for (const enemy of enemies) {
      if (enemy.dead) continue;

      const dx =
        enemy.x - attackX;

      const dy =
        enemy.y - attackY;

      if (
        Math.abs(dx) < CONFIG.attackRange &&
        Math.abs(dy) < 20 &&
        Math.sign(dx || 1) === player.facing
      ) {
        damageEnemy(enemy, 9);
      }
    }
  }

  // ---------------------------------------------------------
  // 敵生成
  // ---------------------------------------------------------

  function spawnEnemy() {
    const ahead =
      player.x + 170 +
      Math.random() * 90;

    if (ahead > CONFIG.worldWidth - 40) {
      return;
    }

    const ground =
      findGroundAt(ahead);

    if (!ground) return;

    enemies.push({
      id: ++enemyId,

      x: ahead,
      y: ground.y - 11,

      vx: 0,
      vy: 0,

      hp: CONFIG.enemyHp,

      width: 18,
      height: 18,

      grounded: true,

      attackTimer: 0,
      attackCooldown:
        0.5 + Math.random() * 0.8,

      hurtTimer: 0,

      dead: false,

      flash: 0,

      animation:
        Math.random() * Math.PI * 2
    });
  }

  function findGroundAt(x) {
    for (const p of platforms) {
      if (
        x >= p.x &&
        x <= p.x + p.w
      ) {
        return p;
      }
    }

    for (const p of floatingPlatforms) {
      if (
        x >= p.x &&
        x <= p.x + p.w
      ) {
        return p;
      }
    }

    return null;
  }

  // ---------------------------------------------------------
  // 敵更新
  // ---------------------------------------------------------

  function updateEnemies(dt) {
    spawnTimer -= dt;

    if (
      spawnTimer <= 0 &&
      enemies.length < 7
    ) {
      spawnEnemy();

      const difficulty =
        Math.min(
          1.5,
          worldTime / 90
        );

      spawnTimer =
        CONFIG.spawnInterval -
        difficulty * 0.7 +
        Math.random() * 0.8;
    }

    for (const enemy of enemies) {
      if (enemy.dead) continue;

      enemy.animation += dt;

      if (enemy.flash > 0) {
        enemy.flash -= dt;
      }

      if (enemy.hurtTimer > 0) {
        enemy.hurtTimer -= dt;

        enemy.x += enemy.vx * dt;

        enemy.vx *=
          Math.max(0, 1 - 5 * dt);

        continue;
      }

      const dx =
        player.x - enemy.x;

      const distance =
        Math.abs(dx);

      const direction =
        Math.sign(dx);

      // 追跡
      if (distance > 27) {
        enemy.vx =
          direction *
          CONFIG.enemySpeed;

        enemy.x += enemy.vx * dt;
      } else {
        enemy.vx = 0;

        enemy.attackCooldown -= dt;

        if (
          enemy.attackCooldown <= 0 &&
          player.hurtTimer <= 0
        ) {
          enemy.attackCooldown =
            1.0;

          damagePlayer(
            CONFIG.enemyDamage,
            direction
          );
        }
      }

      // 地面に吸着
      const ground =
        findGroundAt(enemy.x);

      if (ground) {
        enemy.y =
          ground.y -
          enemy.height / 2;
      }

      // 敵同士の簡易分離
      for (const other of enemies) {
        if (
          other === enemy ||
          other.dead
        ) continue;

        const d =
          enemy.x - other.x;

        if (
          Math.abs(d) < 16 &&
          Math.abs(
            enemy.y - other.y
          ) < 12
        ) {
          enemy.x +=
            Math.sign(d || 1) *
            8 *
            dt;
        }
      }
    }

    // 死亡した敵を整理
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].dead) {
        enemies.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------
  // 敵ダメージ
  // ---------------------------------------------------------

  function damageEnemy(enemy, damage) {
    if (enemy.dead) return;

    enemy.hp -= damage;

    enemy.hurtTimer = 0.22;

    enemy.vx =
      player.facing * 95;

    enemy.flash = 0.15;

    combo++;

    maxCombo =
      Math.max(maxCombo, combo);

    score +=
      100 * Math.max(1, combo);

    damageText(
      enemy.x,
      enemy.y - 14,
      damage,
      combo >= 5
    );

    hitStop = 0.045;
    screenShake = 0.05;

    for (let i = 0; i < 7; i++) {
      particle(
        enemy.x,
        enemy.y,
        {
          vx:
            (Math.random() - 0.5) * 90,

          vy:
            (Math.random() - 0.5) * 90,

          life:
            0.18 +
            Math.random() * 0.25
        }
      );
    }

    if (enemy.hp <= 0) {
      killEnemy(enemy);
    }

    updateHUD();
  }

  function killEnemy(enemy) {
    enemy.dead = true;

    score += 250;

    for (let i = 0; i < 18; i++) {
      particle(
        enemy.x,
        enemy.y,
        {
          vx:
            (Math.random() - 0.5) * 150,

          vy:
            (Math.random() - 0.5) * 150,

          life:
            0.3 +
            Math.random() * 0.45
        }
      );
    }

    hitStop = 0.08;
    screenShake = 0.09;

    updateHUD();
  }

  // ---------------------------------------------------------
  // プレイヤーダメージ
  // ---------------------------------------------------------

  function damagePlayer(damage, direction) {
    if (player.hurtTimer > 0) {
      return;
    }

    player.hp -= damage;

    player.hurtTimer = 0.7;

    player.vx =
      direction * -78;

    player.vy =
      -60;

    combo = 0;

    screenShake = 0.16;

    hitStop = 0.08;

    for (let i = 0; i < 12; i++) {
      particle(
        player.x,
        player.y,
        {
          vx:
            (Math.random() - 0.5) * 120,

          vy:
            (Math.random() - 0.5) * 100,

          life:
            0.25 +
            Math.random() * 0.3
        }
      );
    }

    updateHUD();

    if (player.hp <= 0) {
      gameOver();
    }
  }

  // ---------------------------------------------------------
  // パーティクル更新
  // ---------------------------------------------------------

  function updateParticles(dt) {
    for (
      let i = particles.length - 1;
      i >= 0;
      i--
    ) {
      const p = particles[i];

      p.life -= dt;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.vy += p.gravity * dt;

      p.vx *=
        Math.max(0, 1 - 2 * dt);
    }

    for (
      let i = damageNumbers.length - 1;
      i >= 0;
      i--
    ) {
      const d =
        damageNumbers[i];

      d.life -= dt;

      d.y -= 24 * dt;

      if (d.life <= 0) {
        damageNumbers.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------
  // コンボタイムアウト
  // ---------------------------------------------------------

  let comboTimer = 0;

  function updateCombo(dt) {
    if (combo > 0) {
      comboTimer += dt;

      if (comboTimer > 1.0) {
        combo = 0;
        comboTimer = 0;
        updateHUD();
      }
    } else {
      comboTimer = 0;
    }
  }

  // ---------------------------------------------------------
  // カメラ
  // ---------------------------------------------------------

  function updateCamera(dt) {
    const target =
      player.x - W * 0.42;

    cameraX +=
      (target - cameraX) *
      (1 - Math.exp(-7.5 * dt));

    cameraX = Math.max(
      0,
      Math.min(
        CONFIG.worldWidth - W,
        cameraX
      )
    );
  }

  // ---------------------------------------------------------
  // 背景
  // ---------------------------------------------------------

  function drawBackground() {
    ctx.fillStyle =
      COLORS.sky;

    ctx.fillRect(
      0,
      0,
      W,
      H
    );

    // 月
    ctx.fillStyle =
      "rgba(244,233,200,0.08)";

    ctx.beginPath();

    ctx.arc(
      252,
      42,
      20,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // 遠景
    drawParallaxLayer(
      0.12,
      COLORS.far,
      100,
      50
    );

    drawParallaxLayer(
      0.25,
      COLORS.mid,
      125,
      35
    );

    // 星
    ctx.fillStyle =
      "rgba(244,233,200,0.45)";

    for (let i = 0; i < 25; i++) {
      const x =
        (i * 67) % W;

      const y =
        15 +
        ((i * 37) % 65);

      ctx.fillRect(
        x,
        y,
        1,
        1
      );
    }
  }

  function drawParallaxLayer(
    factor,
    color,
    baseY,
    height
  ) {
    ctx.fillStyle = color;

    const offset =
      -(cameraX * factor) % 80;

    for (
      let x = offset - 80;
      x < W + 80;
      x += 80
    ) {
      const h =
        height *
        (0.55 +
          ((Math.abs(x) * 13) % 40) /
            100);

      ctx.fillRect(
        x,
        baseY - h,
        45,
        h
      );

      ctx.fillRect(
        x + 50,
        baseY - h * 0.65,
        20,
        h * 0.65
      );
    }
  }

  // ---------------------------------------------------------
  // 地形描画
  // ---------------------------------------------------------

  function drawPlatforms() {
    for (const p of [
      ...platforms,
      ...floatingPlatforms
    ]) {
      const x =
        Math.floor(
          p.x - cameraX
        );

      if (
        x + p.w < 0 ||
        x > W
      ) {
        continue;
      }

      ctx.fillStyle =
        COLORS.ground;

      ctx.fillRect(
        x,
        p.y,
        p.w,
        p.h
      );

      // 上面
      ctx.fillStyle =
        COLORS.accent;

      ctx.globalAlpha = 0.7;

      ctx.fillRect(
        x,
        p.y,
        p.w,
        2
      );

      ctx.globalAlpha = 1;

      // ピクセル模様
      ctx.fillStyle =
        "#241a2f";

      for (
        let xx = x + 5;
        xx < x + p.w;
        xx += 13
      ) {
        ctx.fillRect(
          xx,
          p.y + 8,
          5,
          3
        );
      }
    }
  }

  // ---------------------------------------------------------
  // プレイヤー描画
  // ---------------------------------------------------------

  function drawPlayer() {
    const x =
      Math.round(
        player.x - cameraX
      );

    const y =
      Math.round(player.y);

    const bob =
      player.grounded
        ? Math.sin(
            player.animation * 9
          ) * 1
        : 0;

    ctx.save();

    ctx.translate(
      x,
      y + bob
    );

    if (player.facing < 0) {
      ctx.scale(-1, 1);
    }

    // 攻撃時の尻尾エフェクト
    if (player.attacking) {
      ctx.strokeStyle =
        COLORS.accent;

      ctx.globalAlpha = 0.85;

      ctx.lineWidth = 3;

      ctx.beginPath();

      ctx.arc(
        7,
        -2,
        20,
        -1.0,
        1.0
      );

      ctx.stroke();

      ctx.globalAlpha = 1;
    }

    // 影
    ctx.fillStyle =
      "rgba(0,0,0,0.35)";

    ctx.fillRect(
      -9,
      12,
      18,
      3
    );

    // 体
    ctx.fillStyle =
      COLORS.fur;

    ctx.fillRect(
      -7,
      -7,
      14,
      15
    );

    // 服
    ctx.fillStyle =
      COLORS.cloth;

    ctx.fillRect(
      -7,
      1,
      14,
      8
    );

    ctx.fillStyle =
      COLORS.clothDark;

    ctx.fillRect(
      -7,
      6,
      14,
      3
    );

    // 頭
    ctx.fillStyle =
      COLORS.fur;

    ctx.fillRect(
      -8,
      -18,
      16,
      13
    );

    // 耳
    ctx.fillStyle =
      COLORS.fur;

    ctx.fillRect(
      -8,
      -22,
      6,
      7
    );

    ctx.fillRect(
      2,
      -22,
      6,
      7
    );

    // 耳の内側
    ctx.fillStyle =
      COLORS.ear;

    ctx.fillRect(
      -6,
      -20,
      3,
      3
    );

    ctx.fillRect(
      3,
      -20,
      3,
      3
    );

    // 目
    ctx.fillStyle =
      COLORS.eye;

    ctx.fillRect(
      2,
      -14,
      3,
      3
    );

    // 鼻
    ctx.fillStyle =
      COLORS.furShade;

    ctx.fillRect(
      5,
      -10,
      2,
      2
    );

    // 足
    ctx.fillStyle =
      COLORS.furShade;

    ctx.fillRect(
      -6,
      8,
      5,
      5
    );

    ctx.fillRect(
      2,
      8,
      5,
      5
    );

    // 剣
    if (player.attacking) {
      ctx.fillStyle =
        COLORS.metal;

      ctx.fillRect(
        8,
        -10,
        17,
        3
      );

      ctx.fillStyle =
        COLORS.accent;

      ctx.fillRect(
        8,
        -12,
        4,
        2
      );
    } else {
      // 尻尾
      ctx.strokeStyle =
        COLORS.furShade;

      ctx.lineWidth = 4;

      ctx.beginPath();

      ctx.moveTo(
        -7,
        5
      );

      ctx.lineTo(
        -15,
        1
      );

      ctx.lineTo(
        -19,
        5
      );

      ctx.stroke();
    }

    // ダメージ点滅
    if (
      player.hurtTimer > 0 &&
      Math.floor(
        player.hurtTimer * 15
      ) % 2 === 0
    ) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle =
        COLORS.white;

      ctx.fillRect(
        -10,
        -23,
        30,
        38
      );
    }

    ctx.restore();
  }

  // ---------------------------------------------------------
  // 敵描画
  // ---------------------------------------------------------

  function drawEnemy(enemy) {
    const x =
      Math.round(
        enemy.x - cameraX
      );

    const y =
      Math.round(enemy.y);

    ctx.save();

    ctx.translate(
      x,
      y
    );

    const bounce =
      Math.sin(
        enemy.animation * 7
      ) * 1;

    ctx.translate(
      0,
      bounce
    );

    // 影
    ctx.fillStyle =
      "rgba(0,0,0,0.3)";

    ctx.fillRect(
      -10,
      9,
      20,
      3
    );

    // 体
    ctx.fillStyle =
      enemy.flash > 0
        ? COLORS.white
        : COLORS.enemy;

    ctx.fillRect(
      -9,
      -8,
      18,
      17
    );

    // 頭
    ctx.fillStyle =
      enemy.flash > 0
        ? COLORS.white
        : COLORS.enemy;

    ctx.fillRect(
      -8,
      -12,
      16,
      9
    );

    // 耳
    ctx.fillStyle =
      COLORS.enemyDark;

    ctx.fillRect(
      -8,
      -15,
      5,
      5
    );

    ctx.fillRect(
      3,
      -15,
      5,
      5
    );

    // 目
    ctx.fillStyle =
      COLORS.accent;

    ctx.fillRect(
      -5,
      -8,
      3,
      2
    );

    ctx.fillRect(
      2,
      -8,
      3,
      2
    );

    // 足
    ctx.fillStyle =
      COLORS.enemyDark;

    ctx.fillRect(
      -7,
      8,
      5,
      4
    );

    ctx.fillRect(
      2,
      8,
      5,
      4
    );

    ctx.restore();

    // HPバー
    if (enemy.hp < CONFIG.enemyHp) {
      const barW = 20;

      ctx.fillStyle =
        "#221b2c";

      ctx.fillRect(
        x - barW / 2,
        y - 19,
        barW,
        2
      );

      ctx.fillStyle =
        COLORS.enemy;

      ctx.fillRect(
        x - barW / 2,
        y - 19,
        barW *
          Math.max(
            0,
            enemy.hp /
              CONFIG.enemyHp
          ),
        2
      );
    }
  }

  // ---------------------------------------------------------
  // パーティクル描画
  // ---------------------------------------------------------

  function drawParticles() {
    for (const p of particles) {
      const alpha =
        Math.max(
          0,
          p.life / p.maxLife
        );

      ctx.globalAlpha =
        alpha;

      ctx.fillStyle =
        COLORS.accent;

      const size =
        p.size *
        (p.type === "square"
          ? 1
          : 2);

      ctx.fillRect(
        Math.round(
          p.x - cameraX
        ),
        Math.round(p.y),
        size,
        size
      );
    }

    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------
  // ダメージ数字描画
  // ---------------------------------------------------------

  function drawDamageNumbers() {
    ctx.textAlign = "center";

    for (const d of damageNumbers) {
      ctx.globalAlpha =
        Math.min(
          1,
          d.life * 3
        );

      ctx.fillStyle =
        d.critical
          ? COLORS.accent
          : COLORS.text;

      ctx.font =
        d.critical
          ? "bold 9px monospace"
          : "bold 8px monospace";

      ctx.fillText(
        d.value,
        Math.round(
          d.x - cameraX
        ),
        Math.round(d.y)
      );
    }

    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------
  // ゴール
  // ---------------------------------------------------------

  function checkGoal() {
    if (
      player.x >=
      CONFIG.worldWidth - 70
    ) {
      clearGame();
    }
  }

  // ---------------------------------------------------------
  // ゲームオーバー
  // ---------------------------------------------------------

  function gameOver() {
    if (
      state === "gameover" ||
      state === "clear"
    ) {
      return;
    }

    state = "gameover";

    document.getElementById(
      "final-score"
    ).textContent =
      String(score)
        .padStart(6, "0");

    document.getElementById(
      "final-combo"
    ).textContent =
      `MAX COMBO ${maxCombo}`;

    document.getElementById(
      "game-over-screen"
    ).hidden = false;
  }

  // ---------------------------------------------------------
  // クリア
  // ---------------------------------------------------------

  function clearGame() {
    if (state !== "playing") {
      return;
    }

    state = "clear";

    score += 1000;

    document.getElementById(
      "clear-score"
    ).textContent =
      String(score)
        .padStart(6, "0");

    document.getElementById(
      "clear-combo"
    ).textContent =
      `MAX COMBO ${maxCombo}`;

    document.getElementById(
      "clear-screen"
    ).hidden = false;

    updateHUD();
  }

  // ---------------------------------------------------------
  // HUD
  // ---------------------------------------------------------

  function updateHUD() {
    const hp =
      Math.max(
        0,
        player.hp
      );

    document.getElementById(
      "hp-fill"
    ).style.width =
      `${hp}%`;

    document.getElementById(
      "hp-text"
    ).textContent =
      `${Math.ceil(hp)} / ${CONFIG.playerMaxHp}`;

    document.getElementById(
      "combo-count"
    ).textContent =
      combo;

    document.getElementById(
      "score"
    ).textContent =
      String(score)
        .padStart(6, "0");
  }

  // ---------------------------------------------------------
  // 縦画面チェック
  // ---------------------------------------------------------

  function updateOrientation() {
    const hint =
      document.getElementById(
        "rotate-hint"
      );

    const portrait =
      window.innerHeight >
      window.innerWidth;

    hint.hidden =
      !portrait;
  }

  window.addEventListener(
    "resize",
    updateOrientation
  );

  window.addEventListener(
    "orientationchange",
    updateOrientation
  );

  updateOrientation();

  // ---------------------------------------------------------
  // 描画
  // ---------------------------------------------------------

  function render() {
    ctx.clearRect(
      0,
      0,
      W,
      H
    );

    ctx.save();

    // スクリーンシェイク
    if (screenShake > 0) {
      const shake =
        screenShake * 12;

      ctx.translate(
        (Math.random() - 0.5) *
          shake,

        (Math.random() - 0.5) *
          shake
      );
    }

    drawBackground();

    drawPlatforms();

    // 敵
    for (const enemy of enemies) {
      drawEnemy(enemy);
    }

    drawPlayer();

    drawParticles();

    drawDamageNumbers();

    ctx.restore();

    // 画面端のゴール表示
    if (
      state === "playing" &&
      player.x >
        CONFIG.worldWidth - 450
    ) {
      const progress =
        (player.x -
          (CONFIG.worldWidth - 450)) /
        450;

      ctx.fillStyle =
        COLORS.accent;

      ctx.globalAlpha = 0.8;

      ctx.fillRect(
        0,
        H - 3,
        W * progress,
        3
      );

      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------
  // 更新
  // ---------------------------------------------------------

  function update(dt) {
    if (state !== "playing") {
      return;
    }

    if (hitStop > 0) {
      hitStop -= dt;

      updateParticles(
        dt * 0.3
      );

      return;
    }

    worldTime += dt;

    if (screenShake > 0) {
      screenShake -= dt;
    }

    updatePlayer(dt);

    updateEnemies(dt);

    updateParticles(dt);

    updateCombo(dt);

    updateCamera(dt);

    checkGoal();

    updateHUD();
  }

  // ---------------------------------------------------------
  // メインループ
  // ---------------------------------------------------------

  function loop(now) {
    let frameDelta =
      (now - lastTime) /
      1000;

    lastTime = now;

    frameDelta =
      Math.min(
        frameDelta,
        0.25
      );

    accumulator +=
      frameDelta;

    while (
      accumulator >=
      CONFIG.fixedDelta
    ) {
      update(
        CONFIG.fixedDelta
      );

      accumulator -=
        CONFIG.fixedDelta;
    }

    render();

    requestAnimationFrame(
      loop
    );
  }

  // ---------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------

  updateHUD();

  requestAnimationFrame(
    loop
  );

})();
