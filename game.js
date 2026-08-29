"use strict";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 180;
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const player = {
  x: 80,
  y: 120,
  width: 16,
  height: 16,
  vx: 0,
  vy: 0,
  speed: 90,
  jumpPower: 190,
  grounded: false
};

const keys = {};

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (
    (e.code === "Space" || e.code === "ArrowUp") &&
    player.grounded
  ) {
    player.vy = -player.jumpPower;
    player.grounded = false;
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

let lastTime = performance.now();

function update(dt) {
  let direction = 0;

  if (keys["ArrowLeft"] || keys["KeyA"]) direction -= 1;
  if (keys["ArrowRight"] || keys["KeyD"]) direction += 1;

  player.vx = direction * player.speed;
  player.x += player.vx * dt;

  player.vy += 600 * dt;
  player.y += player.vy * dt;

  const ground = 150;

  if (player.y + player.height >= ground) {
    player.y = ground - player.height;
    player.vy = 0;
    player.grounded = true;
  }

  player.x = Math.max(
    10,
    Math.min(canvas.width - player.width - 10, player.x)
  );
}

function drawCat() {
  const x = Math.floor(player.x);
  const y = Math.floor(player.y);

  // しっぽ
  ctx.fillStyle = "#bd8840";
  ctx.fillRect(x - 5, y + 8, 5, 4);
  ctx.fillRect(x - 8, y + 5, 4, 5);

  // 体
  ctx.fillStyle = "#e8b96a";
  ctx.fillRect(x + 2, y + 5, 12, 10);

  // 頭
  ctx.fillRect(x + 1, y, 14, 10);

  // 耳
  ctx.fillStyle = "#e8b96a";
  ctx.fillRect(x + 2, y - 3, 4, 4);
  ctx.fillRect(x + 10, y - 3, 4, 4);

  // 耳の中
  ctx.fillStyle = "#e5788a";
  ctx.fillRect(x + 3, y - 2, 2, 2);
  ctx.fillRect(x + 11, y - 2, 2, 2);

  // 目
  ctx.fillStyle = "#4fd6c0";
  ctx.fillRect(x + 4, y + 3, 2, 2);
  ctx.fillRect(x + 10, y + 3, 2, 2);

  // 足
  ctx.fillStyle = "#bd8840";
  ctx.fillRect(x + 3, y + 14, 3, 3);
  ctx.fillRect(x + 11, y + 14, 3, 3);
}

function draw() {
  // 背景
  ctx.fillStyle = "#07060c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 地面
  ctx.fillStyle = "#2a4a7e";
  ctx.fillRect(0, 150, canvas.width, 30);

  // 地面のライン
  ctx.fillStyle = "#3f6fb5";
  ctx.fillRect(0, 148, canvas.width, 2);

  drawCat();

  // タイトル
  ctx.fillStyle = "#f4e9c8";
  ctx.font = "10px monospace";
  ctx.fillText("TAILBLADE", 10, 15);

  ctx.fillStyle = "#9a8fb5";
  ctx.fillText("← → MOVE   SPACE JUMP", 10, 27);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
